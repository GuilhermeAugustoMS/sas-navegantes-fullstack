import { useEffect, useState } from "react";
import type { RecordRow, ResourceDef } from "../api/types";
import { api, ApiError } from "../api/client";
import { useCatalog } from "../context/CatalogContext";
import { displayLabel, emptyRecordFor } from "../lib/records";
import { fieldLabel } from "../lib/fieldLabels";
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

/** Sentinela do select de Responsável pra indicar "cadastrar um novo", em vez de escolher um já existente. */
const NOVO_RESPONSAVEL = "__novo__";

export function RecordFormModal({ resource, record, usuario, onClose, onSaved, initialValues }: Props) {
  const { getOptions, resourceBySheet, resourceBySlug } = useCatalog();
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
  const ehAluno = resource.aba === "Alunos";

  // Responsável Financeiro obrigatório no cadastro de Aluno (regra confirmada
  // com o usuário em 2026-09-15): pelo menos um Responsável com vínculo ativo
  // TIPO "Financeiro" (ou "Legal e Financeiro") -- mesma prioridade já usada
  // no cabeçalho da Proposta (PropostaSimulacaoPanel.tsx). Ao criar, a tela
  // guia o fluxo sequencial (cria o Aluno, depois vincula o Responsável, sem
  // garantia atômica -- mesmo padrão do wizard "Fazer Proposta"); ao editar,
  // o backend recusa a edição sem esse vínculo (alunoResponsavelGuard.routes.ts).
  const [responsaveis, setResponsaveis] = useState<RecordRow[]>([]);
  const [vinculoFinanceiroAtual, setVinculoFinanceiroAtual] = useState<RecordRow | null>(null);
  const [responsavelFinanceiroAtual, setResponsavelFinanceiroAtual] = useState<RecordRow | null>(null);
  const [idResponsavelEscolhido, setIdResponsavelEscolhido] = useState("");
  const [novoResponsavelNome, setNovoResponsavelNome] = useState("");
  const [novoResponsavelTelefone, setNovoResponsavelTelefone] = useState("");
  const [novoResponsavelEmail, setNovoResponsavelEmail] = useState("");
  const [responsavelErro, setResponsavelErro] = useState<string | null>(null);
  /** Guarda o Aluno já criado numa tentativa anterior de submit, quando só o
   * vínculo do Responsável falhou -- evita criar um Aluno duplicado se a
   * pessoa corrigir o Responsável e tentar salvar de novo. */
  const [alunoRecemCriado, setAlunoRecemCriado] = useState<RecordRow | null>(null);

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

  useEffect(() => {
    if (!ehAluno) return;
    let cancelled = false;
    async function carregarResponsavel() {
      const resps = await getOptions("Responsaveis");
      if (!cancelled) setResponsaveis(resps);

      if (!isEdit || !record) return;
      const vinculosResource = resourceBySlug.get("vinculos-responsavel");
      const responsaveisResource = resourceBySlug.get("responsaveis");
      if (!vinculosResource || !responsaveisResource) return;
      const idAluno = String(record[resource.idField]);
      const vinculos = await api.list(vinculosResource, { id_aluno: idAluno, ativo: "true" });
      const vinculo =
        vinculos.find((v) => v.TIPO === "Financeiro") ?? vinculos.find((v) => v.TIPO === "Legal e Financeiro") ?? null;
      if (cancelled) return;
      setVinculoFinanceiroAtual(vinculo);
      if (vinculo) {
        const resp = await api.get(responsaveisResource, String(vinculo.ID_RESPONSAVEL));
        if (!cancelled) setResponsavelFinanceiroAtual(resp);
      }
    }
    carregarResponsavel();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAluno]);

  function responsavelEhValido(): boolean {
    if (!ehAluno) return true;
    if (vinculoFinanceiroAtual && idResponsavelEscolhido === "") return true; // já tem, não mudou nada
    if (idResponsavelEscolhido === NOVO_RESPONSAVEL) return novoResponsavelNome.trim().length > 0;
    return idResponsavelEscolhido !== "";
  }

  /** Garante que o Aluno (já existente, com idAluno definido) tenha um vínculo
   * Financeiro ativo, criando o Responsável novo (se for o caso) e o vínculo
   * em ResponsaveisFinanceiros. Só mexe em algo se o usuário de fato trocou a
   * seleção -- se já havia um vínculo e nada mudou, não faz nenhuma chamada. */
  async function garantirResponsavelFinanceiro(idAluno: string): Promise<boolean> {
    if (vinculoFinanceiroAtual && idResponsavelEscolhido === "") return true;

    const responsaveisResource = resourceBySlug.get("responsaveis");
    const vinculosResource = resourceBySlug.get("vinculos-responsavel");
    if (!responsaveisResource || !vinculosResource) {
      setResponsavelErro("Catálogo ainda não carregou os recursos de Responsável.");
      return false;
    }

    try {
      let idResponsavel = idResponsavelEscolhido;
      if (idResponsavelEscolhido === NOVO_RESPONSAVEL) {
        const criado = await api.create(
          responsaveisResource,
          {
            NOME: novoResponsavelNome.trim(),
            TELEFONE: novoResponsavelTelefone.trim() || null,
            EMAIL: novoResponsavelEmail.trim() || null,
            ATIVO: true,
          },
          usuario,
        );
        idResponsavel = String(criado.ID_RESPONSAVEL);
      }
      if (!idResponsavel) {
        setResponsavelErro("Selecione ou cadastre um Responsável Financeiro.");
        return false;
      }

      if (vinculoFinanceiroAtual && String(vinculoFinanceiroAtual.ID_RESPONSAVEL) !== idResponsavel) {
        await api.remove(
          vinculosResource,
          String(vinculoFinanceiroAtual[vinculosResource.idField]),
          usuario,
          "Substituído por novo Responsável Financeiro no cadastro do Aluno",
        );
      }
      if (!vinculoFinanceiroAtual || String(vinculoFinanceiroAtual.ID_RESPONSAVEL) !== idResponsavel) {
        await api.create(
          vinculosResource,
          { ID_ALUNO: idAluno, ID_RESPONSAVEL: idResponsavel, TIPO: "Financeiro", ATIVO: true },
          usuario,
        );
      }
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.body.detalhes?.length) {
        setResponsavelErro(err.body.detalhes.map((d) => `${fieldLabel(d.field)}: ${d.problem}`).join("; "));
      } else {
        setResponsavelErro(err instanceof Error ? err.message : "Erro ao vincular Responsável Financeiro.");
      }
      return false;
    }
  }

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
    setFormError(null);
    setFieldErrors(new Map());
    setResponsavelErro(null);

    if (ehAluno && !responsavelEhValido()) {
      setResponsavelErro("Selecione um Responsável Financeiro existente ou informe o nome de um novo antes de salvar.");
      return;
    }

    setSaving(true);
    const payload: RecordRow = {};
    for (const col of editableColumns) {
      const raw = values[col.nome];
      if (col.tipo === "number") payload[col.nome] = raw === "" || raw === undefined ? (null as any) : Number(raw);
      else payload[col.nome] = raw as any;
    }

    // Se uma tentativa anterior já criou o Aluno mas falhou só no vínculo do
    // Responsável, esta tentativa não cria de novo -- edita o mesmo Aluno.
    const efetivamenteEditando = isEdit || alunoRecemCriado !== null;
    const idAlvo = efetivamenteEditando ? ((alunoRecemCriado ?? record)![resource.idField] as string) : null;

    try {
      if (efetivamenteEditando && ehAluno) {
        const ok = await garantirResponsavelFinanceiro(idAlvo!);
        if (!ok) {
          setSaving(false);
          return;
        }
      }

      const saved = efetivamenteEditando
        ? await api.update(resource, idAlvo!, payload, usuario)
        : await api.create(resource, payload, usuario);

      if (!efetivamenteEditando && ehAluno) {
        const ok = await garantirResponsavelFinanceiro(String(saved[resource.idField]));
        if (!ok) {
          // O Aluno já foi criado -- guarda pra não recriar num retry, e
          // mantém o modal aberto mostrando o erro do vínculo.
          setAlunoRecemCriado(saved);
          setSaving(false);
          return;
        }
      }
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

          {alunoRecemCriado && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Aluno criado ({String(alunoRecemCriado.ID_ALUNO)}) — falta só vincular o Responsável Financeiro abaixo pra
              concluir.
            </p>
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
                  {fieldLabel(col.nome)}
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

          {ehAluno && (
            <div className="border-t border-slate-100 pt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Responsável Financeiro
                <span className="text-red-500"> *</span>
              </label>

              {vinculoFinanceiroAtual && idResponsavelEscolhido === "" ? (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-800 truncate">{String(responsavelFinanceiroAtual?.NOME ?? "—")}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {responsavelFinanceiroAtual?.TELEFONE ? String(responsavelFinanceiroAtual.TELEFONE) : "sem telefone"}
                      {" · "}
                      {responsavelFinanceiroAtual?.EMAIL ? String(responsavelFinanceiroAtual.EMAIL) : "sem email"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIdResponsavelEscolhido(NOVO_RESPONSAVEL)}
                    className="text-xs text-brand-blue-dark hover:underline whitespace-nowrap ml-2"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <select
                    value={idResponsavelEscolhido}
                    onChange={(e) => setIdResponsavelEscolhido(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">— selecione —</option>
                    {responsaveis.map((r) => (
                      <option key={String(r.ID_RESPONSAVEL)} value={String(r.ID_RESPONSAVEL)}>
                        {String(r.NOME)}
                      </option>
                    ))}
                    <option value={NOVO_RESPONSAVEL}>+ Cadastrar novo Responsável</option>
                  </select>

                  {idResponsavelEscolhido === NOVO_RESPONSAVEL && (
                    <div className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded-md p-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Nome <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={novoResponsavelNome}
                          onChange={(e) => setNovoResponsavelNome(e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                        <input
                          type="tel"
                          value={novoResponsavelTelefone}
                          onChange={(e) => setNovoResponsavelTelefone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={novoResponsavelEmail}
                          onChange={(e) => setNovoResponsavelEmail(e.target.value)}
                          placeholder="nome@exemplo.com"
                          className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {responsavelErro && <p className="text-xs text-red-600 mt-1">{responsavelErro}</p>}
            </div>
          )}

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
              className="px-3 py-1.5 text-sm rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
