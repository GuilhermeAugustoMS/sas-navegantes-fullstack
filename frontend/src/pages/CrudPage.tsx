import { useCallback, useEffect, useState } from "react";
import {
  Sidebar,
  GERADOR_PROPOSTA_SLUG,
  FAZER_PROPOSTA_SLUG,
  DASHBOARD_SLUG,
  moduleKeyFromMenuSlug,
} from "../components/Sidebar";
import { DataTable } from "../components/DataTable";
import { RecordFormModal } from "../components/RecordFormModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TopBar } from "../components/TopBar";
import { PropostaGeneratorPage } from "./PropostaGeneratorPage";
import { FazerPropostaPage } from "./FazerPropostaPage";
import { DashboardPage } from "./DashboardPage";
import { ModuleMenuPage } from "./ModuleMenuPage";
import { useCatalog } from "../context/CatalogContext";
import { useUsuario } from "../hooks/useUsuario";
import { api, ApiError, MODULES } from "../api/client";
import { hasAtivo } from "../lib/records";
import type { RecordRow } from "../api/types";

/** Barra mobile mínima (só o botão de abrir o menu) para as telas que não
 * usam TopBar (Fazer/Gerador de Proposta têm título e descrição próprios). */
function BarraMobile({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  return (
    <div className="md:hidden px-4 pt-3">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menu"
        className="h-9 w-9 flex items-center justify-center rounded-md text-slate-500 hover:text-brand-blue-dark hover:bg-slate-100"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function CrudPage() {
  const { resources, loading, error, resourceBySlug, invalidate } = useCatalog();
  const [usuario, setUsuario] = useUsuario();
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [editing, setEditing] = useState<RecordRow | "novo" | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSlug) setActiveSlug(DASHBOARD_SLUG);
  }, [activeSlug]);

  const isDashboard = activeSlug === DASHBOARD_SLUG;
  const isGeradorProposta = activeSlug === GERADOR_PROPOSTA_SLUG;
  const isFazerProposta = activeSlug === FAZER_PROPOSTA_SLUG;
  const activeModuleKey = activeSlug ? moduleKeyFromMenuSlug(activeSlug) : null;
  const isModuleMenu = activeModuleKey !== null;
  const resource =
    activeSlug && !isDashboard && !isGeradorProposta && !isFazerProposta && !isModuleMenu
      ? resourceBySlug.get(activeSlug) ?? null
      : null;
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
      <Sidebar
        resources={resources}
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        open={sidebarAberta}
        onClose={() => setSidebarAberta(false)}
      />

      <main className="flex-1 overflow-y-auto">
        {isDashboard ? (
          <>
            <TopBar
              title="Dashboard"
              subtitle="Visão geral do sistema"
              usuario={usuario}
              onUsuarioChange={setUsuario}
              onAbrirMenu={() => setSidebarAberta(true)}
            />
            <div className="p-6">
              <DashboardPage />
            </div>
          </>
        ) : isModuleMenu ? (
          <>
            <TopBar
              title={MODULES.find((m) => m.key === activeModuleKey)?.label ?? ""}
              usuario={usuario}
              onUsuarioChange={setUsuario}
              onAbrirMenu={() => setSidebarAberta(true)}
            />
            <div className="p-6">
              <ModuleMenuPage moduleKey={activeModuleKey!} resources={resources} onSelect={setActiveSlug} />
            </div>
          </>
        ) : isGeradorProposta ? (
          <>
            <BarraMobile onAbrirMenu={() => setSidebarAberta(true)} />
            <PropostaGeneratorPage />
          </>
        ) : isFazerProposta ? (
          <>
            <BarraMobile onAbrirMenu={() => setSidebarAberta(true)} />
            <FazerPropostaPage />
          </>
        ) : (
          <>
            <TopBar
              title={resource?.label ?? "Sas Navegantes"}
              subtitle={resource ? MODULES.find((m) => m.apiBase === resource.apiBase)?.label : undefined}
              usuario={usuario}
              onUsuarioChange={setUsuario}
              onAbrirMenu={() => setSidebarAberta(true)}
            >
              {showAtivo && (
                <label className="text-xs text-slate-600 flex items-center gap-1">
                  <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                  mostrar inativos
                </label>
              )}
              <button
                onClick={() => setEditing("novo")}
                className="px-3 py-1.5 text-sm rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark"
              >
                + Novo
              </button>
            </TopBar>

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
