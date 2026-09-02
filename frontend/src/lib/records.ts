import type { RecordRow, ResourceDef } from "../api/types";

/** Rótulo amigável para exibir um registro em dropdowns/tabelas (ex.: em vez do ID cru). */
export function displayLabel(row: RecordRow): string {
  if (typeof row.NOME === "string" && row.NOME.trim()) return row.NOME;
  const firstText = Object.entries(row).find(([k, v]) => k !== "ATIVO" && !k.startsWith("ID_") && typeof v === "string" && v.trim());
  if (firstText) return String(firstText[1]);
  return JSON.stringify(row);
}

export function emptyRecordFor(colunas: { nome: string; tipo: string }[]): RecordRow {
  const rec: RecordRow = {};
  for (const c of colunas) {
    if (c.tipo === "boolean") rec[c.nome] = true; // novos cadastros nascem ativos por padrão
    else rec[c.nome] = "";
  }
  return rec;
}

/**
 * Nem toda aba usa exclusão lógica (Seção 62): registros puramente
 * transacionais do Comercial (Negociações, Propostas, Itens de Proposta,
 * Matrículas, Rematrículas, Follow-Ups) não têm coluna ATIVO por design --
 * não fazem sentido "inativar". A tela usa isso para esconder o filtro de
 * inativos, a coluna Status e o botão Inativar nesses casos.
 */
export function hasAtivo(resource: ResourceDef): boolean {
  return resource.colunas.some((c) => c.nome === "ATIVO");
}
