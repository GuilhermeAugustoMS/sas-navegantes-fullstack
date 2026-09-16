import type { NextFunction, Request, Response } from "express";
import { ValidationFailedError, RecordNotFoundError } from "../../repository/Repository.js";
import { BusinessRuleError } from "../../services/CrudService.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationFailedError) {
    res.status(400).json({ error: "VALIDACAO", detalhes: err.errors });
    return;
  }
  if (err instanceof BusinessRuleError) {
    res.status(422).json({ error: "REGRA_DE_NEGOCIO", detalhes: err.errors });
    return;
  }
  if (err instanceof RecordNotFoundError) {
    res.status(404).json({ error: "NAO_ENCONTRADO", mensagem: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "ERRO_INTERNO", mensagem: err instanceof Error ? err.message : String(err) });
}

export function notFoundResource(_req: Request, res: Response) {
  res.status(404).json({ error: "RECURSO_INEXISTENTE", mensagem: "Este recurso de cadastro não está definido." });
}
