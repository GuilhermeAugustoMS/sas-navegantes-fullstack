import { useState } from "react";
import { MODULES, type ModuleDef } from "../api/client";
import type { ResourceDef } from "../api/types";

/** Slug sentinela (não é um ResourceDef real do catálogo) para a tela especial
 * do Gerador de Proposta -- ver CrudPage.tsx. */
export const GERADOR_PROPOSTA_SLUG = "__gerador-proposta__";

/** Slug sentinela para o wizard "Fazer Proposta" (Aluno/Negociação/Proposta
 * do zero numa tela só) -- ver CrudPage.tsx e FazerPropostaPage.tsx. */
export const FAZER_PROPOSTA_SLUG = "__fazer-proposta__";

interface Props {
  resources: ResourceDef[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

interface MenuItem {
  slug: string;
  label: string;
}

/**
 * Sidebar simplificada: só os grupos principais (Cadastros/Comercial/
 * Financeiro, vindos de MODULES) aparecem como botão único. Clicar abre um
 * popup (mesmo estilo visual de RecordFormModal/ConfirmDialog) listando os
 * recursos daquele módulo -- escolher um ali fecha o popup e chama onSelect
 * normalmente, exatamente como clicar direto na lateral funcionava antes.
 * Um módulo sem nenhum recurso implementado continua oculto (mesma regra de
 * antes), exceto o caso especial do Comercial (que sempre tem pelo menos o
 * wizard/gerador de proposta).
 */
export function Sidebar({ resources, activeSlug, onSelect }: Props) {
  const [openModuleKey, setOpenModuleKey] = useState<string | null>(null);

  const activeResource = resources.find((r) => r.slug === activeSlug);
  const isComercialAtivo =
    activeSlug === GERADOR_PROPOSTA_SLUG || activeSlug === FAZER_PROPOSTA_SLUG || activeResource?.apiBase === "/api/comercial";

  function isModuloAtivo(mod: ModuleDef): boolean {
    if (mod.key === "comercial") return isComercialAtivo;
    return activeResource?.apiBase === mod.apiBase;
  }

  const moduloAberto = MODULES.find((m) => m.key === openModuleKey) ?? null;
  const itensDoModuloAberto: MenuItem[] = moduloAberto
    ? [
        ...(moduloAberto.key === "comercial"
          ? [
              { slug: FAZER_PROPOSTA_SLUG, label: "Fazer Proposta" },
              { slug: GERADOR_PROPOSTA_SLUG, label: "Gerador de Proposta" },
            ]
          : []),
        ...resources.filter((r) => r.apiBase === moduloAberto.apiBase).map((r) => ({ slug: r.slug, label: r.label })),
      ]
    : [];

  return (
    <>
      <nav className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 h-full overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-200">
          <h1 className="text-sm font-semibold text-slate-900">Sas Navegantes</h1>
          <p className="text-xs text-slate-500">Gestão Escolar</p>
        </div>

        <ul className="py-2">
          {MODULES.map((mod) => {
            const moduleResources = resources.filter((r) => r.apiBase === mod.apiBase);
            const isComercial = mod.key === "comercial";
            if (moduleResources.length === 0 && !isComercial) return null;
            const ativo = isModuloAtivo(mod);
            return (
              <li key={mod.key}>
                <button
                  onClick={() => setOpenModuleKey(mod.key)}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                    ativo
                      ? "bg-indigo-100 text-indigo-800 border-r-2 border-indigo-600"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {mod.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {moduloAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{moduloAberto.label}</h2>
              <button
                onClick={() => setOpenModuleKey(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <ul className="py-2">
              {itensDoModuloAberto.map((item) => (
                <li key={item.slug}>
                  <button
                    onClick={() => {
                      onSelect(item.slug);
                      setOpenModuleKey(null);
                    }}
                    className={`w-full text-left px-5 py-2.5 text-sm transition-colors ${
                      activeSlug === item.slug
                        ? "bg-indigo-100 text-indigo-800 font-medium"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
              {itensDoModuloAberto.length === 0 && (
                <li className="px-5 py-3 text-sm text-slate-400">Nenhum recurso disponível ainda.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
