import { CADASTROS, COMERCIAL } from "../schema/files.js";
import type { ResourceDef } from "./resourceTypes.js";

/**
 * Recursos do módulo Comercial (04_COMERCIAL.xlsx). Várias FKs aqui apontam
 * para 01_CADASTROS.xlsx (Alunos, Series, Equipes, AnosLetivos) — validadas
 * cross-arquivo pelo CrudService via ForeignKey.targetFile.
 *
 * Negociacoes, Propostas, ItensProposta, Matriculas, Rematriculas e
 * FollowUps são puramente transacionais e NÃO têm coluna ATIVO (sem
 * exclusão lógica por design — ver checkpoint da extensão Comercial).
 */
export const COMERCIAL_RESOURCES: ResourceDef[] = [
  { slug: "origens", file: COMERCIAL, sheetName: "Origens", label: "Origens" },
  { slug: "status-negociacao", file: COMERCIAL, sheetName: "StatusNegociacao", label: "Status de Negociação" },
  {
    slug: "leads",
    file: COMERCIAL,
    sheetName: "Leads",
    label: "Leads",
    foreignKeys: [{ field: "ID_ORIGEM", targetSheet: "Origens" }],
  },
  {
    slug: "negociacoes",
    file: COMERCIAL,
    sheetName: "Negociacoes",
    label: "Negociações",
    foreignKeys: [
      { field: "ID_LEAD", targetSheet: "Leads" },
      { field: "ID_ALUNO", targetSheet: "Alunos", targetFile: CADASTROS },
      { field: "ID_SERIE", targetSheet: "Series", targetFile: CADASTROS },
      { field: "ID_STATUS_NEGOCIACAO", targetSheet: "StatusNegociacao" },
      { field: "ID_EQUIPE", targetSheet: "Equipes", targetFile: CADASTROS },
    ],
  },
  {
    slug: "propostas",
    file: COMERCIAL,
    sheetName: "Propostas",
    label: "Propostas",
    foreignKeys: [{ field: "ID_NEGOCIACAO", targetSheet: "Negociacoes" }],
    // Editável só pelo painel de simulação (PropostaSimulacaoPanel.tsx) --
    // não deve aparecer na tela de CRUD genérico de Propostas.
    hiddenColumns: [
      "PERCENTUAL_DESCONTO",
      "PERCENTUAL_DESCONTO_ENTRADA",
      "DATA_PAGAMENTO_ENTRADA",
      "QUANTIDADE_PARCELAS_MATERIAL_INGLES",
    ],
  },
  {
    slug: "itens-proposta",
    file: COMERCIAL,
    sheetName: "ItensProposta",
    label: "Itens de Proposta",
    foreignKeys: [{ field: "ID_PROPOSTA", targetSheet: "Propostas" }],
  },
  {
    slug: "matriculas",
    file: COMERCIAL,
    sheetName: "Matriculas",
    label: "Matrículas",
    foreignKeys: [
      { field: "ID_ALUNO", targetSheet: "Alunos", targetFile: CADASTROS },
      { field: "ID_PROPOSTA", targetSheet: "Propostas" },
      { field: "ID_ANO_LETIVO", targetSheet: "AnosLetivos", targetFile: CADASTROS },
    ],
  },
  {
    slug: "rematriculas",
    file: COMERCIAL,
    sheetName: "Rematriculas",
    label: "Rematrículas",
    foreignKeys: [
      { field: "ID_ALUNO", targetSheet: "Alunos", targetFile: CADASTROS },
      { field: "ID_ANO_LETIVO", targetSheet: "AnosLetivos", targetFile: CADASTROS },
    ],
  },
  {
    slug: "follow-ups",
    file: COMERCIAL,
    sheetName: "FollowUps",
    label: "Follow-Ups",
    foreignKeys: [{ field: "ID_NEGOCIACAO", targetSheet: "Negociacoes" }],
  },
  {
    // Gerado pelo Gerador de Proposta (motor de cálculo) -- ver
    // src/calc/propostaEngine.ts e routes/propostaGenerator.routes.ts.
    // Exposto como CRUD genérico também (leitura/ajuste manual), mas o
    // fluxo normal é criar via POST /api/comercial/propostas/:id/parcelas.
    slug: "parcelas-proposta",
    file: COMERCIAL,
    sheetName: "ParcelasProposta",
    label: "Parcelas de Proposta",
    foreignKeys: [{ field: "ID_PROPOSTA", targetSheet: "Propostas" }],
  },
];
