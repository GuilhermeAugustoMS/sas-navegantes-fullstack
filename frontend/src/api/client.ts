import type { ApiErrorBody, GerarParcelasInput, ParcelaProposta, RecordRow, ResourceDef } from "./types";

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
  { key: "financeiro", label: "Financeiro", apiBase: "/api/financeiro" },
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

  // Gerador de Proposta (Seção 22) -- rota dedicada, não é CRUD genérico.
  simularParcelas: (propostaId: string, input: GerarParcelasInput) =>
    request<{ parcelas: ParcelaProposta[]; valorTotalMes: number }>(
      `/api/comercial/propostas/${propostaId}/parcelas?preview=true`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  gerarParcelas: (propostaId: string, input: GerarParcelasInput, usuario: string) =>
    request<{ parcelas: ParcelaProposta[]; valorTotalMes: number }>(
      `/api/comercial/propostas/${propostaId}/parcelas`,
      { method: "POST", body: JSON.stringify(input) },
      usuario,
    ),

  listarParcelas: (propostaId: string) => request<ParcelaProposta[]>(`/api/comercial/propostas/${propostaId}/parcelas`),
};
