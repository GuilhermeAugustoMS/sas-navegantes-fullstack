import { MODULES } from "../api/client";
import type { ResourceDef } from "../api/types";
import { FAZER_PROPOSTA_SLUG, GERADOR_PROPOSTA_SLUG } from "../components/Sidebar";
import { MODULE_ICONS } from "../lib/moduleIcons";

interface Props {
  moduleKey: string;
  resources: ResourceDef[];
  onSelect: (slug: string) => void;
}

interface MenuItem {
  slug: string;
  label: string;
}

/**
 * Tela de opções de um módulo (Cadastros/Comercial/Financeiro): grid de
 * cards, um por recurso, na área principal de conteúdo -- substituiu o
 * popup usado até 2026-09-13. Escolher um card navega direto pro CRUD do
 * recurso (a própria tela de opções não fica acessível por breadcrumb;
 * pra voltar, clica de novo no grupo na sidebar).
 */
export function ModuleMenuPage({ moduleKey, resources, onSelect }: Props) {
  const modulo = MODULES.find((m) => m.key === moduleKey);
  if (!modulo) return null;

  const items: MenuItem[] = [
    ...(moduleKey === "comercial"
      ? [
          { slug: FAZER_PROPOSTA_SLUG, label: "Fazer Proposta" },
          { slug: GERADOR_PROPOSTA_SLUG, label: "Gerador de Proposta" },
        ]
      : []),
    ...resources.filter((r) => r.apiBase === modulo.apiBase).map((r) => ({ slug: r.slug, label: r.label })),
  ];

  const Icone = MODULE_ICONS[moduleKey];

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum recurso disponível ainda.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <button
          key={item.slug}
          onClick={() => onSelect(item.slug)}
          className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 text-left hover:border-brand-blue/40 hover:shadow-sm transition-colors"
        >
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-blue/10 text-brand-blue-dark">
            {Icone && <Icone />}
          </div>
          <p className="text-sm font-medium text-slate-900">{item.label}</p>
        </button>
      ))}
    </div>
  );
}
