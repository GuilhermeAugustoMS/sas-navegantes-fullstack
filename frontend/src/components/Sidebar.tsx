import { MODULES, type ModuleDef } from "../api/client";
import type { ResourceDef } from "../api/types";
import { IconDashboard, MODULE_ICONS } from "../lib/moduleIcons";
import logoNavegantes from "../assets/logo-navegantes.webp";

/** Slug sentinela (não é um ResourceDef real do catálogo) para a tela especial
 * do Gerador de Proposta -- ver CrudPage.tsx. */
export const GERADOR_PROPOSTA_SLUG = "__gerador-proposta__";

/** Slug sentinela para o wizard "Fazer Proposta" (Aluno/Negociação/Proposta
 * do zero numa tela só) -- ver CrudPage.tsx e FazerPropostaPage.tsx. */
export const FAZER_PROPOSTA_SLUG = "__fazer-proposta__";

/** Slug sentinela para a tela de Dashboard (indicadores gerais) -- ver CrudPage.tsx. */
export const DASHBOARD_SLUG = "__dashboard__";

const MODULE_MENU_PREFIX = "__modulo-";
const MODULE_MENU_SUFFIX = "__";

/** Slug sentinela da tela de opções de um módulo (grid com os recursos daquele
 * módulo) -- ver ModuleMenuPage.tsx e CrudPage.tsx. Decisão de 2026-09-13:
 * clicar no grupo da sidebar sempre navega pra essa tela (mesmo se já
 * houver um recurso daquele módulo aberto -- funciona como "home" do módulo). */
export function moduleMenuSlug(moduleKey: string): string {
  return `${MODULE_MENU_PREFIX}${moduleKey}${MODULE_MENU_SUFFIX}`;
}

export function moduleKeyFromMenuSlug(slug: string): string | null {
  if (!slug.startsWith(MODULE_MENU_PREFIX) || !slug.endsWith(MODULE_MENU_SUFFIX)) return null;
  return slug.slice(MODULE_MENU_PREFIX.length, -MODULE_MENU_SUFFIX.length);
}

interface Props {
  resources: ResourceDef[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
  /** Controle do drawer em telas estreitas (< md) -- sempre visível a partir
   * de md, independente destes props (ver classes `md:` abaixo). */
  open: boolean;
  onClose: () => void;
}

/**
 * Sidebar: só os grupos principais (Cadastros/Comercial/Financeiro, vindos
 * de MODULES) aparecem como botão único. Clicar sempre navega para a tela
 * de opções daquele módulo (ModuleMenuPage, grid de cards na área principal
 * -- decisão de 2026-09-13, substituiu o popup usado até então). Um módulo
 * sem nenhum recurso implementado continua oculto (mesma regra de antes),
 * exceto o caso especial do Comercial (que sempre tem pelo menos o
 * wizard/gerador de proposta). Dashboard é um item fixo à parte.
 *
 * Visual inspirado numa referência (SRMS) que o usuário pediu para seguir em
 * 2026-09-07: item ativo vira uma pílula com ícone/texto sobre o fundo navy
 * da identidade da escola. Cor da pílula ajustada para o âmbar da logo
 * (--color-brand-amber) por pedido do usuário -- era branca antes.
 *
 * Responsividade mobile (2026-10-12, diagnóstico de design): abaixo de `md`
 * (768px) a sidebar vira um drawer off-canvas (some atrás da borda esquerda,
 * entra por cima do conteúdo com um fundo escurecido atrás) em vez de ficar
 * sempre fixa ocupando 256px de uma tela de ~390px -- era isso que fazia
 * texto/selects quebrarem em todas as telas no celular. De `md` pra cima o
 * comportamento é exatamente o de antes (sempre visível, estática).
 */
export function Sidebar({ resources, activeSlug, onSelect, open, onClose }: Props) {
  const activeResource = resources.find((r) => r.slug === activeSlug);
  const isComercialAtivo =
    activeSlug === GERADOR_PROPOSTA_SLUG || activeSlug === FAZER_PROPOSTA_SLUG || activeResource?.apiBase === "/api/comercial";

  function isModuloAtivo(mod: ModuleDef): boolean {
    if (activeSlug === moduleMenuSlug(mod.key)) return true;
    if (mod.key === "comercial") return isComercialAtivo;
    return activeResource?.apiBase === mod.apiBase;
  }

  function itemClasses(ativo: boolean): string {
    return `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      ativo ? "bg-brand-amber text-brand-navy shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;
  }

  function selecionar(slug: string) {
    onSelect(slug);
    onClose();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-brand-navy h-full overflow-y-auto flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 pt-6 pb-5 border-b border-white/10 flex flex-col items-center text-center gap-2 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="md:hidden absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <img src={logoNavegantes} alt="Sas Navegantes" className="h-14 w-14 rounded-full bg-white/95 p-1.5" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">SAS NAVEGANTES</h1>
            <p className="text-xs text-white/60">Gestão Escolar</p>
          </div>
        </div>

        <ul className="py-3 px-3 space-y-1">
          <li>
            <button onClick={() => selecionar(DASHBOARD_SLUG)} className={itemClasses(activeSlug === DASHBOARD_SLUG)}>
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
                <button onClick={() => selecionar(moduleMenuSlug(mod.key))} className={itemClasses(ativo)}>
                  {Icone && <Icone />}
                  {mod.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
