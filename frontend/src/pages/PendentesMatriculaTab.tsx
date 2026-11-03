import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { CustomSelect } from "../components/CustomSelect";
import { useUsuario } from "../hooks/useUsuario";
import type { GestaoVagasTurma, PendenteMatricula } from "../api/types";

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * "Pendentes de Matrícula" (aba do painel de Planejamento, 2026-11-02):
 * fecha o ciclo Proposta confirmada -> Matrícula registrada. Lista
 * Propostas com parcelas geradas cujo Aluno ainda não tem Matrícula/
 * Rematrícula no Ano Letivo ativo (GET /api/planejamento/pendentes-
 * matricula) e permite confirmar escolhendo a Turma (POST .../confirmar,
 * que decide Matrícula x Rematrícula sozinho e atualiza o
 * StatusNegociacao -- ver backend/src/api/routes/pendentesMatricula.routes.ts).
 */
export function PendentesMatriculaTab({
  anoLetivoId,
  onConfirmado,
}: {
  anoLetivoId?: string;
  onConfirmado: () => void;
}) {
  const [usuario] = useUsuario();
  const [pendentes, setPendentes] = useState<PendenteMatricula[] | null>(null);
  const [turmasPorSerie, setTurmasPorSerie] = useState<Map<string, GestaoVagasTurma[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [propostaEmConfirmacao, setPropostaEmConfirmacao] = useState<string | null>(null);
  const [turmaEscolhida, setTurmaEscolhida] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function carregar() {
      setLoading(true);
      setErro(null);
      try {
        const [resPendentes, resVagas] = await Promise.all([
          api.getPendentesMatricula(anoLetivoId),
          api.getGestaoVagas(anoLetivoId),
        ]);
        if (cancelled) return;
        setPendentes(resPendentes.pendentes);
        const porSerie = new Map<string, GestaoVagasTurma[]>();
        for (const t of resVagas.turmas) {
          const lista = porSerie.get(t.idSerie) ?? [];
          lista.push(t);
          porSerie.set(t.idSerie, lista);
        }
        setTurmasPorSerie(porSerie);
      } catch (err) {
        if (!cancelled) setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os pendentes de matrícula.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    carregar();
    return () => {
      cancelled = true;
    };
  }, [anoLetivoId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function abrirConfirmacao(idProposta: string) {
    setPropostaEmConfirmacao(idProposta);
    setTurmaEscolhida("");
  }

  async function confirmar(p: PendenteMatricula) {
    if (!turmaEscolhida) return;
    setConfirmando(true);
    try {
      const res = await api.confirmarMatricula(p.idProposta, turmaEscolhida, usuario);
      setPendentes((prev) => (prev ? prev.filter((x) => x.idProposta !== p.idProposta) : prev));
      setPropostaEmConfirmacao(null);
      setToast(`${res.tipo === "Rematricula" ? "Rematrícula" : "Matrícula"} de ${p.nomeAluno} confirmada com sucesso.`);
      onConfirmado();
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Erro ao confirmar matrícula.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-6">
        Propostas já confirmadas (parcelas geradas) aguardando a Matrícula ou Rematrícula ser registrada. Ao confirmar, você
        escolhe a Turma -- o sistema decide sozinho se é Matrícula (primeira vez) ou Rematrícula, a partir do histórico do
        Aluno.
      </p>

      {toast && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{toast}</div>}
      {erro && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</div>}
      {loading && <p className="text-sm text-slate-500">Carregando...</p>}

      {pendentes && pendentes.length === 0 && (
        <p className="text-sm text-slate-400">Nenhuma Proposta pendente de matrícula no momento.</p>
      )}

      {pendentes && pendentes.length > 0 && (
        <div className="space-y-3">
          {pendentes.map((p) => {
            const turmasDaSerie = turmasPorSerie.get(p.idSerie) ?? [];
            const emConfirmacao = propostaEmConfirmacao === p.idProposta;
            return (
              <div key={p.idProposta} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.nomeAluno}</p>
                    <p className="text-xs text-slate-500">
                      {p.nomeSerie} -- Proposta de {fmtData(p.dataProposta)}
                      {p.valorTotalMes != null ? ` -- ${fmtMoeda(p.valorTotalMes)}/mês` : ""}
                    </p>
                  </div>
                  {!emConfirmacao && (
                    <button
                      onClick={() => abrirConfirmacao(p.idProposta)}
                      className="px-3 py-1.5 text-sm rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark"
                    >
                      Confirmar Matrícula
                    </button>
                  )}
                </div>

                {emConfirmacao && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3">
                    <div className="w-64">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Turma</label>
                      <CustomSelect
                        ariaLabel="Turma"
                        value={turmaEscolhida}
                        onChange={setTurmaEscolhida}
                        options={turmasDaSerie.map((t) => ({
                          value: t.idTurma,
                          label: `${t.nome} -- ${t.vagasDisponiveis} vaga${t.vagasDisponiveis === 1 ? "" : "s"} disponíve${t.vagasDisponiveis === 1 ? "l" : "is"}`,
                        }))}
                        placeholder={turmasDaSerie.length === 0 ? "Nenhuma Turma cadastrada para esta Série" : "Selecione..."}
                      />
                    </div>
                    <button
                      onClick={() => confirmar(p)}
                      disabled={!turmaEscolhida || confirmando}
                      className="px-3 py-1.5 text-sm rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {confirmando ? "Confirmando..." : "Confirmar"}
                    </button>
                    <button
                      onClick={() => setPropostaEmConfirmacao(null)}
                      className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
