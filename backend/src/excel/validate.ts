import type { Record_, SheetDef } from "../types/schema.js";

export interface ValidationError {
  field: string;
  problem: string;
}

/**
 * Validação de estrutura e tipos (Seção 40): campos obrigatórios, tipos, domínios (enum).
 * Roda antes de gravar (na escrita) e é reaproveitada pelo relatório de inconsistências (Seção 64).
 */
export function validateRecord(sheetDef: SheetDef, record: Record_, opts: { isUpdate?: boolean } = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const col of sheetDef.columns) {
    const value = record[col.name];
    const isMissing = value === undefined || value === null || value === "";

    if (col.required && isMissing) {
      // Em update parcial, campo ausente do payload não é erro; campo explicitamente
      // limpo (null/"") em coluna obrigatória é erro.
      if (!(opts.isUpdate && !(col.name in record))) {
        errors.push({ field: col.name, problem: "Campo obrigatório vazio" });
      }
      continue;
    }
    if (isMissing) continue;

    switch (col.type) {
      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) {
          errors.push({ field: col.name, problem: `Esperado número, recebido ${typeof value}` });
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          errors.push({ field: col.name, problem: `Esperado booleano, recebido ${typeof value}` });
        }
        break;
      case "date":
        if (!(value instanceof Date) && Number.isNaN(Date.parse(String(value)))) {
          errors.push({ field: col.name, problem: `Esperada data válida, recebido ${String(value)}` });
        }
        break;
      case "enum":
        if (col.enumValues && !col.enumValues.includes(String(value))) {
          errors.push({ field: col.name, problem: `Valor "${value}" fora do domínio permitido (${col.enumValues.join(", ")})` });
        }
        break;
      case "text":
      default:
        if (col.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
          errors.push({ field: col.name, problem: "Email inválido (esperado formato nome@dominio.com)" });
        } else if (col.format === "telefone" && ![10, 11].includes(String(value).replace(/\D/g, "").length)) {
          errors.push({ field: col.name, problem: "Telefone inválido (esperado DDD + número, 10 ou 11 dígitos)" });
        }
        break;
    }
  }
  return errors;
}
