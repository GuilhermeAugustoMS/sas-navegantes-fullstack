import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { CustomSelect } from "../components/CustomSelect";
import { PendentesMatriculaTab } from "./PendentesMatriculaTab";
import { PreenchimentoTurmasTab } from "./PreenchimentoTurmasTab";
import type { AnoLetivoRecord } from "../api/types";

type Aba = "pendentes" | "preenchimento";

/**
 * Planejamento (2026-11-02): painel com duas abas irmãs -- decisão do
 * usuário, em vez de dois cards separados na grade de Ações (como o
 * Comercial faz com Fazer Proposta/Gerador de Proposta). "Pendentes de
 * Matrícula" fecha o ciclo Proposta confirmada -> Matrícula registrada;
 * "Preenchimento de Turmas" é a antiga tela "Gestão de Vagas" (núcleo
 * inicial, 2026-11-02), agora como aba irmã.
 *
 * Seletor de Ano Letivo (2026-11-02): o painel por padrão mostra o Ano
 * Letivo ativo (igual sempre foi -- backend resolve sozinho quando nenhum
 * é passado), mas dá pra trocar pra qualquer outro, inclusive anos
 * históricos (ex.: 2025, importado da planilha real de Gestão-Negociação
 * -- ver backend/src/seedNegociacoes2025.ts) só pra consulta.
 */
export function PlanejamentoPage() {
  const [aba, setAba] = useState<Aba>("pendentes");
  const [refreshKey, setRefreshKey] = useState(0);
  const [anosLetivos, setAnosLetivos] = useState<AnoLetivoRecord[]>([]);
  const [anoLetivoId, setAnoLetivoId] = useState<string>("");

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
        if (!cancelled) console.error(err instanceof ApiError ? err.message : err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function abaClasses(ativa: boolean): string {
    return `px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
      ativa ? "border-brand-blue text-brand-blue-dark" : "border-transparent text-slate-500 hover:text-slate-700"
    }`;
  }

  const anosOrdenados = [...anosLetivos].sort((a, b) => b.ANO - a.ANO);

  return (
    <div className="p-6 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy mb-1">Planejamento</h2>
          <p className="text-xs text-slate-500">Matrículas pendentes e preenchimento de turmas, num só lugar.</p>
        </div>
        {anosOrdenados.length > 0 && (
          <div className="w-44">
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

      <div className="flex gap-4 border-b border-slate-200 mb-6 mt-4">
        <button onClick={() => setAba("pendentes")} className={abaClasses(aba === "pendentes")}>
          Pendentes de Matrícula
        </button>
        <button onClick={() => setAba("preenchimento")} className={abaClasses(aba === "preenchimento")}>
          Preenchimento de Turmas
        </button>
      </div>

      {aba === "pendentes" ? (
        <PendentesMatriculaTab anoLetivoId={anoLetivoId} onConfirmado={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <PreenchimentoTurmasTab anoLetivoId={anoLetivoId} refreshKey={refreshKey} />
      )}
    </div>
  );
}
