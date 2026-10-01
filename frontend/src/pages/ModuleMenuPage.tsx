import type { ReactNode } from "react";
import { MODULES } from "../api/client";
import type { ResourceDef } from "../api/types";
import { FAZER_PROPOSTA_SLUG, GERADOR_PROPOSTA_SLUG } from "../components/Sidebar";
import { MODULE_ICONS, IconFazerProposta, IconGeradorProposta } from "../lib/moduleIcons";

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
 *
 * No Comercial, "Fazer Proposta" e "Gerador de Proposta" não são CRUD --
 * são as duas formas de trabalhar com uma Proposta (criar do zero vs.
 * gerenciar uma já existente, ver as próprias telas). Até 2026-10-01 elas
 * apareciam como mais dois cards idênticos aos de Negociações/Matrículas/
 * Parcelas de Proposta etc., com o mesmo ícone genérico do módulo -- sem
 * nada que sinalizasse que "Fazer Proposta" é o fluxo principal do dia a
 * dia (achado do diagnóstico de design de 2026-10-01). Agora elas formam
 * uma seção "Ações" própria, com ícone individual e "Fazer Proposta" com
 * tratamento de destaque (ação primária); o restante continua uma grade
 * plana de cadastros, sem hierarquia inventada entre eles.
 */
export function ModuleMenuPage({ moduleKey, resources, onSelect }: Props) {
  const modulo = MODULES.find((m) => m.key === moduleKey);
  if (!modulo) return null;

  const acoes: (MenuItem & { descricao: string; Icone: () => ReactNode; destaque?: boolean })[] =
    moduleKey === "comercial"
      ? [
          {
            slug: FAZER_PROPOSTA_SLUG,
            label: "Fazer Proposta",
            descricao: "Monte a proposta do zero, numa tela só",
            Icone: IconFazerProposta,
            destaque: true,
          },
          {
            slug: GERADOR_PROPOSTA_SLUG,
            label: "Gerador de Proposta",
            descricao: "Gerencie ou simule uma proposta já existente",
            Icone: IconGeradorProposta,
          },
        ]
      : [];

  const cadastros: MenuItem[] = resources
    .filter((r) => r.apiBase === modulo.apiBase)
    .map((r) => ({ slug: r.slug, label: r.label }));

  const IconeModulo = MODULE_ICONS[moduleKey];

  if (acoes.length === 0 && cadastros.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum recurso disponível ainda.</p>;
  }

  return (
    <div>
      {acoes.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Ações</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {acoes.map((item) => (
              <button
                key={item.slug}
                onClick={() => onSelect(item.slug)}
                className={
                  item.destaque
                    ? "bg-brand-blue text-white rounded-xl p-6 flex items-center gap-4 text-left shadow-sm hover:bg-brand-blue-dark transition-colors"
                    : "bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-4 text-left hover:border-brand-blue/40 hover:shadow-sm transition-colors"
                }
              >
                <div
                  className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                    item.destaque ? "bg-white/15 text-white" : "bg-brand-blue/10 text-brand-blue-dark"
                  }`}
                >
                  <item.Icone />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold">{item.label}</p>
                  <p className={`text-xs mt-0.5 ${item.destaque ? "text-white/80" : "text-slate-500"}`}>
                    {item.descricao}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {cadastros.length > 0 && (
        <div>
          {acoes.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Cadastros</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cadastros.map((item) => (
              <button
                key={item.slug}
                onClick={() => onSelect(item.slug)}
                className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 text-left hover:border-brand-blue/40 hover:shadow-sm transition-colors"
              >
                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-blue/10 text-brand-blue-dark">
                  {IconeModulo && <IconeModulo />}
                </div>
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
