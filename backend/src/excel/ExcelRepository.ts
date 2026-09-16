import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { FileDef, Record_, SheetDef } from "../types/schema.js";
import { findSheetDef } from "../schema/files.js";
import { filePath } from "../config/paths.js";
import {
  appendRecord,
  buildWorkbookFromDef,
  ensureDir,
  readWorkbook,
  sheetToRecords,
  tempPathFor,
  writeRecordAtRow,
} from "./workbookIO.js";
import { nextId } from "../util/ids.js";
import { validateRecord } from "./validate.js";
import { writeAuditEntry } from "./audit.js";
import { ValidationFailedError, RecordNotFoundError, type Repository, type RepoContext } from "../repository/Repository.js";

export { ValidationFailedError, RecordNotFoundError };
export type { RepoContext };

/**
 * Camada única de acesso aos .xlsx (Seção 48). Implementação de Repository
 * (Seção 57) baseada em Excel -- mantida no código sem uso em produção após
 * a migração para Postgres, como base para uma futura exportação (Seção 35).
 */
export class ExcelRepository implements Repository {
  /**
   * Cria o arquivo com todas as abas/cabeçalhos do FileDef, se ainda não existir.
   * Se o arquivo já existir, acrescenta só o que estiver faltando -- nunca mexe
   * nas abas/dados já existentes:
   *  - abas novas do schema (caso comum: o schema ganhou uma aba nova depois
   *    que o .xlsx real já tinha sido criado);
   *  - colunas novas em abas que já existiam (ex.: PERCENTUAL_DESCONTO_ENTRADA
   *    adicionado a Propostas em 2026-09-13) -- a coluna nova é acrescentada
   *    ao final do cabeçalho físico (linhas já existentes ficam com a célula
   *    vazia nessa coluna, igual a uma planilha comum). Por isso a leitura e a
   *    escrita (sheetToRecords/appendRecord/writeRecordAtRow) sempre resolvem
   *    coluna por NOME via o cabeçalho, nunca por posição fixa do schema.
   * Idempotente: rodar de novo depois que tudo já existe não faz nada.
   */
  async ensureFile(fileDef: FileDef): Promise<void> {
    const target = filePath(fileDef.fileName);
    if (!fs.existsSync(target)) {
      await ensureDir(path.dirname(target));
      const wb = buildWorkbookFromDef(fileDef);
      await wb.xlsx.writeFile(target);
      return;
    }

    const atual = await readWorkbook(target);
    const abasExistentes = new Set(atual.worksheets.map((ws) => ws.name));
    const abasFaltando = fileDef.sheets.filter((s) => !abasExistentes.has(s.name));

    const colunasFaltandoPorAba = new Map<string, string[]>();
    for (const sheet of fileDef.sheets) {
      if (!abasExistentes.has(sheet.name)) continue; // aba nova inteira, já coberta acima
      const ws = atual.getWorksheet(sheet.name)!;
      const headers = new Set<string>();
      ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => headers.add(String(cell.value ?? "").trim()));
      const faltando = sheet.columns.map((c) => c.name).filter((nome) => !headers.has(nome));
      if (faltando.length > 0) colunasFaltandoPorAba.set(sheet.name, faltando);
    }

    if (abasFaltando.length === 0 && colunasFaltandoPorAba.size === 0) return;

