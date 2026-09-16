import express from "express";
import cors from "cors";
import type { Repository } from "../repository/Repository.js";
import { PostgresRepository } from "../repository/PostgresRepository.js";
import { getPrismaClient } from "../repository/prismaClient.js";
import { requestContext } from "./middleware/requestContext.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { crudRouter, resourceCatalog } from "./routes/genericCrud.routes.js";
import { propostaGeneratorRouter } from "./routes/propostaGenerator.routes.js";
import { alunoResponsavelGuardRouter } from "./routes/alunoResponsavelGuard.routes.js";
import { CADASTROS_RESOURCES } from "./cadastrosResources.js";
import { COMERCIAL_RESOURCES } from "./comercialResources.js";
import { FINANCEIRO_RESOURCES } from "./financeiroResources.js";

export interface AppDeps {
  repo?: Repository;
}

export async function createApp(deps: AppDeps = {}) {
  // Seção 57: Postgres é a persistência real (via Prisma) desde 2026-09-16.
  // ExcelRepository continua no código só como base para uma futura
  // exportação (Seção 35), sem uso em produção -- ver repository/Repository.ts.
  const repo = deps.repo ?? new PostgresRepository(getPrismaClient());

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestContext);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/cadastros/_catalogo", (_req, res) => res.json(resourceCatalog(CADASTROS_RESOURCES, "/api/cadastros")));
  // Guarda de regra de negócio (Aluno exige Responsável Financeiro pra ser
  // editado) ANTES do crudRouter genérico, mesmo padrão do propostaGeneratorRouter.
  app.use("/api/cadastros", alunoResponsavelGuardRouter(repo));
  app.use("/api/cadastros", crudRouter(repo, CADASTROS_RESOURCES));

  app.get("/api/comercial/_catalogo", (_req, res) => res.json(resourceCatalog(COMERCIAL_RESOURCES, "/api/comercial")));
  // Rotas dedicadas do Gerador de Proposta (Seção 22) ANTES do crudRouter genérico,
  // já que ambas montam sob /propostas/:id -- a mais específica precisa vir primeiro.
  app.use("/api/comercial", propostaGeneratorRouter(repo));
  app.use("/api/comercial", crudRouter(repo, COMERCIAL_RESOURCES));

  app.get("/api/financeiro/_catalogo", (_req, res) => res.json(resourceCatalog(FINANCEIRO_RESOURCES, "/api/financeiro")));
  app.use("/api/financeiro", crudRouter(repo, FINANCEIRO_RESOURCES));

  app.use(errorHandler);

  return app;
}
