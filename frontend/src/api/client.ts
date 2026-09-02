import type { ApiErrorBody, RecordRow, ResourceDef } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

/**
 * Módulos do SaaS que expõem um catálogo de recursos REST (Seção 6/47).
 * Cada módulo é um arquivo Excel de armazenamento (Seção 7) por trás de um
 * prefixo de rota próprio. Adicionar um módulo novo (Financeiro, Orçamento,
 * Planejamento) é só acrescentar uma entrada aqui -- a tela inteira (sidebar,
 * tabela, formulário) se monta sozinha a partir do catálogo de cada um.
 */
export interface ModuleDef {
  key: string;
  label: string;
  apiBase: string;
}

export const MODULES: ModuleDef[] = [
  { key: "cadastros", label: "Cadastros", apiBase: "/api/cadastros" },
  { key: "comercial", label: "Comercial", apiBase: "/api/comercial" },
];

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.mensagem ?? body.error ?? `Erro HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}, usuario?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(usuario ? { "x-usuario": usuario } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, body ?? { error: "ERRO_DESCONHECIDO" });
  }
  return body as T;
}

export const api = {
  getCatalog: (apiBase: string) => request<ResourceDef[]>(`${apiBase}/_catalogo`),

  list: (resource: ResourceDef, filters?: Record<string, string>) => {
    const qs = filters ? `?${new URLSearchParams(filters).toString()}` : "";
    return request<RecordRow[]>(`${resource.apiBase}/${resource.slug}${qs}`);
  },

  get: (resource: ResourceDef, id: string) => request<RecordRow>(`${resource.apiBase}/${resource.slug}/${id}`),

  create: (resource: ResourceDef, data: RecordRow, usuario: string) =>
    request<RecordRow>(`${resource.apiBase}/${resource.slug}`, { method: "POST", body: JSON.stringify(data) }, usuario),

  update: (resource: ResourceDef, id: string, data: RecordRow, usuario: string) =>
    request<RecordRow>(`${resource.apiBase}/${resource.slug}/${id}`, { method: "PUT", body: JSON.stringify(data) }, usuario),

  remove: (resource: ResourceDef, id: string, usuario: string, motivo?: string) =>
    request<void>(
      `${resource.apiBase}/${resource.slug}/${id}`,
      { method: "DELETE", body: JSON.stringify({ motivo }) },
      usuario,
    ),
};