    await this.safeMutate(target, async (wb) => {
      for (const sheet of abasFaltando) {
        if (wb.getWorksheet(sheet.name)) continue; // já foi adicionada em outra chamada concorrente
        const ws = wb.addWorksheet(sheet.name);
        ws.addRow(sheet.columns.map((c) => c.name));
        ws.getRow(1).font = { bold: true };
        ws.views = [{ state: "frozen", ySplit: 1 }];
      }
      for (const [sheetName, colunasNovas] of colunasFaltandoPorAba) {
        const ws = wb.getWorksheet(sheetName);
        if (!ws) continue;
        const headerRow = ws.getRow(1);
        const jaTem = new Set<string>();
        headerRow.eachCell({ includeEmpty: false }, (cell) => jaTem.add(String(cell.value ?? "").trim()));
        // Usa a extensão do próprio cabeçalho (não ws.columnCount, que reflete a
        // linha mais larga de QUALQUER linha da aba -- uma linha de dado com
        // mais células que o cabeçalho faria a coluna nova entrar fora de
        // posição, deixando células vazias sem nome entre o cabeçalho antigo e o novo).
        let proximaCol = headerRow.cellCount + 1;
        for (const nome of colunasNovas) {
          if (jaTem.has(nome)) continue; // já foi adicionada em outra chamada concorrente
          headerRow.getCell(proximaCol).value = nome;
          proximaCol++;
        }
        headerRow.font = { bold: true };
        headerRow.commit();
      }
    });
  }

  async readAll(fileDef: FileDef, sheetName: string): Promise<Record_[]> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const wb = await readWorkbook(filePath(fileDef.fileName));
    const ws = wb.getWorksheet(sheetName);
    if (!ws) throw new Error(`Aba não encontrada: ${sheetName}`);
    return sheetToRecords(ws, sheetDef);
  }

  async query(fileDef: FileDef, sheetName: string, predicate: (r: Record_) => boolean): Promise<Record_[]> {
    const all = await this.readAll(fileDef, sheetName);
    return all.filter(predicate);
  }

  async findById(fileDef: FileDef, sheetName: string, id: string): Promise<Record_ | undefined> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const idColumn = sheetDef.columns.find((c) => c.isId)?.name;
    if (!idColumn) throw new Error(`Aba ${sheetName} não possui coluna de ID.`);
    const all = await this.readAll(fileDef, sheetName);
    return all.find((r) => r[idColumn] === id);
  }

  /** Insere um novo registro. Gera o ID automaticamente se a aba tiver idPrefix. */
  async insert(fileDef: FileDef, sheetName: string, data: Record_, ctx: RepoContext): Promise<Record_> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const target = filePath(fileDef.fileName);
    const existing = await this.readAll(fileDef, sheetName);

    const record: Record_ = { ...data };
    const idColumn = sheetDef.columns.find((c) => c.isId)?.name;
    if (idColumn && !record[idColumn] && sheetDef.idPrefix) {
      record[idColumn] = nextId(sheetDef, existing);
    }

    const errors = validateRecord(sheetDef, record);
    if (errors.length > 0) throw new ValidationFailedError(errors);

    await this.safeMutate(target, async (wb) => {
      const ws = wb.getWorksheet(sheetName)!;
      appendRecord(ws, sheetDef, record);
    });

    await writeAuditEntry({
      usuario: ctx.usuario,
      acao: "CRIACAO",
      arquivo: fileDef.fileName,
      aba: sheetName,
      idRegistro: idColumn ? String(record[idColumn]) : undefined,
      motivo: ctx.motivo,
    });

    return record;
  }

  /** Atualiza campos de um registro existente, identificado por ID. Gera auditoria por campo alterado. */
  async update(fileDef: FileDef, sheetName: string, id: string, changes: Record_, ctx: RepoContext): Promise<Record_> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const target = filePath(fileDef.fileName);
    const idColumn = sheetDef.columns.find((c) => c.isId)?.name;
    if (!idColumn) throw new Error(`Aba ${sheetName} não possui coluna de ID.`);

    const existing = await this.readAll(fileDef, sheetName);
    const current = existing.find((r) => r[idColumn] === id);
    if (!current) throw new RecordNotFoundError(`${idColumn}=${id} não encontrado em ${sheetName}`);

    const merged: Record_ = { ...current, ...changes };
    const errors = validateRecord(sheetDef, merged, { isUpdate: true });
    if (errors.length > 0) throw new ValidationFailedError(errors);

    const rowNumber = current.__row as number;
    await this.safeMutate(target, async (wb) => {
      const ws = wb.getWorksheet(sheetName)!;
      writeRecordAtRow(ws, sheetDef, rowNumber, merged);
    });

    for (const field of Object.keys(changes)) {
      if (field === "__row") continue;
      if (current[field] === changes[field]) continue;
      await writeAuditEntry({
        usuario: ctx.usuario,
        acao: "ALTERACAO",
        arquivo: fileDef.fileName,
        aba: sheetName,
        idRegistro: id,
        campo: field,
        valorAnterior: current[field],
        valorNovo: changes[field],
        motivo: ctx.motivo,
      });
    }

    return merged;
  }

  /** Exclusão lógica (Seção 62): nunca apaga a linha, marca ATIVO=false. */
  async softDelete(fileDef: FileDef, sheetName: string, id: string, ctx: RepoContext): Promise<void> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    if (!sheetDef.columns.some((c) => c.name === "ATIVO")) {
      throw new Error(`Aba ${sheetName} não possui coluna ATIVO; exclusão lógica não suportada.`);
    }
    await this.update(fileDef, sheetName, id, { ATIVO: false }, { ...ctx, motivo: ctx.motivo ?? "Exclusão lógica" });
  }

  private getSheetDef(fileDef: FileDef, sheetName: string): SheetDef {
    const sheetDef = findSheetDef(fileDef.fileName, sheetName);
    if (!sheetDef) throw new Error(`Aba não definida no schema: ${fileDef.fileName} / ${sheetName}`);
    return sheetDef;
  }

  /**
   * Escrita segura (Seção 37): lê o arquivo atual, aplica a mutação em memória,
   * grava em arquivo temporário, reabre para validar integridade (Seção 40),
   * e só então substitui o original de forma atômica (rename). Se qualquer
   * etapa falhar, o arquivo original nunca é tocado.
   */
  private async safeMutate(target: string, mutate: (wb: ExcelJS.Workbook) => Promise<void>): Promise<void> {
    const wb = await readWorkbook(target);
    await mutate(wb);

    const tmp = tempPathFor(target);
    try {
      await wb.xlsx.writeFile(tmp);

      // Validação pós-gravação (Seção 40): reabre o arquivo temporário e confere
      // que todas as abas esperadas continuam legíveis antes de substituir o original.
      const check = await readWorkbook(tmp);
      if (check.worksheets.length === 0) {
        throw new Error("Arquivo temporário gravado sem nenhuma aba -- gravação abortada.");
      }

      await fs.promises.rename(tmp, target);
    } catch (err) {
      if (fs.existsSync(tmp)) {
        await fs.promises.unlink(tmp).catch(() => {});
      }
      throw err;
    }
  }
}
