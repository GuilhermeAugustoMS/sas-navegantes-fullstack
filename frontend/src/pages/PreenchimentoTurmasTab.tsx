import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { GestaoVagasAluno, GestaoVagasResponse, GestaoVagasTurma } from "../api/types";

/** Cores por faixa de ocupação -- só categorização visual, não é regra
 * financeira/contratual (ajustável se o usuário pedir outros cortes).
 * Não usa âmbar: essa cor é reservada pro estado selecionado/ativo em
 * outros lugares do sistema (sidebar, toggle) -- ver convenção já
 * estabelecida em DataTable/PropostaSimulacaoPanel. */
export const STATUS_ESTILO: Record<GestaoVagasTurma["status"], { pill: string; barra: string }> = {
  Vazia: { pill: "bg-slate-100 text-slate-500", barra: "bg-slate-300" },
  "Com vagas": { pill: "bg-emerald-50 text-emerald-700", barra: "bg-emerald-500" },
  "Quase lotada": { pill: "bg-orange-50 text-orange-700", barra: "bg-orange-500" },
  Lotada: { pill: "bg-red-50 text-red-700", barra: "bg-red-500" },
};

const STATUS_ALUNO_ESTILO: Record<GestaoVagasAluno["status"], string> = {
  Matriculado: "bg-emerald-50 text-emerald-700",
  Rematriculado: "bg-sky-50 text-sky-700",
  Pendente: "bg-slate-100 text-slate-500",
};

/**
 * "Preenchimento de Turmas" (aba do painel de Planejamento, núcleo inicial
 * -- 2026-11-02): somente-leitura, calculado ao vivo a partir de
 * GET /api/planejamento/gestao-vagas (cruza Alunos.ID_TURMA com
 * Matriculas/Rematriculas do Ano Letivo ativo). Era a tela "Gestão de
 * Vagas" original; virou uma aba quando "Pendentes de Matrícula" foi
 * adicionada ao lado (mesmo painel, duas abas -- decisão do usuário).
 *
 * Escopo combinado com o usuário: por enquanto só Capacidade/Matrículas/
 * Rematrículas/Vagas Disponíveis/Status. Gênero, Programas (Integral/Semi/
 * Estendido) e Taxa de Rematrícula ficam para uma próxima passada.
 *
 * Seleção de Turma (2026-11-02): clicar numa linha expande, logo abaixo
 * dela, os Alunos vinculados a ela (nome + status Matriculado/
 * Rematriculado/Pendente) -- já vindo pronto no mesmo GET (ver
 * gestaoVagas.routes.ts), sem round-trip extra ao selecionar. A expansão
 * fica dentro da própria tabela (não num painel ao final da lista de 51
 * Turmas) para não obrigar rolar a página inteira depois de clicar.
 */
export function PreenchimentoTurmasTab({
  anoLetivoId,
  refreshKey,
}: {
  anoLetivoId?: string;
  refreshKey: number;
}) {
  const [dados, setDados] = useState<GestaoVagasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function carregar() {
      setLoading(true);
      setErro(null);
      try {
        const res = await api.getGestaoVagas(anoLetivoId);
        if (!cancelled) setDados(res);
      } catch (err) {
        if (!cancelled) setErro(err instanceof ApiError ? err.message : "Não foi possível carregar o preenchimento das turmas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    carregar();
    return () => {
      cancelled = true;
    };
  }, [anoLetivoId, refreshKey]);

  return (
    <div>
      <p className="text-xs text-slate-500 mb-6">
        Matrículas, rematrículas e vagas disponíveis por turma{dados ? ` -- Ano Letivo ${dados.anoLetivo.ano}` : ""}. Calculado ao
        vivo a partir dos Alunos vinculados a cada Turma (Cadastros) e das Matrículas/Rematrículas do ano corrente.
      </p>

      {loading && <p className="text-sm text-slate-500">Carregando...</p>}

      {erro && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</div>}

      {dados && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-medium">Turma</th>
                <th className="px-4 py-2.5 font-medium text-right">Capacidade</th>
                <th className="px-4 py-2.5 font-medium text-right">Matrículas</th>
                <th className="px-4 py-2.5 font-medium text-right">Rematrículas</th>
                <th className="px-4 py-2.5 font-medium text-right">Preenchido</th>
                <th className="px-4 py-2.5 font-medium text-right">Vagas</th>
                <th className="px-4 py-2.5 font-medium w-40">Ocupação</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.turmas.map((t) => {
                const estilo = STATUS_ESTILO[t.status];
                const larguraBarra = Math.min(100, Math.round(t.percentualOcupacao * 100));
                const selecionada = turmaSelecionadaId === t.idTurma;
                return (
                  <Fragment key={t.idTurma}>
                    <tr
                      onClick={() => setTurmaSelecionadaId(selecionada ? null : t.idTurma)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        selecionada ? "bg-brand-blue/5" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-800">{t.nome}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{t.capacidadeMaxima}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{t.matriculas}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{t.rematriculas}</td>
                      <td className="px-4 py-2 text-right text-slate-800 font-medium">{t.totalPreenchido}</td>
                      <td className={`px-4 py-2 text-right font-medium ${t.vagasDisponiveis < 0 ? "text-red-600" : "text-slate-800"}`}>
                        {t.vagasDisponiveis}
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${estilo.barra}`} style={{ width: `${larguraBarra}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estilo.pill}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                    {selecionada && (
                      <tr className="border-b border-slate-100 last:border-0 bg-slate-50/60">
                        <td colSpan={8} className="px-4 py-3">
                          {t.alunos.length === 0 ? (
                            <p className="text-sm text-slate-400">Nenhum Aluno vinculado a esta Turma.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                              {t.alunos.map((a) => (
                                <div
                                  key={a.idAluno}
                                  className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-md bg-white border border-slate-200"
                                >
                                  <span className="text-sm text-slate-700 truncate">{a.nome}</span>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_ALUNO_ESTILO[a.status]}`}
                                  >
                                    {a.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
