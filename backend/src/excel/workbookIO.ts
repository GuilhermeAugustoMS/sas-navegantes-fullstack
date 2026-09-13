import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import type { FileDef, Record_, SheetDef } from "../types/schema.js";

/**
 * Camada mais baixa de leitura/escrita de .xlsx (Seção 45/49 do prompt mestre):
 * abas tabulares, primeira linha = cabeçalho, linhas seguintes = registros,
 * sem células mescladas, sem fórmulas misturadas com dados.
 */

export function buildWorkbookFromDef(fileDef: FileDef): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sas Navegantes SaaS";
  wb.created = new Date();
  for (const sheet of fileDef.sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.addRow(sheet.columns.map((c) => c.name));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return wb;
}

export async function readWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

/**
 * Nomes das colunas físicas da aba, indexados pela posição real da coluna
 * (1-based) -- nunca pela ordem do schema. Colunas são sempre resolvidas por
 * NOME, nunca por posição fixa: o schema pode ganhar colunas novas (Seção 59)
 * depois que o arquivo físico já existia, e nesse caso a coluna nova só
 * aparece no fim do cabeçalho físico (ver ExcelRepository.ensureFile), fora
 * de ordem em relação ao schema.
 */
function nomesDasColunas(ws: ExcelJS.Worksheet): string[] {
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });
  return headers;
}

export function sheetToRecords(ws: ExcelJS.Worksheet, sheetDef: SheetDef): Record_[] {
  const headers = nomesDasColunas(ws);

  const records: Record_[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (row.actualCellCount === 0) continue;
    const rec: Record_ = {};
    let hasAny = false;
    for (const col of sheetDef.columns) {
      const colIndex = headers.indexOf(col.name);
      if (colIndex === -1) continue;
      const cell = row.getCell(colIndex);
      let value: any = cell.value;
      if (value && typeof value === "object" && "result" in value) {
        value = (value as any).result; // fórmula: usar valor calculado
      }
      if (value !== null && value !== undefined && value !== "") hasAny = true;
      rec[col.name] = value ?? null;
    }
    if (hasAny) {
      rec.__row = r; // posição física, uso interno do repositório
      records.push(rec);
    }
  }
  return records;
}

export function appendRecord(ws: ExcelJS.Worksheet, sheetDef: SheetDef, record: Record_): void {
  const headers = nomesDasColunas(ws);
  const row = ws.getRow(ws.rowCount + 1);
  for (const c of sheetDef.columns) {
    const colIndex = headers.indexOf(c.name);
    if (colIndex === -1) continue; // coluna do schema ainda não existe fisicamente
    row.getCell(colIndex).value = toCellValue(record[c.name]);
  }
  row.commit();
}

export function writeRecordAtRow(ws: ExcelJS.Worksheet, sheetDef: SheetDef, rowNumber: number, record: Record_): void {
  const headers = nomesDasColunas(ws);
  const row = ws.getRow(rowNumber);
  for (const c of sheetDef.columns) {
    const colIndex = headers.indexOf(c.name);
    if (colIndex === -1) continue;
    row.getCell(colIndex).value = toCellValue(record[c.name]);
  }
  row.commit();
}

function toCellValue(v: unknown): ExcelJS.CellValue {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v;
  return String(v);
}

export async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true });
}

export function tempPathFor(target: string): string {
  const dir = path.dirname(target);
  const base = path.basename(target);
  return path.join(dir, `.${base}.tmp-${process.pid}-${Date.now()}`);
}
