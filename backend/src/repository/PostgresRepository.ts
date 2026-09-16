import type { PrismaClient } from "@prisma/client";
import type { FileDef, Record_, SheetDef } from "../types/schema.js";
import { findSheetDef, AUDITORIA } from "../schema/files.js";
import { validateRecord } from "../excel/validate.js";
import { nextId } from "../util/ids.js";
import { ValidationFailedError, RecordNotFoundError, type Repository, type RepoContext } from "./Repository.js";
import { modelAccessor, fromDb, toDbData, isUniqueConstraintError } from "./mapping.js";

/**
 * Implementação de Repository (Seção 57) sobre Postgres via Prisma. Mesma
 * assinatura pública do ExcelRepository -- CrudService e as rotas dedicadas
 * (propostaGenerator, alunoResponsavelGuard) não sabem qual das duas estão
 * usando.
 *
 * `query()` continua lendo a tabela inteira e filtrando em memória com o
 * predicate JS recebido (igual ao ExcelRepository) -- mantém call sites como
 * `repo.query(CADASTROS, "ResponsaveisFinanceiros", (r) => r.ID_ALUNO === id && ...)`
 * idênticos, sem reescrever nenhuma rota. Para o volume de dados de uma
 * escola (dezenas/centenas de registros por aba), ler a tabela toda é
 * inofensivo; se algum dia isso virar gargalo, dá pra trocar por uma query
 * SQL de verdade sem mudar a interface pública.
 *
 * Modelo Prisma = nome da aba original (PascalCase), exceto as 4 colisões
 * dormentes do módulo "configuracoes" (ver prisma/schema.prisma), cobertas
 * em MODEL_ACCESSOR_OVERRIDES abaixo.
 */

interface AuditEntryInput {
  usuario: string;
  acao: "CRIACAO" | "ALTERACAO" | "EXCLUSAO_LOGICA";
  arquivo: string;
  aba: string;
  idRegistro?: string;
  campo?: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  motivo?: string;
}

export class PostgresRepository implements Repository {
  constructor(private prisma: PrismaClient) {}

  /** Schema/tabelas são gerenciados pelas migrations do Prisma (prisma/schema.prisma) -- no-op aqui de propósito. */
  async ensureFile(_fileDef: FileDef): Promise<void> {
    return;
  }

