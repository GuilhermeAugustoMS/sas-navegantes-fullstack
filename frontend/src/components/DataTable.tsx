import { useEffect, useState } from "react";
import type { RecordRow, ResourceDef } from "../api/types";
import { useCatalog } from "../context/CatalogContext";
import { displayLabel, hasAtivo } from "../lib/records";
import { fieldLabel } from "../lib/fieldLabels";
import { fmtData } from "../lib/format";

interface Props {
  resource: ResourceDef;
  rows: RecordRow[];
  onEdit: (row: RecordRow) => void;
  onDelete: (row: RecordRow) => void;
}

export function DataTable({ resource, rows, onEdit, onDelete }: Props) {
  const { getOptions, resourceBySheet } = useCatalog();
  const [fkLabels, setFkLabels] = useState<Map<string, Map<string, string>>>(new Map());
  const showAtivo = hasAtivo(resource);

  useEffect(() => {
    let cancelled = false;
    async function loadFkLabels() {
      const next = new Map<string, Map<string, string>>();
      for (const fk of resource.foreignKeys) {
        const options = await getOptions(fk.targetSheet);
        const targetResource = resourceBySheet.get(fk.targetSheet);
        if (!targetResource) continue;
        const byId = new Map<string, string>();
        for (const opt of options) {
          const id = opt[targetResource.idField];
          if (typeof id === "string") byId.set(id, displayLabel(opt));
        }
        next.set(fk.field, byId);
      }
      if (!cancelled) setFkLabels(next);
    }
    loadFkLabels();
    return () => {
      cancelled = true;
    };
  }, [resource, getOptions, resourceBySheet]);

  const idField = resource.idField;
  const visibleColumns = resource.colunas.filter((c) => !c.isId && c.nome !== "ATIVO");

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 px-1 py-6">Nenhum registro encontrado.</p>;
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left font-medium text-slate-600 px-3 py-2">ID</th>
            {visibleColumns.map((c) => (
              <th key={c.nome} className="text-left font-medium text-slate-600 px-3 py-2 whitespace-nowrap">
                {fieldLabel(c.nome)}
              </th>
            ))}
            {showAtivo && <th className="text-left font-medium text-slate-600 px-3 py-2">Status</th>}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = String(row[idField] ?? "");
            const inactive = showAtivo && row.ATIVO === false;
            return (
              <tr key={id} className={`border-b border-slate-100 last:border-0 ${inactive ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">{id}</td>
                {visibleColumns.map((c) => {
                  const fkMap = fkLabels.get(c.nome);
                  const raw = row[c.nome];
                  let display: string;
                  if (fkMap && typeof raw === "string") {
                    display = fkMap.get(raw) ?? raw;
                  } else if (c.tipo === "boolean") {
                    display = raw ? "Sim" : "Não";
                  } else if (c.tipo === "date") {
                    display = fmtData(raw);
                  } else if (raw === null || raw === undefined || raw === "") {
                    display = "—";
                  } else {
                    display = String(raw);
                  }
                  return (
                    <td key={c.nome} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-xs truncate">
                      {display}
                    </td>
                  );
                })}
                {showAtivo && (
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inactive ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {inactive ? "Inativo" : "Ativo"}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => onEdit(row)}
                    className="text-brand-blue-dark hover:text-brand-navy text-xs font-medium mr-3"
                  >
                    Editar
                  </button>
                  {showAtivo && !inactive && (
                    <button
                      onClick={() => onDelete(row)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Inativar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
