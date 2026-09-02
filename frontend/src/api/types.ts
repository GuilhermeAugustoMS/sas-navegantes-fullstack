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
