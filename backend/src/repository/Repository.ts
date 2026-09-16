import type { FileDef, Record_ } from "../types/schema.js";

/**
 * Contrato único de acesso a dados (Seção 57: troca de persistência sem
 * reescrever a aplicação). ExcelRepository e PostgresRepository implementam
 * esta interface; CrudService e as rotas dedicadas (propostaGenerator,
 * alunoResponsavelGuard) só dependem dela, nunca da implementação concreta.
 *
 * Os parâmetros continuam sendo FileDef/sheetName (não um nome de tabela
 * Postgres) de propósito: é o mesmo vocabulário que resourceTypes.ts,
 * schema/files.ts e todas as rotas já usam hoje -- trocar exigiria mudar
 * toda chamada existente, o que o usuário não pediu ("só trocar onde os
 * dados são lidos/gravados").
 */
export interface RepoContext {
  usuario: string;
  motivo?: string;
}

export class ValidationFailedError extends Error {
  constructor(public errors: { field: string; problem: string }[]) {
    super(`Validação falhou: ${errors.map((e) => `${e.field}: ${e.problem}`).join("; ")}`);
  }
}

export class RecordNotFoundError extends Error {}

export interface Repository {
  /** Garante que a estrutura (aba/tabela) exista. No Postgres, é resolvido pelas migrations do Prisma -- vira no-op. */
  ensureFile(fileDef: FileDef): Promise<void>;

  readAll(fileDef: FileDef, sheetName: string): Promise<Record_[]>;

  query(fileDef: FileDef, sheetName: string, predicate: (r: Record_) => boolean): Promise<Record_[]>;

  findById(fileDef: FileDef, sheetName: string, id: string): Promise<Record_ | undefined>;

  insert(fileDef: FileDef, sheetName: string, data: Record_, ctx: RepoContext): Promise<Record_>;

  update(fileDef: FileDef, sheetName: string, id: string, changes: Record_, ctx: RepoContext): Promise<Record_>;

  softDelete(fileDef: FileDef, sheetName: string, id: string, ctx: RepoContext): Promise<void>;
}
