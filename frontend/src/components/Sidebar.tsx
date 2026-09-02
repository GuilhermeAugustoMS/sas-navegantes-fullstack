import { MODULES } from "../api/client";
import type { ResourceDef } from "../api/types";

interface Props {
  resources: ResourceDef[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}

export function Sidebar({ resources, activeSlug, onSelect }: Props) {
  return (
    <nav className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-slate-200">
        <h1 className="text-sm font-semibold text-slate-900">Sas Navegantes</h1>
        <p className="text-xs text-slate-500">Gestão Escolar</p>
      </div>

      {MODULES.map((mod) => {
        const moduleResources = resources.filter((r) => r.apiBase === mod.apiBase);
        if (moduleResources.length === 0) return null;
        return (
          <div key={mod.key} className="py-2">
            <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{mod.label}</p>
            <ul>
              {moduleResources.map((r) => (
                <li key={r.slug}>
                  <button
                    onClick={() => onSelect(r.slug)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      activeSlug === r.slug
                        ? "bg-indigo-100 text-indigo-800 font-medium border-r-2 border-indigo-600"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
