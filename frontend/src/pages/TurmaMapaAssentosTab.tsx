import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { CustomSelect } from "../components/CustomSelect";
import { STATUS_ESTILO } from "./PreenchimentoTurmasTab";
import type { AnoLetivoRecord, GestaoVagasTurma } from "../api/types";

const ASSENTOS_POR_FILEIRA = 4;

/** Ícone de poltrona de cinema -- preenchida (brand-blue) ou vazia (contorno
 * cinza). Não corresponde a um Aluno específico: só representa 1 vaga da
 * Capacidade da Turma (não há cadastro de assento físico por aluno). */
function Assento({ ocupado }: { ocupado: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-6 w-6 shrink-0 ${ocupado ? "text-brand-blue" : "text-slate-200"}`}
      aria-label={ocupado ? "Vaga ocupada" : "Vaga disponível"}
    >
      <path d="M5 10V7a3 3 0 013-3h8a3 3 0 013 3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="4" y="10" width="16" height="7" rx="2" fill="currentColor" />
      <path
        d="M4 13.5H2.5a.5.5 0 00-.5.5v3a1 1 0 001 1H4M20 13.5h1.5a.5.5 0 01.5.5v3a1 1 0 01-1 1H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fileiras(capacidade: number, porFileira: number): number[][] {
  const indices = Array.from({ length: capacidade }, (_, i) => i);
  const linhas: number[][] = [];
  for (let i = 0; i < indices.length; i += porFileira) {
    linhas.push(indices.slice(i, i + porFileira));
  }
  return linhas;
}

/**
 * "Mapa de Turmas" (aba do Dashboard, 2026-11-02): mostra o preenchimento
 * de 1 Turma por vez como um mapa de poltronas, estilo site de cinema --
 * pedido explícito do usuário. Reaproveita GET /api/planejamento/gestao-vagas
 * (mesmo dado da aba "Preenchimento de Turmas" do Planejamento), só muda a
 * visualização.
 *
 * Seletor de Ano Letivo (2026-11-02, mesmo padrão de PlanejamentoPage.tsx):
 * sem ele, essa aba ficava travada no Ano Letivo ativo (2026, ainda vazio)
 * e nunca mostrava os dados reais já importados de 2025 (ver
 * backend/src/seedNegociacoes2025.ts) -- integrando com o mesmo seletor,
 * fica consistente com o painel de Planejamento.
 *
 * Importante (confirmado com o usuário): não existe cadastro de assento
 * físico por Aluno -- cada Turma só tem Capacidade e contagem agregada de
 * Matrículas/Rematrículas. As poltronas preenchidas não representam um
 * Aluno específico, só a proporção preenchida/vaga.
 */
export function TurmaMapaAssentosTab() {
  const [anosLetivos, setAnosLetivos] = useState<AnoLetivoRecord[]>([]);
  const [anoLetivoId, setAnoLetivoId] = useState("");
  const [turmas, setTurmas] = useState<GestaoVagasTurma[] | null>(null);
  const [anoLetivoAtual, setAnoLetivoAtual] = useState<{ id: string; ano: number } | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listAnosLetivos()
      .then((lista) => {
        if (cancelled) return;
        setAnosLetivos(lista);
        const ativo = lista.find((a) => a.ATIVO);
        setAnoLetivoId(ativo ? ativo.ID_ANO_LETIVO : "");
      })
      .catch((err) => {
        if (!cancelled) setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os Anos Letivos.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getGestaoVagas(anoLetivoId || undefined)
      .then((res) => {
        if (cancelled) return;
        setTurmas(res.turmas);
        setAnoLetivoAtual(res.anoLetivo);
        setTurmaId((atual) => (atual && res.turmas.some((t) => t.idTurma === atual) ? atual : (res.turmas[0]?.idTurma ?? "")));
      })
      .catch((err) => {
        if (!cancelled) setErro(err instanceof ApiError ? err.message : "Não foi possível carregar as Turmas.");
      });
    return () => {
      cancelled = true;
    };
  }, [anoLetivoId]);

  if (erro) {
    return <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</div>;
  }
  if (!turmas) {
    return <p className="text-sm text-slate-500">Carregando...</p>;
  }

  const turma = turmas.find((t) => t.idTurma === turmaId) ?? null;
  const estilo = turma ? STATUS_ESTILO[turma.status] : null;
  const anosOrdenados = [...anosLetivos].sort((a, b) => b.ANO - a.ANO);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <p className="text-xs text-slate-500 max-w-2xl">
          Mapa visual de preenchimento por Turma{anoLetivoAtual ? ` -- Ano Letivo ${anoLetivoAtual.ano}` : ""}. Cada poltrona
          representa 1 vaga da Capacidade da Turma (preenchida ou disponível) -- não corresponde a um Aluno específico, já que não
          há assento físico cadastrado.
        </p>
        {anosOrdenados.length > 0 && (
          <div className="w-44 shrink-0">
            <CustomSelect
              ariaLabel="Ano Letivo"
              value={anoLetivoId}
              onChange={setAnoLetivoId}
              options={anosOrdenados.map((a) => ({
                value: a.ID_ANO_LETIVO,
                label: a.ATIVO ? `${a.ANO} (ativo)` : String(a.ANO),
              }))}
            />
          </div>
        )}
      </div>

      <div className="w-72 mb-6">
        <CustomSelect
          ariaLabel="Turma"
          value={turmaId}
          onChange={setTurmaId}
          options={turmas.map((t) => ({
            value: t.idTurma,
            label: `${t.nome} (${t.totalPreenchido}/${t.capacidadeMaxima})`,
          }))}
        />
      </div>

      {turma && estilo && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
            <div>
              <p className="text-base font-semibold text-slate-800">{turma.nome}</p>
              <p className="text-xs text-slate-500">
                {turma.totalPreenchido}/{turma.capacidadeMaxima} preenchidas -- {turma.vagasDisponiveis} vaga
                {turma.vagasDisponiveis === 1 ? "" : "s"} disponíve{turma.vagasDisponiveis === 1 ? "l" : "is"}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${estilo.pill}`}>
              {turma.status}
            </span>
          </div>

          <div className="mx-auto mb-8 max-w-sm">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${estilo.barra}`}
                style={{ width: `${Math.min(100, Math.round(turma.percentualOcupacao * 100))}%` }}
              />
            </div>
            <p className="text-center text-[10px] tracking-[0.2em] text-slate-400 mt-1.5 uppercase">
              {Math.round(turma.percentualOcupacao * 100)}% preenchido
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 overflow-x-auto">
            {fileiras(turma.capacidadeMaxima, ASSENTOS_POR_FILEIRA).map((linha, i) => (
              <div key={i} className="flex gap-1.5">
                {linha.map((indice) => (
                  <Assento key={indice} ocupado={indice < turma.totalPreenchido} />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 mt-8 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Assento ocupado />
              Ocupada
            </div>
            <div className="flex items-center gap-1.5">
              <Assento ocupado={false} />
              Disponível
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
