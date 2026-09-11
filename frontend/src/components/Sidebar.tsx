import type { ReactNode } from "react";
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

const MODULO_OPCOES_PREFIXO = "__modulo-opcoes__:";

/** Slug sentinela para a tela de opções de um módulo (Cadastros/Comercial/
 * Financeiro) -- lista os recursos daquele módulo na área de conteúdo
 * principal, em vez do popup que existia antes. Ver CrudPage.tsx e
 * ModuleOptionsPage.tsx. */
export function moduloOpcoesSlug(moduloKey: string): string {
  return `${MODULO_OPCOES_PREFIXO}${moduloKey}`;
}

/** Extrai a key do módulo de um slug de tela de opções, ou null se o slug
 * não for um desses. */
export function parseModuloOpcoesSlug(slug: string | null): string | null {
  if (!slug || !slug.startsWith(MODULO_OPCOES_PREFIXO)) return null;
  return slug.slice(MODULO_OPCOES_PREFIXO.length);
}

interface Props {
  resources: ResourceDef[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
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
 * Financeiro, vindos de MODULES) aparecem como botão único. Clicar num
 * grupo navega para a tela de opções daquele módulo (ModuleOptionsPage, na
 * área de conteúdo principal) -- não é mais um popup. Escolher um recurso
 * ali navega pro CRUD normalmente, do mesmo jeito que clicar direto na
 * lateral já funcionava antes. Clicar de novo no mesmo grupo enquanto já se
 * está dentro de um recurso dele volta pra essa tela de opções (é assim que
 * se "sobe um nível"). Um módulo sem nenhum recurso implementado continua
 * oculto (mesma regra de antes), exceto o caso especial do Comercial (que
 * sempre tem pelo menos o wizard/gerador de proposta). Dashboard é um item
 * fixo à parte, sem tela de opções.
 *
 * Visual inspirado numa referência (SRMS) que o usuário pediu para seguir em
 * 2026-09-07: item ativo vira uma pílula com ícone/texto sobre o fundo navy
 * da identidade da escola. Cor da pílula ajustada para o âmbar da logo
 * (--color-brand-amber) por pedido do usuário -- era branca antes.
 */
export function Sidebar({ resources, activeSlug, onSelect }: Props) {
  const activeResource = resources.find((r) => r.slug === activeSlug);
  const isComercialAtivo =
    activeSlug === GERADOR_PROPOSTA_SLUG || activeSlug === FAZER_PROPOSTA_SLUG || activeResource?.apiBase === "/api/comercial";
  const moduloOpcoesAtivo = parseModuloOpcoesSlug(activeSlug);

  function isModuloAtivo(mod: ModuleDef): boolean {
    if (moduloOpcoesAtivo === mod.key) return true;
    if (mod.key === "comercial") return isComercialAtivo;
    return activeResource?.apiBase === mod.apiBase;
  }

  function itemClasses(ativo: boolean): string {
    return `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      ativo ? "bg-brand-amber text-brand-navy shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;
  }

  return (
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
              <button onClick={() => onSelect(moduloOpcoesSlug(mod.key))} className={itemClasses(ativo)}>
                {Icone && <Icone />}
                {mod.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
