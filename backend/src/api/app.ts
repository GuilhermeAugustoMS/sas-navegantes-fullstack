import express from "express";
import cors from "cors";
import { ExcelRepository } from "../excel/ExcelRepository.js";
import { ALL_FILES } from "../schema/files.js";
import { requestContext } from "./middleware/requestContext.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { crudRouter, resourceCatalog } from "./routes/genericCrud.routes.js";
import { CADASTROS_RESOURCES } from "./cadastrosResources.js";
import { COMERCIAL_RESOURCES } from "./comercialResources.js";

export interface AppDeps {
  repo?: ExcelRepository;
}

export async function createApp(deps: AppDeps = {}) {
  const repo = deps.repo ?? new ExcelRepository();

  // Garante que os 7 arquivos existem antes de aceitar requisições (idempotente).
  for (const fileDef of ALL_FILES) {
    await repo.ensureFile(fileDef);
  }

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestContext);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/cadastros/_catalogo", (_req, res) => res.json(resourceCatalog(CADASTROS_RESOURCES, "/api/cadastros")));
  app.use("/api/cadastros", crudRouter(repo, CADASTROS_RESOURCES));

  app.get("/api/comercial/_catalogo", (_req, res) => res.json(resourceCatalog(COMERCIAL_RESOURCES, "/api/comercial")));
  app.use("/api/comercial", crudRouter(repo, COMERCIAL_RESOURCES));

  app.use(errorHandler);

  return app;
}
