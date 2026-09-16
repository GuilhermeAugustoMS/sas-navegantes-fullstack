import { Router } from "express";
import type { Repository } from "../../repository/Repository.js";
import { CrudService } from "../../services/CrudService.js";
import type { ResourceDef } from "../resourceTypes.js";
import { makeCrudController } from "../controllers/crudController.js";
import { findSheetDef } from "../../schema/files.js";

/**
 * Router REST genérico (Seção 47): monta as rotas CRUD para qualquer lista
 * de ResourceDef, de qualquer módulo (Cadastros, Comercial, Financeiro, ...).
 * Deixou de ser específico de Cadastros — o módulo agora é só o array de
 * ResourceDef passado por quem monta o app (app.ts).
 */
export function crudRouter(repo: Repository, resources: ResourceDef[]): Router {
  const router = Router();
  const service = new CrudService(repo);

  for (const resource of resources) {
    const controller = makeCrudController(service, resource);
    const base = `/${resource.slug}`;

    router.get(base, controller.list);
    router.get(`${base}/:id`, controller.get);
    router.post(base, controller.create);
    router.put(`${base}/:id`, controller.update);
    router.delete(`${base}/:id`, controller.remove);
  }

  return router;
}

/**
 * Catálogo de recursos + colunas (Seção 6, "mapa de conversão"), para a tela
 * se montar dinamicamente a partir do schema real do backend, em vez de
 * reimplementar campos à mão no frontend (fonte única de verdade).
 * `apiBase` é incluído para o frontend saber por qual prefixo de rota
 * (/api/cadastros, /api/comercial, ...) cada recurso deste módulo é servido.
 */
export function resourceCatalog(resources: ResourceDef[], apiBase: string) {
  return resources.map((r) => {
    const sheetDef = findSheetDef(r.file.fileName, r.sheetName)!;
    const idColumn = sheetDef.columns.find((c) => c.isId)!;
    return {
      slug: r.slug,
      apiBase,
      aba: r.sheetName,
      arquivo: r.file.fileName,
      label: r.label,
      idField: idColumn.name,
      foreignKeys: (r.foreignKeys ?? []).map((fk) => ({ field: fk.field, targetSheet: fk.targetSheet })),
      // Coluna de ID incluída (com isId:true) para o frontend saber a chave de
      // cada linha e montar links de FK, mas o form de edição a ignora (é gerada pelo backend).
      colunas: sheetDef.columns
        .filter((c) => !(r.hiddenColumns ?? []).includes(c.name))
        .map((c) => ({
          nome: c.name,
          tipo: c.type,
          obrigatorio: Boolean(c.required),
          valoresPermitidos: c.enumValues ?? null,
          isId: Boolean(c.isId),
        })),
    };
  });
}
