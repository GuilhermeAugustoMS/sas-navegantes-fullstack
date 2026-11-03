export type FieldType = "text" | "number" | "date" | "boolean" | "enum";

export interface FieldDef {
  nome: string;
  tipo: FieldType;
  obrigatorio: boolean;
  valoresPermitidos: string[] | null;
  isId: boolean;
}

export interface ForeignKeyDef {
  field: string;
  targetSheet: string;
}

export interface ResourceDef {
  slug: string;
  /** Prefixo de rota do módulo dono deste recurso (ex.: "/api/cadastros", "/api/comercial"). */
  apiBase: string;
  aba: string;
  /** Nome do arquivo .xlsx onde a aba vive (ex.: "01_CADASTROS.xlsx"). */
  arquivo: string;
  label: string;
  idField: string;
  foreignKeys: ForeignKeyDef[];
  colunas: FieldDef[];
}

/** Um registro vindo do Excel: chaves em MAIUSCULO_COM_UNDERSCORE, valores já tipados pelo backend. */
export type RecordRow = Record<string, string | number | boolean | null>;

export interface ApiErrorBody {
  error: string;
  mensagem?: string;
  detalhes?: { field: string; problem: string }[];
}

/** Uma parcela calculada/persistida pelo Gerador de Proposta (ver backend src/calc/propostaEngine.ts). */
export interface ParcelaProposta {
  numeroParcela: number;
  mesReferencia: number;
  anoReferencia: number;
  valorMensalidade: number;
  valorMaterialDidatico: number;
  valorMaterialDidaticoIngles: number;
  valorAlimentacao: number;
  valorIntegral: number;
  valorSemiIntegral: number;
  valorEstendido: number;
  valorTotal: number;
}

export interface GerarParcelasInput {
  ID_FORMA_PAGAMENTO: string;
  MES_ENTRADA: number;
  DIA_ENTRADA: number;
  NECESSIDADE_ALIMENTACAO: boolean;
  CONTRATOU_INTEGRAL?: boolean;
  CONTRATOU_SEMI_INTEGRAL?: boolean;
  CONTRATOU_ESTENDIDO?: boolean;
  PERCENTUAL_DESCONTO?: number;
  /** Data em que a Entrada (1ª parcela, sempre cobrada) será paga -- obrigatória. */
  DATA_PAGAMENTO_ENTRADA: string;
  /** Desconto (0-25%) só sobre a Entrada, independente de PERCENTUAL_DESCONTO. */
  PERCENTUAL_DESCONTO_ENTRADA?: number;
  /** Quantidade de parcelas (1-4) do Material Didático de Inglês; default 4. */
  QUANTIDADE_PARCELAS_MATERIAL_INGLES?: number;
}

/** Linha por Turma do painel de Gestão de Vagas (módulo Planejamento) --
 * ver backend/src/api/routes/gestaoVagas.routes.ts. Somente-leitura,
 * calculado ao vivo a partir de Alunos/Matriculas/Rematriculas. */
export interface GestaoVagasAluno {
  idAluno: string;
  nome: string;
  status: "Matriculado" | "Rematriculado" | "Pendente";
}

export interface GestaoVagasTurma {
  idTurma: string;
  nome: string;
  idSerie: string;
  capacidadeMaxima: number;
  matriculas: number;
  rematriculas: number;
  totalPreenchido: number;
  vagasDisponiveis: number;
  percentualOcupacao: number;
  status: "Vazia" | "Com vagas" | "Quase lotada" | "Lotada";
  alunos: GestaoVagasAluno[];
}

export interface GestaoVagasResponse {
  anoLetivo: { id: string; ano: number };
  turmas: GestaoVagasTurma[];
}

/** Linha mínima de AnosLetivos (Cadastros) -- usada só pelo seletor de Ano
 * Letivo do painel de Planejamento (2026-11-02), não é um ResourceDef
 * completo de CRUD genérico. */
export interface AnoLetivoRecord {
  ID_ANO_LETIVO: string;
  ANO: number;
  ATIVO: boolean;
}

/** Linha de "Pendente de Matrícula" (módulo Planejamento) -- Proposta com
 * parcelas geradas cujo Aluno ainda não tem Matrícula/Rematrícula no Ano
 * Letivo ativo. Ver backend/src/api/routes/pendentesMatricula.routes.ts. */
export interface PendenteMatricula {
  idProposta: string;
  dataProposta: string;
  valorTotalMes: number | null;
  idAluno: string;
  nomeAluno: string;
  idNegociacao: string;
  idSerie: string;
  nomeSerie: string;
}

export interface PendentesMatriculaResponse {
  anoLetivo: { id: string; ano: number };
  pendentes: PendenteMatricula[];
}

export interface ConfirmarMatriculaResponse {
  tipo: "Matricula" | "Rematricula";
  registro: RecordRow;
}
