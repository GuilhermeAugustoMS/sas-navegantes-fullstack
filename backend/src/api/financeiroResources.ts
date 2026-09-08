import { CADASTROS, FINANCEIRO } from "../schema/files.js";
import type { ResourceDef } from "./resourceTypes.js";

/**
 * Recursos do módulo Financeiro (02_FINANCEIRO.xlsx). `formas-pagamento` e
 * `tabela-precos` alimentam diretamente o Gerador de Proposta do Comercial
 * (fk cross-arquivo: TabelaPrecos.ID_SERIE -> Alunos/Series em Cadastros).
 */
export const FINANCEIRO_RESOURCES: ResourceDef[] = [
  { slug: "tipos-receita", file: FINANCEIRO, sheetName: "TiposReceita", label: "Tipos de Receita" },
  { slug: "tipos-despesa", file: FINANCEIRO, sheetName: "TiposDespesa", label: "Tipos de Despesa" },
  { slug: "formas-pagamento", file: FINANCEIRO, sheetName: "FormasPagamento", label: "Formas de Pagamento" },
  {
    slug: "tabela-precos",
    file: FINANCEIRO,
    sheetName: "TabelaPrecos",
    label: "Tabela de Preços",
    foreignKeys: [{ field: "ID_SERIE", targetSheet: "Series", targetFile: CADASTROS }],
  },
  { slug: "programas-extras", file: FINANCEIRO, sheetName: "ProgramasExtras", label: "Programas Extras" },
  {
    slug: "receitas",
    file: FINANCEIRO,
    sheetName: "Receitas",
    label: "Receitas",
    foreignKeys: [
      { field: "ID_ALUNO", targetSheet: "Alunos", targetFile: CADASTROS },
      { field: "ID_RESPONSAVEL", targetSheet: "Responsaveis", targetFile: CADASTROS },
    ],
  },
  {
    slug: "despesas",
    file: FINANCEIRO,
    sheetName: "Despesas",
    label: "Despesas",
    foreignKeys: [{ field: "ID_CENTRO_CUSTO", targetSheet: "CentrosCusto", targetFile: CADASTROS }],
  },
  {
    slug: "contas-pagar",
    file: FINANCEIRO,
    sheetName: "ContasPagar",
    label: "Contas a Pagar",
    foreignKeys: [{ field: "ID_LANCAMENTO", targetSheet: "Despesas" }],
  },
  {
    slug: "contas-receber",
    file: FINANCEIRO,
    sheetName: "ContasReceber",
    label: "Contas a Receber",
    foreignKeys: [{ field: "ID_LANCAMENTO", targetSheet: "Receitas" }],
  },
  {
    slug: "movimentacoes",
    file: FINANCEIRO,
    sheetName: "Movimentacoes",
    label: "Movimentações",
  },
];
