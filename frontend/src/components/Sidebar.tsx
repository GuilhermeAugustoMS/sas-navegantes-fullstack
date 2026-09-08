import { useState, type ReactNode } from "react";
import { MODULES, type ModuleDef } from "../api/client";
import type { ResourceDef } from "../api/types";
import logoNavegantes from "../assets/logo-navegantes.webp";

/** Slug sentinela (não é um ResourceDef real do catálogo) para a tela especial
 * do Gerador de Proposta -- ver CrudPage.tsx. */
export const GERADOR_PROPOSTA_SLUG = "__gerador-proposta__";

/** Slug sentinela para o wizard "Fazer Proposta" (Aluno/Negociação/Proposta
 * do zero numa tela só) -- ver CrudPage.tsx e FazerPropostaPage.tsx. */
export const FAZER_PROPOSTA_SLUG = "__fazer-proposta__";

/** Slug sentinela para a tela de Dashboard (indicadores gerais) -- ver CrudPage.tsx. */
export const DASHBOARD_SLUG = "__dashboard__";

interface Props {
  resources: ResourceDef[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

interface MenuItem {
  slug: string;
  label: string;
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconCadastros() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 9h4M16 12.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconComercial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <rect x="3.5" y="8" width="17" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8V6.5A1.5 1.5 0 019.5 5h5A1.5 1.5 0 0116 6.5V8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 13h17" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconFinanceiro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.2 9.8c-.3-.7-1.1-1.2-2.2-1.2-1.4 0-2.4.8-2.4 1.8 0 2.4 4.6 1 4.6 3.4 0 1-1 1.8-2.4 1.8-1.1 0-1.9-.5-2.2-1.2M12 7.5v1M12 15.5v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MODULE_ICONS: Record<string, () => ReactNode> = {
  cadastros: IconCadastros,
  comercial: IconComercial,
  financeiro: IconFinanceiro,
};

/**
 * Sidebar simplificada: só os grupos principais (Cadastros/Comercial/
 * Financeiro, vindos de MODULES) aparecem como botão único. Clicar abre um
 * popup (mesmo estilo visual de RecordFormModal/ConfirmDialog) listando os
 * recursos daquele módulo -- escolher um ali fecha o popup e chama onSelect
 * normalmente, exatamente como clicar direto na lateral funcionava antes.
 * Um módulo sem nenhum recurso implementado continua oculto (mesma regra de
 * antes), exceto o caso especial do Comercial (que sempre tem pelo menos o
 * wizard/gerador de proposta). Dashboard é um item fixo à parte, sem popup.
 *
 * Visual inspirado numa referência (SRMS) que o usuário pediu para seguir em
 * 2026-09-07: item ativo vira uma pílula branca com ícone/texto na cor da
 * marca, mantendo o fundo navy da identidade da escola (decisão explícita:
 * não trocar para o azul cheio da referência).
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

  function itemClasses(ativo: boolean): string {
    return `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      ativo ? "bg-white text-brand-blue-dark shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;
  }

  return (
    <>
      <nav className="w-64 shrink-0 bg-brand-navy h-full overflow-y-auto flex flex-col">
        <div className="px-4 pt-6 pb-5 border-b border-white/10 flex flex-col items-center text-center gap-2">
          <img src={logoNavegantes} alt="Sas Navegantes" className="h-14 w-14 rounded-full bg-white/95 p-1.5" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">SAS NAVEGANTES</h1>
            <p className="text-xs text-white/60">Gestão Escolar</p>
          </div>
        </div>

        <ul className="py-3 px-3 space-y-1">
          <li>
            <button onClick={() => onSelect(DASHBOARD_SLUG)} className={itemClasses(activeSlug === DASHBOARD_SLUG)}>
              <IconDashboard />
              Dashboard
            </button>
          </li>
          {MODULES.map((mod) => {
            const moduleResources = resources.filter((r) => r.apiBase === mod.apiBase);
            const isComercial = mod.key === "comercial";
            if (moduleResources.length === 0 && !isComercial) return null;
            const ativo = isModuloAtivo(mod);
            const Icone = MODULE_ICONS[mod.key];
            return (
              <li key={mod.key}>
                <button onClick={() => setOpenModuleKey(mod.key)} className={itemClasses(ativo)}>
                  {Icone && <Icone />}
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
                        ? "bg-brand-blue/10 text-brand-blue-dark font-medium"
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
