import { useEffect, useState } from "react";
import type { RecordRow, ResourceDef } from "../api/types";
import { api, ApiError } from "../api/client";
import { useCatalog } from "../context/CatalogContext";
import { displayLabel, emptyRecordFor } from "../lib/records";
import { idadeEm31Marco, nivelParaIdade, seriesSugeridas } from "../lib/serieSugerida";

interface Props {
  resource: ResourceDef;
  record: RecordRow | null; // null = criação
  usuario: string;
  onClose: () => void;
  onSaved: (saved: RecordRow) => void;
  /** Valores pré-preenchidos ao criar (ignorado em edição) — ex.: ID_ALUNO ao abrir "+ Nova Negociação" a partir do wizard. */
  initialValues?: Partial<RecordRow>;
}

function toDateInputValue(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function RecordFormModal({ resource, record, usuario, onClose, onSaved, initialValues }: Props) {
  const { getOptions, resourceBySheet } = useCatalog();
  const isEdit = record !== null;
  const editableColumns = resource.colunas.filter((c) => !c.isId);

  const [values, setValues] = useState<RecordRow>(() => {
    if (record) return record;
    const base = emptyRecordFor(editableColumns);
    for (const [campo, valor] of Object.entries(initialValues ?? {})) {
      if (valor !== undefined) base[campo] = valor;
    }
    return base;
  });
  const [fkOptions, setFkOptions] = useState<Map<string, RecordRow[]>>(new Map());
  const [fieldErrors, setFieldErrors] = useState<Map<string, string>>(new Map());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [anoLetivoAtivo, setAnoLetivoAtivo] = useState<RecordRow | null>(null);
  const [sugestaoSerie, setSugestaoSerie] = useState<{ idade: number; nivel: string | null; opcoes: RecordRow[] } | null>(null);

  const ehAlunoComSerie = resource.aba === "Alunos" && editableColumns.some((c) => c.nome === "ID_SERIE");

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      const next = new Map<string, RecordRow[]>();
      for (const fk of resource.foreignKeys) {
        next.set(fk.field, await getOptions(fk.targetSheet));
      }
      if (!cancelled) setFkOptions(next);
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [resource, getOptions]);

  useEffect(() => {
    if (!ehAlunoComSerie) return;
    let cancelled = false;
    getOptions("AnosLetivos").then((anos) => {
      if (cancelled) return;
      setAnoLetivoAtivo(anos.find((a) => a.ATIVO === true) ?? null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAlunoComSerie, getOptions]);

  // Sugere a Série a partir da idade completada até 31/03 do ano letivo ativo
  // (regra confirmada pelo usuário — ver frontend/src/lib/serieSugerida.ts).
  useEffect(() => {
    if (!ehAlunoComSerie || !anoLetivoAtivo) {
      setSugestaoSerie(null);
      return;
    }
    const nascimento = values.DATA_NASCIMENTO;
    if (typeof nascimento !== "string" || !nascimento) {
      setSugestaoSerie(null);
      return;
    }
    const idade = idadeEm31Marco(nascimento, Number(anoLetivoAtivo.ANO));
    if (idade === null) {
      setSugestaoSerie(null);
      return;
    }
    const todasSeries = fkOptions.get("ID_SERIE") ?? [];
    const doAnoLetivo = todasSeries.filter((s) => s.ID_ANO_LETIVO === anoLetivoAtivo.ID_ANO_LETIVO && s.ATIVO !== false);
    const opcoes = seriesSugeridas(doAnoLetivo, idade);
    setSugestaoSerie({ idade, nivel: nivelParaIdade(idade), opcoes });

    if (opcoes.length === 1) {
      setValues((prev) => (prev.ID_SERIE === opcoes[0].ID_SERIE ? prev : { ...prev, ID_SERIE: opcoes[0].ID_SERIE }));
    } else if (opcoes.length > 1) {
      setValues((prev) => {
        const atual = prev.ID_SERIE;
        if (typeof atual === "string" && opcoes.some((s) => s.ID_SERIE === atual)) return prev;
        return { ...prev, ID_SERIE: "" };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAlunoComSerie, anoLetivoAtivo, values.DATA_NASCIMENTO, fkOptions]);

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value as RecordRow[string] }));
    setFieldErrors((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors(new Map());

    const payload: RecordRow = {};
    for (const col of editableColumns) {
      const raw = values[col.nome];
      if (col.tipo === "number") payload[col.nome] = raw === "" || raw === undefined ? (null as any) : Number(raw);
      else payload[col.nome] = raw as any;
    }

    try {
      const saved = isEdit
        ? await api.update(resource, record![resource.idField] as string, payload, usuario)
        : await api.create(resource, payload, usuario);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.body.detalhes) {
        const map = new Map<string, string>();
        for (const d of err.body.detalhes) map.set(d.field, d.problem);
        setFieldErrors(map);
        setFormError(err.body.error === "REGRA_DE_NEGOCIO" ? "Alguns vínculos informados não são válidos:" : "Corrija os campos indicados:");
      } else {
        setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    } finally {
      setSaving(false);
    }
  }

  const fkByField = new Map(resource.foreignKeys.map((fk) => [fk.field, fk]));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? `Editar ${resource.label}` : `Novo registro — ${resource.label}`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {formError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
          )}

          {isEdit && (
            <p className="text-xs text-slate-400 font-mono">
              {resource.idField}: {String(record![resource.idField])}
            </p>
          )}

          {editableColumns.map((col) => {
            const error = fieldErrors.get(col.nome);
            const fk = fkByField.get(col.nome);
            const value = values[col.nome];

            return (
              <div key={col.nome}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {col.nome}
                  {col.obrigatorio && <span className="text-red-500"> *</span>}
                </label>

                {fk ? (
                  <>
                    <select
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setField(col.nome, e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                    >
                      <option value="">— selecione —</option>
                      {(col.nome === "ID_SERIE" && sugestaoSerie && sugestaoSerie.opcoes.length > 0
                        ? sugestaoSerie.opcoes
                        : fkOptions.get(col.nome) ?? []
                      ).map((opt) => {
                        const targetResource = resourceBySheet.get(fk.targetSheet);
                        const optId = targetResource ? (opt[targetResource.idField] as string) : "";
                        return (
                          <option key={optId} value={optId}>
                            {displayLabel(opt)} ({optId})
                          </option>
                        );
                      })}
                    </select>
                    {col.nome === "ID_SERIE" && sugestaoSerie && (
                      <p className="text-xs text-slate-500 mt-1">
                        {sugestaoSerie.nivel
                          ? `Idade até 31/03: ${sugestaoSerie.idade} anos → sugestão: ${sugestaoSerie.nivel}${
                              sugestaoSerie.opcoes.length === 0 ? " (nenhuma Série cadastrada para esse nível)" : ""
                            }`
                          : `Idade até 31/03: ${sugestaoSerie.idade} anos (nenhum nível corresponde a essa idade)`}
                      </p>
                    )}
                  </>
                ) : col.tipo === "enum" ? (
                  <select
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => setField(col.nome, e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">— selecione —</option>
                    {(col.valoresPermitidos ?? []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : col.tipo === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setField(col.nome, e.target.checked)}
                    className="h-4 w-4"
                  />
                ) : col.tipo === "date" ? (
                  <input
                    type="date"
                    value={toDateInputValue(value)}
                    onChange={(e) => setField(col.nome, e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  />
                ) : col.tipo === "number" ? (
                  <input
                    type="number"
                    value={value === null || value === undefined ? "" : String(value)}
                    onChange={(e) => setField(col.nome, e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => setField(col.nome, e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  />
                )}

                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
              </div>
            );
          })}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
