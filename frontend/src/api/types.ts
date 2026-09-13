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
