import type { Request, Response, NextFunction } from "express";
import type { CrudService } from "../../services/CrudService.js";
import type { ResourceDef } from "../resourceTypes.js";
import type { Record_ } from "../../types/schema.js";

function paramId(req: Request): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

/** Controller genérico (Seção 47): recebe HTTP, delega ao Service, devolve JSON. Sem regra de negócio aqui. */
export function makeCrudController(service: CrudService, resource: ResourceDef) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const filters = { ...req.query } as Record<string, string>;
        const rows = await service.list(resource, filters);
        res.json(rows.map(stripInternal));
      } catch (err) {
        next(err);
      }
    },

    async get(req: Request, res: Response, next: NextFunction) {
      try {
        const row = await service.get(resource, paramId(req));
        if (!row) {
          res.status(404).json({ error: "NAO_ENCONTRADO", mensagem: `${resource.slug}/${paramId(req)} não existe.` });
          return;
        }
        res.json(stripInternal(row));
      } catch (err) {
        next(err);
      }
    },

    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const created = await service.create(resource, coerceDates(req.body) as Record_, { usuario: req.usuario });
        res.status(201).json(stripInternal(created));
      } catch (err) {
        next(err);
      }
    },

    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const updated = await service.update(resource, paramId(req), coerceDates(req.body) as Record_, { usuario: req.usuario });
        res.json(stripInternal(updated));
      } catch (err) {
        next(err);
      }
    },

    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        await service.softDelete(resource, paramId(req), { usuario: req.usuario, motivo: req.body?.motivo });
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

function stripInternal(rec: Record<string, unknown>) {
  const { __row, ...rest } = rec;
  return rest;
}

/** Campos de data chegam como string ISO no JSON; o schema espera Date. */
function coerceDates(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v))) {
      out[k] = new Date(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
