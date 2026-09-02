import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, MODULES } from "../api/client";
import type { RecordRow, ResourceDef } from "../api/types";

interface CatalogContextValue {
  resources: ResourceDef[];
  loading: boolean;
  error: string | null;
  resourceBySlug: Map<string, ResourceDef>;
  resourceBySheet: Map<string, ResourceDef>;
  /** Busca (com cache simples em memória) os registros de uma aba, para popular dropdowns de FK. */
  getOptions: (sheetName: string) => Promise<RecordRow[]>;
  invalidate: (sheetName: string) => void;
  reloadCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [resources, setResources] = useState<ResourceDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, RecordRow[]>>(new Map());

  const reloadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cada módulo (Cadastros, Comercial, ...) tem seu próprio catálogo;
      // a tela junta tudo em uma lista só de recursos, cada um já carregando
      // seu apiBase (Seção 47) para saber por qual rota falar com a API.
      const perModule = await Promise.all(MODULES.map((m) => api.getCatalog(m.apiBase)));
      setResources(perModule.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o catálogo de recursos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCatalog();
  }, [reloadCatalog]);

  const resourceBySlug = useMemo(() => new Map(resources.map((r) => [r.slug, r])), [resources]);
  const resourceBySheet = useMemo(() => new Map(resources.map((r) => [r.aba, r])), [resources]);

  const invalidate = useCallback((sheetName: string) => {
    setCache((prev) => {
      const next = new Map(prev);
      next.delete(sheetName);
      return next;
    });
  }, []);

  const getOptions = useCallback(
    async (sheetName: string) => {
      const cached = cache.get(sheetName);
      if (cached) return cached;

      const resource = resourceBySheet.get(sheetName);
      if (!resource) return [];

      const rows = await api.list(resource, { ativo: "true" });
      setCache((prev) => new Map(prev).set(sheetName, rows));
      return rows;
    },
    [cache, resourceBySheet],
  );

  return (
    <CatalogContext.Provider
      value={{ resources, loading, error, resourceBySlug, resourceBySheet, getOptions, invalidate, reloadCatalog }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog precisa estar dentro de <CatalogProvider>");
  return ctx;
}