  async readAll(fileDef: FileDef, sheetName: string): Promise<Record_[]> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const delegate = this.delegateFor(fileDef, sheetName);
    const rows = await delegate.findMany();
    return rows.map((r: Record<string, unknown>) => fromDb(sheetDef, r));
  }

  async query(fileDef: FileDef, sheetName: string, predicate: (r: Record_) => boolean): Promise<Record_[]> {
    const all = await this.readAll(fileDef, sheetName);
    return all.filter(predicate);
  }

  async findById(fileDef: FileDef, sheetName: string, id: string): Promise<Record_ | undefined> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const idColumn = sheetDef.columns.find((c) => c.isId)?.name;
    if (!idColumn) throw new Error(`Aba ${sheetName} não possui coluna de ID.`);
    const delegate = this.delegateFor(fileDef, sheetName);
    const row = await delegate.findUnique({ where: { [idColumn]: id } });
    if (!row) return undefined;
    return fromDb(sheetDef, row);
  }

  async insert(fileDef: FileDef, sheetName: string, data: Record_, ctx: RepoContext): Promise<Record_> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const delegate = this.delegateFor(fileDef, sheetName);
    const idColumn = sheetDef.columns.find((c) => c.isId)?.name;

    const record: Record_ = { ...data };
    if (idColumn && !record[idColumn] && sheetDef.idPrefix) {
      const existing = await this.readAll(fileDef, sheetName);
      record[idColumn] = nextId(sheetDef, existing);
    }

    const errors = validateRecord(sheetDef, record);
    if (errors.length > 0) throw new ValidationFailedError(errors);

    try {
      await delegate.create({ data: toDbData(sheetDef, record) });
    } catch (err) {
      // Colisão rara de ID gerado concorrentemente (nextId não é serializado
      // por lock de arquivo como no Excel -- Postgres vira o backstop via
      // constraint de unicidade da PK). Tenta uma vez com um novo ID.
      if (isUniqueConstraintError(err) && idColumn) {
        const existing = await this.readAll(fileDef, sheetName);
        record[idColumn] = nextId(sheetDef, existing);
        await delegate.create({ data: toDbData(sheetDef, record) });
      } else {
        throw err;
      }
    }

    await this.writeAuditEntry({
      usuario: ctx.usuario,
      acao: "CRIACAO",
      arquivo: fileDef.fileName,
      aba: sheetName,
      idRegistro: idColumn ? String(record[idColumn]) : undefined,
      motivo: ctx.motivo,
    });

    return record;
  }

  async update(fileDef: FileDef, sheetName: string, id: string, changes: Record_, ctx: RepoContext): Promise<Record_> {
    const sheetDef = this.getSheetDef(fileDef, sheetName);
    const delegate = this.delegateFor(fileDef, sheetName);
    const idColumn = sheetDef.columns.find((c) => c.isId)?.name;
    if (!idColumn) throw new Error(`Aba ${sheetName} não possui coluna de ID.`);

    const current = await this.findById(fileDef, sheetName, id);
    if (!current) throw new RecordNotFoundError(`${idColumn}=${id} não encontrado em ${sheetName}`);

    const merged: Record_ = { ...current, ...changes };
    const errors = validateRecord(sheetDef, merged, { isUpdate: true });
    if (errors.length > 0) throw new ValidationFailedError(errors);

    await delegate.update({ where: { [idColumn]: id }, data: toDbData(sheetDef, changes) });

    for (const field of Object.keys(changes)) {
      if (current[field] === changes[field]) continue;
      await this.writeAuditEntry({
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

  private delegateFor(fileDef: FileDef, sheetName: string): any {
    const accessor = modelAccessor(fileDef, sheetName);
    const delegate = (this.prisma as any)[accessor];
    if (!delegate) throw new Error(`Nenhum modelo Prisma encontrado para ${fileDef.fileName} / ${sheetName} (accessor "${accessor}").`);
    return delegate;
  }

  private getSheetDef(fileDef: FileDef, sheetName: string): SheetDef {
    const sheetDef = findSheetDef(fileDef.fileName, sheetName);
    if (!sheetDef) throw new Error(`Aba não definida no schema: ${fileDef.fileName} / ${sheetName}`);
    return sheetDef;
  }

  /**
   * Grava uma linha em auditoria.LogsAlteracoes. Bypassa insert()/toDbData
   * de propósito (mesmo motivo do excel/audit.ts original: evitar qualquer
   * recursão, embora aqui não exista risco real já que nada nesta classe
   * chama insert() para essa tabela).
   */
  private async writeAuditEntry(entry: AuditEntryInput): Promise<void> {
    if (entry.arquivo === AUDITORIA.fileName && entry.aba === "LogsAlteracoes") return;

    const sheetDef = findSheetDef(AUDITORIA.fileName, "LogsAlteracoes")!;
    const existing = await this.readAll(AUDITORIA, "LogsAlteracoes");
    const id = nextId(sheetDef, existing);
    const now = new Date();

    await (this.prisma as any).logsAlteracoes.create({
      data: {
        ID_LOG: id,
        DATA: now,
        HORA: now.toTimeString().slice(0, 8),
        USUARIO: entry.usuario,
        ACAO: entry.acao,
        ARQUIVO: entry.arquivo,
        ABA: entry.aba,
        ID_REGISTRO: entry.idRegistro ?? null,
        CAMPO: entry.campo ?? null,
        VALOR_ANTERIOR: entry.valorAnterior === undefined ? null : String(entry.valorAnterior),
        VALOR_NOVO: entry.valorNovo === undefined ? null : String(entry.valorNovo),
        MOTIVO: entry.motivo ?? null,
      },
    });
  }
}
