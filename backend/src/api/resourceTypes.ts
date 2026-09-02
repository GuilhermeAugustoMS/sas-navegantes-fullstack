import type { FileDef } from "../types/schema.js";

/**
 * Tipos compartilhados de definição de recurso REST (Seção 47/48).
 * Um ResourceDef não pertence mais só a Cadastros: cada módulo (Cadastros,
 * Comercial, Financeiro, ...) declara seu próprio array de ResourceDef,
 * cada um apontando para o FileDef/aba de onde vêm os dados.
 */
export interface ForeignKey {
  field: string;
  targetSheet: string;
  /** Arquivo onde a aba de destino vive. Omitir quando o alvo está no mesmo arquivo do próprio recurso. */
  targetFile?: FileDef;
}

export interface ResourceDef {
  slug: string;
  /** Arquivo .xlsx onde a aba deste recurso vive. */
  file: FileDef;
  sheetName: string;
  /** Nome amigável em português, para a tela (sidebar, títulos). */
  label: string;
  /** Chaves estrangeiras validadas pelo Service antes de gravar (Seção 40, integridade) — podem apontar para outro arquivo. */
  foreignKeys?: ForeignKey[];
}

export function findResourceIn(resources: ResourceDef[], slug: string): ResourceDef | undefined {
  return resources.find((r) => r.slug === slug);
}
