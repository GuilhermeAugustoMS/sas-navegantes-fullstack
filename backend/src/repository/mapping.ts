import { Prisma } from "@prisma/client";
import type { FileDef, Record_, SheetDef } from "../types/schema.js";

/**
 * Conversão entre o Record_ (valores JS puros: string/number/boolean/Date)
 * que o resto da aplicação usa e o formato que o Prisma Client espera/
 * devolve (Decimal em vez de number). Compartilhado entre PostgresRepository
 * e o script de migração (migrateToPostgres.ts) -- nenhum dos dois deve
 * reimplementar essa conversão por conta própria.
 */

// Colisão de nome de modelo Prisma (ver comentário no topo de
// prisma/schema.prisma): as 4 cópias dormentes do módulo "configuracoes".
const MODEL_ACCESSOR_OVERRIDES: Record<string, string> = {
  "06_CONFIGURACOES.xlsx::TiposReceita": "configuracoesTiposReceita",
  "06_CONFIGURACOES.xlsx::TiposDespesa": "configuracoesTiposDespesa",
  "06_CONFIGURACOES.xlsx::FormasPagamento": "configuracoesFormasPagamento",
  "06_CONFIGURACOES.xlsx::CentrosCusto": "configuracoesCentrosCusto",
};

export function modelAccessor(fileDef: FileDef, sheetName: string): string {
  const override = MODEL_ACCESSOR_OVERRIDES[`${fileDef.fileName}::${sheetName}`];
  if (override) return override;
  return sheetName.charAt(0).toLowerCase() + sheetName.slice(1);
}

export function decimalToNumber(value: unknown): number {
  if (value && typeof value === "object" && "toNumber" in (value as any)) {
    return (value as Prisma.Decimal).toNumber();
  }
  return Number(value);
}

export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Converte uma linha do Prisma (Decimal/Date nativos) para o Record_ (número/Date JS puro) que o resto da aplicação espera. */
export function fromDb(sheetDef: SheetDef, row: Record<string, unknown>): Record_ {
  const rec: Record_ = {};
  for (const col of sheetDef.columns) {
    const value = row[col.name];
    if (value === null || value === undefined) {
      rec[col.name] = null;
      continue;
    }
    rec[col.name] = col.type === "number" ? decimalToNumber(value) : (value as any);
  }
  return rec;
}

/** Converte um Record_ (parcial ou completo) para o formato que o Prisma Client espera em `data`. */
export function toDbData(sheetDef: SheetDef, record: Record_): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const col of sheetDef.columns) {
    if (!(col.name in record)) continue;
    const value = record[col.name];
    if (value === undefined) continue;
    if (value === null) {
      data[col.name] = null;
      continue;
    }
    data[col.name] = col.type === "date" && !(value instanceof Date) ? new Date(String(value)) : value;
  }
  return data;
}
