import { MODULES } from "../api/client";
import { FAZER_PROPOSTA_SLUG, GERADOR_PROPOSTA_SLUG } from "../components/Sidebar";
import type { ResourceDef } from "../api/types";

interface Item {
  slug: string;
  label: string;
}

interface Props {
  moduloKey: string;
  resources: ResourceDef[];
  onSelect: (slug: string) => void;
}

/**
 * Tela de opções de um módulo (Cadastros/Comercial/Financeiro): grid de
 * cards clicáveis, um por recurso, ocupando a área de conteúdo principal
 * (antes disso, clicar num grupo da sidebar abria um popup em vez de
 * navegar pra uma tela própria — ver Sidebar.tsx/CrudPage.tsx). No
 * Comercial, os itens especiais "Fazer Proposta" e "Gerador de Proposta"
 * (sentinelas, não são CRUD genérico) entram na mesma grade, sem distinção
 * visual dos demais recursos.
 */
export function ModuleOptionsPage({ moduloKey, resources, onSelect }: Props) {
  const modulo = MODULES.find((m) => m.key === moduloKey);

  const itens: Item[] = [
    ...(moduloKey === "comercial"
      ? [
          { slug: FAZER_PROPOSTA_SLUG, label: "Fazer Proposta" },
          { slug: GERADOR_PROPOSTA_SLUG, label: "Gerador de Proposta" },
        ]
      : []),
    ...resources.filter((r) => r.apiBase === modulo?.apiBase).map((r) => ({ slug: r.slug, label: r.label })),
  ];

  if (itens.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum recurso disponível ainda neste módulo.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {itens.map((item) => (
        <button
          key={item.slug}
          onClick={() => onSelect(item.slug)}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-blue hover:shadow-sm transition-colors"
        >
          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
        </button>
      ))}
    </div>
  );
}
