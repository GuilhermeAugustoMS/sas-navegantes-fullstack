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
  /**
   * Nomes de colunas que existem na aba mas não devem aparecer no catálogo
   * genérico (logo, nem na tabela/formulário de CRUD genérico do frontend) —
   * para campos que têm uma tela dedicada própria (ex.: Propostas.PERCENTUAL_DESCONTO,
   * só editável via PropostaSimulacaoPanel). Não afeta a leitura/escrita real
   * do dado: a coluna continua existindo na aba e nas rotas dedicadas.
   */
  hiddenColumns?: string[];
}

export function findResourceIn(resources: ResourceDef[], slug: string): ResourceDef | undefined {
  return resources.find((r) => r.slug === slug);
}
