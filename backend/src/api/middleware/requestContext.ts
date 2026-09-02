import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    usuario: string;
  }
}

/**
 * Placeholder até a Fase 2 (Autenticação/Permissões) existir: por ora, o
 * "usuário" vem de um header simples, só para a auditoria (Seção 44) já
 * registrar quem fez o quê. Isso NÃO é autenticação e não deve ser tratado
 * como tal -- é um ponto explícito para trocar por sessão/JWT na Fase 2.
 */
export function requestContext(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("x-usuario");
  req.usuario = header && header.trim().length > 0 ? header.trim() : "sistema";
  next();
}
