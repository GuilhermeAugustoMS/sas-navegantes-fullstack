import type { Record_, SheetDef } from "../types/schema.js";

/**
 * IDs estáveis, únicos, permanentes, independentes do nome (Seção 9).
 * Estratégia: maior sufixo numérico já usado na aba + 1, formatado com 6 dígitos.
 * Nunca reaproveita ID de um registro existente, mesmo que ele tenha sido inativado.
 */
export function nextId(sheetDef: SheetDef, existingRecords: Record_[]): string {
  if (!sheetDef.idPrefix) {
    throw new Error(`Aba ${sheetDef.name} não possui idPrefix configurado.`);
  }
  const idColumn = sheetDef.columns.find((c) => c.isId)?.name;
  if (!idColumn) {
    throw new Error(`Aba ${sheetDef.name} não possui coluna marcada como isId.`);
  }
  let max = 0;
  const re = new RegExp(`^${sheetDef.idPrefix}_(\\d+)$`);
  for (const rec of existingRecords) {
    const v = rec[idColumn];
    if (typeof v !== "string") continue;
    const m = re.exec(v);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return `${sheetDef.idPrefix}_${String(next).padStart(6, "0")}`;
}
