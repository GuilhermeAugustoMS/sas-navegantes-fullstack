export type ColumnType = "text" | "number" | "date" | "boolean" | "enum";

export interface ColumnDef {
  name: string;
  type: ColumnType;
  required?: boolean;
  enumValues?: string[];
  /** True for the stable, permanent identifier column of the sheet (e.g. ID_ALUNO). */
  isId?: boolean;
  /** Optional format check for "text" columns, applied only when a value is present (field can still be optional). */
  format?: "email" | "telefone";
}

export interface SheetDef {
  name: string;
  /** Prefix used to generate stable IDs for this sheet, e.g. "ALU" -> ALU_000001. Omit for sheets without an own ID (pure logs, junction tables use their own compound key). */
  idPrefix?: string;
  columns: ColumnDef[];
}

export interface FileDef {
  fileName: string;
  sheets: SheetDef[];
}

export interface Record_ {
  [column: string]: string | number | boolean | Date | null | undefined;
}
