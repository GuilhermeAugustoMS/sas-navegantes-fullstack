import { useCallback, useEffect, useState } from "react";
import { Sidebar, GERADOR_PROPOSTA_SLUG } from "../components/Sidebar";
import { DataTable } from "../components/DataTable";
import { RecordFormModal } from "../components/RecordFormModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PropostaGeneratorPage } from "./PropostaGeneratorPage";
import { useCatalog } from "../context/CatalogContext";
import { useUsuario } from "../hooks/useUsuario";
import { api, ApiError } from "../api/client";
import { hasAtivo } from "../lib/records";
import type { RecordRow } from "../api/types";

export function CrudPage() {
  const { resources, loading, error, resourceBySlug, invalidate } = useCatalog();
  const [usuario, setUsuario] = useUsuario();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [editing, setEditing] = useState<RecordRow | "novo" | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSlug && resources.length > 0) setActiveSlug(resources[0].slug);
  }, [resources, activeSlug]);

  const isGeradorProposta = activeSlug === GERADOR_PROPOSTA_SLUG;
  const resource = activeSlug && !isGeradorProposta ? resourceBySlug.get(activeSlug) ?? null : null;
  const showAtivo = resource ? hasAtivo(resource) : false;

  const loadRows = useCallback(async () => {
    if (!resource) return;
    setRowsLoading(true);
    setRowsError(null);
    try {
      const filters = !hasAtivo(resource) || showInactive ? undefined : { ativo: "true" };
      const data = await api.list(resource, filters);
      setRows(data);
    } catch (err) {
      setRowsError(err instanceof Error ? err.message : "Não foi possível carregar os registros.");
    } finally {
      setRowsLoading(false);
    }
  }, [resource, showInactive]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDeleteConfirmed() {
    if (!resource || !deleting) return;
    try {
      await api.remove(resource, String(deleting[resource.idField]), usuario);
      setToast(`${resource.label.replace(/s$/, "")} inativado(a) com sucesso.`);
      invalidate(resource.aba);
      await loadRows();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Erro ao inativar.");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500 text-sm">Carregando catálogo do sistema...</div>;
  }

  if (error) {
    return (
      <div className="p-8 max-w-md">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          Não foi possível falar com a API ({error}). Confirme se o backend está rodando em{" "}
          <code className="text-xs">npm run dev</code> na porta configurada.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar resources={resources} activeSlug={activeSlug} onSelect={setActiveSlug} />

      <main className="flex-1 overflow-y-auto">
        {isGeradorProposta ? (
          <PropostaGeneratorPage />
        ) : (
          <>
            <header className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{resource?.label ?? "Sas Navegantes"}</h2>
                {resource && <p className="text-xs text-slate-400 font-mono">{resource.arquivo} — {resource.aba}</p>}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  Usuário:
                  <input
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 text-xs w-28"
                  />
                </label>
                {showAtivo && (
                  <label className="text-xs text-slate-600 flex items-center gap-1">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    mostrar inativos
                  </label>
                )}
                <button
                  onClick={() => setEditing("novo")}
                  className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  + Novo
                </button>
              </div>
            </header>

            <div className="p-6">
              {toast && (
                <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  {toast}
                </div>
              )}

              {rowsError && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {rowsError}
                </div>
              )}

              {rowsLoading ? (
                <p className="text-sm text-slate-500">Carregando registros...</p>
              ) : (
                resource && (
                  <DataTable
                    resource={resource}
                    rows={rows}
                    onEdit={(row) => setEditing(row)}
                    onDelete={(row) => setDeleting(row)}
                  />
                )
              )}
            </div>
          </>
        )}
      </main>

      {resource && editing && (
        <RecordFormModal
          resource={resource}
          record={editing === "novo" ? null : editing}
          usuario={usuario}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setToast("Registro salvo com sucesso.");
            invalidate(resource.aba);
            loadRows();
          }}
        />
      )}

      {resource && deleting && (
        <ConfirmDialog
          title={`Inativar registro`}
          message={`Isso marca o registro como inativo (exclusão lógica) em ${resource.aba}. O histórico é preservado. Confirmar?`}
          confirmLabel="Inativar"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
