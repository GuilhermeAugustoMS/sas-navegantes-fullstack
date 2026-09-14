import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useCatalog } from "../context/CatalogContext";
import { ConfirmDialog } from "./ConfirmDialog";
import type { GerarParcelasInput, ParcelaProposta, RecordRow } from "../api/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  propostaId: string;
  formasPagamento: RecordRow[];
  usuario: string;
  /** Disparado depois que a proposta é confirmada e as parcelas gravadas (congeladas). */
  onGerado?: (result: { parcelas: ParcelaProposta[]; valorTotalMes: number }) => void;
}

/**
 * Painel de simulação/confirmação de parcelas do Gerador de Proposta (Seção
 * 22/54) — extraído de PropostaGeneratorPage.tsx para ser reaproveitado
 * tanto pelo fluxo legado (seleciona uma Proposta já existente) quanto pelo
 * wizard "Fazer Proposta" (cria Aluno/Negociação/Proposta antes de chegar
 * aqui). A lógica de cálculo/persistência em si não muda: só simula
 * (preview) até o usuário confirmar, e uma vez confirmada a proposta fica
 * congelada (o backend recusa gerar de novo para a mesma Proposta).
 *
 * A tabela de parcelas foi ajustada em 2026-09-11 pra ficar parecida com o
 * modelo em Excel que a escola já usa pra apresentar a Proposta à família
 * (print de referência do usuário): a linha de Entrada (NUMERO_PARCELA=0)
 * aparece destacada, e o cabeçalho "Total" virou "Montante Negociado". Não
 * foi reproduzido o bloco de cabeçalho do Excel (dados do Aluno/Responsável,
 * Série, datas etc.) — fora do escopo confirmado com o usuário (só a tabela
 * de parcelas), e a maior parte desses campos não é responsabilidade deste
 * componente. A Entrada tem seu próprio desconto (PERCENTUAL_DESCONTO_
 * ENTRADA), independente do desconto da Mensalidade (PERCENTUAL_DESCONTO) —
 * ver propostaEngine.ts.
 */
