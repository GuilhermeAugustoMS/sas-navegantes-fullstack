import { AUDITORIA, findSheetDef } from "../schema/files.js";
import { filePath } from "../config/paths.js";
import { appendRecord, readWorkbook, tempPathFor } from "./workbookIO.js";
import fs from "node:fs";

export interface AuditEntry {
  usuario: string;
  acao: "CRIACAO" | "ALTERACAO" | "EXCLUSAO_LOGICA" | "RESTAURACAO";
  arquivo: string;
  aba: string;
  idRegistro?: string;
  campo?: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  motivo?: string;
}

let nextLogSeq: number | null = null;

/**
 * Grava uma linha em 07_AUDITORIA.xlsx / LogsAlteracoes (Seção 15/44).
 * Não passa pelo ExcelRepository de propósito: auditar a própria escrita da
 * auditoria criaria recursão. É a única gravação do sistema com esse atalho.
 */
export async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  const target = filePath(AUDITORIA.fileName);
  if (!fs.existsSync(target)) return; // auditoria ainda não inicializada (ex.: seed em andamento)

  const sheetDef = findSheetDef(AUDITORIA.fileName, "LogsAlteracoes")!;

  const wb = await readWorkbook(target);
  const ws = wb.getWorksheet("LogsAlteracoes")!;

  if (nextLogSeq === null) {
    nextLogSeq = ws.rowCount; // aproximação: linhas existentes + 1 já é > cabeçalho
  }
  nextLogSeq += 1;
  const id = `LOG_${String(nextLogSeq).padStart(6, "0")}`;

  const now = new Date();
  appendRecord(ws, sheetDef, {
    ID_LOG: id,
    DATA: now,
    HORA: now.toTimeString().slice(0, 8),
    USUARIO: entry.usuario,
    ACAO: entry.acao,
    ARQUIVO: entry.arquivo,
    ABA: entry.aba,
    ID_REGISTRO: entry.idRegistro ?? "",
    CAMPO: entry.campo ?? "",
    VALOR_ANTERIOR: entry.valorAnterior === undefined ? "" : String(entry.valorAnterior),
    VALOR_NOVO: entry.valorNovo === undefined ? "" : String(entry.valorNovo),
    MOTIVO: entry.motivo ?? "",
  });

  const tmp = tempPathFor(target);
  await wb.xlsx.writeFile(tmp);
  await fs.promises.rename(tmp, target);
}