export function PropostaSimulacaoPanel({ propostaId, formasPagamento, usuario, onGerado }: Props) {
  const { resourceBySlug } = useCatalog();
  const [parcelasExistentes, setParcelasExistentes] = useState<ParcelaProposta[] | null>(null);
  const [checandoExistentes, setChecandoExistentes] = useState(false);

  const [statusProposta, setStatusProposta] = useState<string | null>(null);
  const [descontoPersistido, setDescontoPersistido] = useState<number | null>(null);
  const [descontoEntradaPersistido, setDescontoEntradaPersistido] = useState<number | null>(null);
  const [descontoAberto, setDescontoAberto] = useState(false);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [idFormaPagamento, setIdFormaPagamento] = useState("");
  const [mesEntrada, setMesEntrada] = useState(1);
  const [diaEntrada, setDiaEntrada] = useState(1);
  const [necessidadeAlimentacao, setNecessidadeAlimentacao] = useState(false);
  const [contratouIntegral, setContratouIntegral] = useState(false);
  const [contratouSemiIntegral, setContratouSemiIntegral] = useState(false);
  const [contratouEstendido, setContratouEstendido] = useState(false);
  const [percentualDesconto, setPercentualDesconto] = useState(0);
  const [percentualDescontoEntrada, setPercentualDescontoEntrada] = useState(0);

  const [preview, setPreview] = useState<{ parcelas: ParcelaProposta[]; valorTotalMes: number } | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhesErro, setDetalhesErro] = useState<{ field: string; problem: string }[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    async function checar() {
      if (!propostaId) {
        setParcelasExistentes(null);
        return;
      }
      setChecandoExistentes(true);
      try {
        const existentes = await api.listarParcelas(propostaId);
        if (!cancelled) setParcelasExistentes(existentes);
      } catch {
        if (!cancelled) setParcelasExistentes(null);
      } finally {
        if (!cancelled) setChecandoExistentes(false);
      }
    }
    checar();
    return () => {
      cancelled = true;
    };
  }, [propostaId]);

  async function carregarStatusProposta() {
    const propostasResource = resourceBySlug.get("propostas");
    if (!propostasResource) return;
    try {
      const rec = await api.get(propostasResource, propostaId);
      setStatusProposta(String(rec.STATUS ?? ""));
      setDescontoPersistido(typeof rec.PERCENTUAL_DESCONTO === "number" ? rec.PERCENTUAL_DESCONTO : null);
      setDescontoEntradaPersistido(typeof rec.PERCENTUAL_DESCONTO_ENTRADA === "number" ? rec.PERCENTUAL_DESCONTO_ENTRADA : null);
    } catch {
      setStatusProposta(null);
      setDescontoPersistido(null);
      setDescontoEntradaPersistido(null);
    }
  }

  useEffect(() => {
    carregarStatusProposta();
  }, [propostaId, resourceBySlug]);

  async function handleCancelarProposta() {
    const propostasResource = resourceBySlug.get("propostas");
    if (!propostasResource) return;
    setCancelando(true);
    try {
      await api.update(propostasResource, propostaId, { STATUS: "Cancelada" }, usuario);
      await carregarStatusProposta();
      setToast("Proposta cancelada.");
    } catch (err) {
      tratarErro(err);
    } finally {
      setCancelando(false);
      setConfirmandoCancelamento(false);
    }
  }

  function montarInput(): GerarParcelasInput {
    return {
      ID_FORMA_PAGAMENTO: idFormaPagamento,
      MES_ENTRADA: mesEntrada,
      DIA_ENTRADA: diaEntrada,
      NECESSIDADE_ALIMENTACAO: necessidadeAlimentacao,
      CONTRATOU_INTEGRAL: contratouIntegral,
      CONTRATOU_SEMI_INTEGRAL: contratouSemiIntegral,
      CONTRATOU_ESTENDIDO: contratouEstendido,
      PERCENTUAL_DESCONTO: percentualDesconto,
      PERCENTUAL_DESCONTO_ENTRADA: percentualDescontoEntrada,
    };
  }

  function tratarErro(err: unknown) {
    if (err instanceof ApiError) {
      setErro(err.body.mensagem ?? err.message);
      setDetalhesErro(err.body.detalhes ?? null);
    } else {
      setErro(err instanceof Error ? err.message : "Erro desconhecido.");
      setDetalhesErro(null);
    }
  }

  async function handleSimular() {
    if (!propostaId || !idFormaPagamento) return;
    setSimulando(true);
    setErro(null);
    setDetalhesErro(null);
    try {
      const res = await api.simularParcelas(propostaId, montarInput());
      setPreview(res);
    } catch (err) {
      tratarErro(err);
    } finally {
      setSimulando(false);
    }
  }

  // Recalcula a Prévia automaticamente quando algum dos dois descontos
  // (mensalidade ou entrada) é ajustado no painel expansível (só depois da
  // 1ª simulação manual, e só antes de confirmar -- uma vez congeladas, as
  // parcelas não recalculam mais, Seção 54). São independentes: mexer num
  // não altera o valor do outro.
  useEffect(() => {
    if (jaGerada || !preview || !descontoAberto) return;
    const t = setTimeout(() => {
      handleSimular();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percentualDesconto, percentualDescontoEntrada]);

  async function handleConfirmar() {
    if (!propostaId || !idFormaPagamento) return;
    setConfirmando(true);
    setErro(null);
    setDetalhesErro(null);
    try {
      const res = await api.gerarParcelas(propostaId, montarInput(), usuario);
      setPreview(res);
      setParcelasExistentes(res.parcelas);
      setDescontoPersistido(percentualDesconto);
      setDescontoEntradaPersistido(percentualDescontoEntrada);
      setToast("Proposta gerada e parcelas gravadas com sucesso (histórico congelado).");
      onGerado?.(res);
    } catch (err) {
      tratarErro(err);
    } finally {
      setConfirmando(false);
    }
  }

  const jaGerada = (parcelasExistentes?.length ?? 0) > 0;
  const podeSimular = Boolean(propostaId && idFormaPagamento) && !jaGerada;

  return (
    <div>
      {toast && (
        <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          Status da Proposta: <span className="font-medium text-slate-700">{statusProposta ?? "—"}</span>
        </p>
        {statusProposta !== "Cancelada" && (
          <button
            onClick={() => setConfirmandoCancelamento(true)}
            className="px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50"
          >
            Cancelar Proposta
          </button>
        )}
      </div>

      {statusProposta === "Cancelada" && (
        <div className="mb-6 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Esta proposta está cancelada.
        </div>
      )}

      {confirmandoCancelamento && (
        <ConfirmDialog
          title="Cancelar Proposta"
          message='Isso marca o STATUS da Proposta como "Cancelada". As parcelas já geradas (se houver) continuam gravadas e congeladas, sem alteração. Confirmar?'
          confirmLabel={cancelando ? "Cancelando..." : "Cancelar Proposta"}
          onConfirm={handleCancelarProposta}
          onCancel={() => setConfirmandoCancelamento(false)}
        />
      )}

      {jaGerada && (
        <div className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Esta proposta já teve as parcelas geradas e congeladas. Para preservar o histórico financeiro (Seção 54), o
          sistema não permite gerar novamente. A tabela abaixo mostra o que já foi gravado.
        </div>
      )}

      {checandoExistentes && !jaGerada && (
        <p className="text-xs text-slate-400 mb-4">verificando parcelas existentes...</p>
      )}

      {!jaGerada && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Forma de Pagamento</label>
              <select
                value={idFormaPagamento}
                onChange={(e) => setIdFormaPagamento(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Selecione...</option>
                {formasPagamento.map((f) => (
                  <option key={String(f.ID_FORMA_PAGAMENTO)} value={String(f.ID_FORMA_PAGAMENTO)}>
                    {String(f.NOME)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mês de entrada</label>
                <select
                  value={mesEntrada}
                  onChange={(e) => setMesEntrada(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dia de entrada</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaEntrada}
                  onChange={(e) => setDiaEntrada(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 mb-2">
            <label className="text-xs text-slate-700 flex items-center gap-1.5">
              <input type="checkbox" checked={necessidadeAlimentacao} onChange={(e) => setNecessidadeAlimentacao(e.target.checked)} />
              Alimentação
            </label>
            <label className="text-xs text-slate-700 flex items-center gap-1.5">
              <input type="checkbox" checked={contratouIntegral} onChange={(e) => setContratouIntegral(e.target.checked)} />
              Integral
            </label>
            <label className="text-xs text-slate-700 flex items-center gap-1.5">
              <input type="checkbox" checked={contratouSemiIntegral} onChange={(e) => setContratouSemiIntegral(e.target.checked)} />
              Semi-Integral
            </label>
            <label className="text-xs text-slate-700 flex items-center gap-1.5">
              <input type="checkbox" checked={contratouEstendido} onChange={(e) => setContratouEstendido(e.target.checked)} />
              Estendido
            </label>
          </div>

          <button
            onClick={handleSimular}
            disabled={!podeSimular || simulando}
            className="mt-2 px-3 py-1.5 text-sm rounded-md bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {simulando ? "Simulando..." : "Simular"}
          </button>
        </div>
      )}

      {erro && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <p>{erro}</p>
          {detalhesErro && detalhesErro.length > 0 && (
            <ul className="mt-1 list-disc list-inside">
              {detalhesErro.map((d, i) => (
                <li key={i}>{d.field}: {d.problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(preview || (jaGerada && parcelasExistentes)) && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {jaGerada ? "Parcelas gravadas" : "Prévia (não gravado)"}
            </h3>
            {!jaGerada && preview && (
              <button
                onClick={handleConfirmar}
                disabled={confirmando}
                className="px-3 py-1.5 text-sm rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark disabled:opacity-40"
              >
                {confirmando ? "Gravando..." : "Confirmar Proposta"}
              </button>
            )}
          </div>

          {!jaGerada && preview && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setDescontoAberto((v) => !v)}
                title={descontoAberto ? "Ocultar desconto" : "Aplicar desconto"}
                aria-label={descontoAberto ? "Ocultar desconto" : "Aplicar desconto"}
                className="flex flex-col items-center justify-center gap-0.5 h-7 w-7 rounded-md text-slate-400 hover:text-brand-blue-dark hover:bg-slate-100"
              >
                <span className="h-1 w-1 rounded-full bg-current" />
                <span className="h-1 w-1 rounded-full bg-current" />
                <span className="h-1 w-1 rounded-full bg-current" />
              </button>
              {descontoAberto && (
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Desconto (%) sobre Mensalidade</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={percentualDesconto}
                      onChange={(e) => setPercentualDesconto(Number(e.target.value))}
                      className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Desconto (%) sobre Entrada</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={percentualDescontoEntrada}
                      onChange={(e) => setPercentualDescontoEntrada(Number(e.target.value))}
                      className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  {simulando && <span className="text-xs text-slate-400">recalculando...</span>}
                </div>
              )}
            </div>
          )}

          {jaGerada && ((descontoPersistido !== null && descontoPersistido > 0) || (descontoEntradaPersistido !== null && descontoEntradaPersistido > 0)) && (
            <p className="text-xs text-slate-500 mb-4">
              {descontoPersistido !== null && descontoPersistido > 0 && <>Desconto na mensalidade: {descontoPersistido}%</>}
              {descontoPersistido !== null && descontoPersistido > 0 && descontoEntradaPersistido !== null && descontoEntradaPersistido > 0 && " · "}
              {descontoEntradaPersistido !== null && descontoEntradaPersistido > 0 && <>Desconto na entrada: {descontoEntradaPersistido}%</>}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-3">#</th>
                  <th className="py-1 pr-3">Mês/Ano</th>
                  <th className="py-1 pr-3 text-right">Entrada</th>
                  <th className="py-1 pr-3 text-right">Mensalidade</th>
                  <th className="py-1 pr-3 text-right">Mat. Didático</th>
                  <th className="py-1 pr-3 text-right">Mat. Inglês</th>
                  <th className="py-1 pr-3 text-right">Alimentação</th>
                  <th className="py-1 pr-3 text-right">Integral</th>
                  <th className="py-1 pr-3 text-right">Semi-Int.</th>
                  <th className="py-1 pr-3 text-right">Estendido</th>
                  <th className="py-1 pr-3 text-right font-semibold">Montante Negociado</th>
                </tr>
              </thead>
              <tbody>
                {(jaGerada ? parcelasExistentes! : preview!.parcelas).map((p) => {
                  const ehEntrada = p.numeroParcela === 0;
                  return (
                    <tr key={p.numeroParcela} className={`border-b border-slate-100 ${ehEntrada ? "bg-brand-navy/5 font-medium" : ""}`}>
                      <td className="py-1 pr-3">{p.numeroParcela === 0 ? "—" : p.numeroParcela}</td>
                      <td className="py-1 pr-3">{ehEntrada ? "Entrada" : `${MESES[p.mesReferencia - 1]}/${p.anoReferencia}`}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? fmtMoeda(p.valorEntrada) : "—"}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorMensalidade)}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorMaterialDidatico)}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorMaterialDidaticoIngles)}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorAlimentacao)}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorIntegral)}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorSemiIntegral)}</td>
                      <td className="py-1 pr-3 text-right">{ehEntrada ? "—" : fmtMoeda(p.valorEstendido)}</td>
                      <td className="py-1 pr-3 text-right font-semibold">{fmtMoeda(p.valorTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
