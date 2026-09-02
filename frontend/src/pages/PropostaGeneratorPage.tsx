import { useCallback, useEffect, useMemo, useState } from "react";
import { useCatalog } from "../context/CatalogContext";
import { useUsuario } from "../hooks/useUsuario";
import { api, ApiError } from "../api/client";
import type { GerarParcelasInput, ParcelaProposta, RecordRow } from "../api/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Gerador de Proposta com simulação de parcelas (Seção 22 do prompt mestre).
 * Não é um CRUD genérico: resolve Proposta -> Negociação -> Série/Aluno,
 * chama o motor de cálculo do backend (propostaEngine.ts) em modo preview
 * para simular, e só grava (congelando o histórico, Seção 54) quando o
 * usuário confirma. Uma proposta que já teve parcelas geradas não pode
 * gerar de novo (o backend responde 409 -- ver propostaGenerator.routes.ts).
 */
export function PropostaGeneratorPage() {
  const { resourceBySlug } = useCatalog();
  const [usuario] = useUsuario();

  const [propostas, setPropostas] = useState<RecordRow[]>([]);
  const [negociacoes, setNegociacoes] = useState<RecordRow[]>([]);
  const [alunos, setAlunos] = useState<RecordRow[]>([]);
  const [series, setSeries] = useState<RecordRow[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<RecordRow[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [baseError, setBaseError] = useState<string | null>(null);

  const [propostaId, setPropostaId] = useState<string>("");
  const [parcelasExistentes, setParcelasExistentes] = useState<ParcelaProposta[] | null>(null);
  const [checandoExistentes, setChecandoExistentes] = useState(false);

  const [idFormaPagamento, setIdFormaPagamento] = useState("");
  const [mesEntrada, setMesEntrada] = useState(1);
  const [diaEntrada, setDiaEntrada] = useState(1);
  const [necessidadeAlimentacao, setNecessidadeAlimentacao] = useState(false);
  const [contratouIntegral, setContratouIntegral] = useState(false);
  const [contratouSemiIntegral, setContratouSemiIntegral] = useState(false);
  const [contratouEstendido, setContratouEstendido] = useState(false);

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
    async function load() {
      setLoadingBase(true);
      setBaseError(null);
      try {
        const propostasResource = resourceBySlug.get("propostas");
        const negociacoesResource = resourceBySlug.get("negociacoes");
        const alunosResource = resourceBySlug.get("alunos");
        const seriesResource = resourceBySlug.get("series");
        const formasResource = resourceBySlug.get("formas-pagamento");
        if (!propostasResource || !negociacoesResource || !alunosResource || !seriesResource || !formasResource) {
          throw new Error("Catálogo ainda não carregou os recursos necessários (Propostas/Negociações/Séries/Formas de Pagamento).");
        }
        const [p, n, a, s, f] = await Promise.all([
          api.list(propostasResource),
          api.list(negociacoesResource),
          api.list(alunosResource, { ativo: "true" }),
          api.list(seriesResource, { ativo: "true" }),
          api.list(formasResource, { ativo: "true" }),
        ]);
        setPropostas(p);
        setNegociacoes(n);
        setAlunos(a);
        setSeries(s);
        setFormasPagamento(f);
      } catch (err) {
        setBaseError(err instanceof Error ? err.message : "Não foi possível carregar os dados base.");
      } finally {
        setLoadingBase(false);
      }
    }
    load();
  }, [resourceBySlug]);

  const negociacaoPorId = useMemo(() => new Map(negociacoes.map((n) => [String(n.ID_NEGOCIACAO), n])), [negociacoes]);
  const alunoPorId = useMemo(() => new Map(alunos.map((a) => [String(a.ID_ALUNO), a])), [alunos]);
  const seriePorId = useMemo(() => new Map(series.map((s) => [String(s.ID_SERIE), s])), [series]);

  function resolverLabel(proposta: RecordRow): string {
    const neg = negociacaoPorId.get(String(proposta.ID_NEGOCIACAO));
    const aluno = neg ? alunoPorId.get(String(neg.ID_ALUNO)) : undefined;
    const serie = neg ? seriePorId.get(String(neg.ID_SERIE)) : undefined;
    const partes = [
      String(proposta.ID_PROPOSTA),
      aluno ? String(aluno.NOME) : "(sem aluno vinculado)",
      serie ? String(serie.NOME) : "(sem série)",
      String(proposta.STATUS ?? ""),
    ];
    return partes.filter(Boolean).join(" — ");
  }

  const propostaSelecionada = propostas.find((p) => String(p.ID_PROPOSTA) === propostaId) ?? null;
  const negociacaoSelecionada = propostaSelecionada ? negociacaoPorId.get(String(propostaSelecionada.ID_NEGOCIACAO)) : undefined;
  const alunoSelecionado = negociacaoSelecionada ? alunoPorId.get(String(negociacaoSelecionada.ID_ALUNO)) : undefined;
  const serieSelecionada = negociacaoSelecionada ? seriePorId.get(String(negociacaoSelecionada.ID_SERIE)) : undefined;

  const checarExistentes = useCallback(async (id: string) => {
    if (!id) {
      setParcelasExistentes(null);
      return;
    }
    setChecandoExistentes(true);
    try {
      const existentes = await api.listarParcelas(id);
      setParcelasExistentes(existentes);
    } catch {
      setParcelasExistentes(null);
    } finally {
      setChecandoExistentes(false);
    }
  }, []);

  function selecionarProposta(id: string) {
    setPropostaId(id);
    setPreview(null);
    setErro(null);
    setDetalhesErro(null);
    checarExistentes(id);
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
    setPreview(null);
    try {
      const res = await api.simularParcelas(propostaId, montarInput());
      setPreview(res);
    } catch (err) {
      tratarErro(err);
    } finally {
      setSimulando(false);
    }
  }

  async function handleConfirmar() {
    if (!propostaId || !idFormaPagamento) return;
    setConfirmando(true);
    setErro(null);
    setDetalhesErro(null);
    try {
      const res = await api.gerarParcelas(propostaId, montarInput(), usuario);
      setPreview(res);
      setParcelasExistentes(res.parcelas);
      setToast("Proposta gerada e parcelas gravadas com sucesso (histórico congelado).");
    } catch (err) {
      tratarErro(err);
    } finally {
      setConfirmando(false);
    }
  }

  const jaGerada = (parcelasExistentes?.length ?? 0) > 0;
  const podeSimular = Boolean(propostaId && idFormaPagamento) && !jaGerada;

  if (loadingBase) {
    return <div className="p-8 text-slate-500 text-sm">Carregando dados base do gerador de proposta...</div>;
  }

  if (baseError) {
    return (
      <div className="p-8 max-w-md">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{baseError}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Gerador de Proposta</h2>
      <p className="text-xs text-slate-500 mb-6">
        Simulação de parcelas a partir da Tabela de Preços vigente. O cálculo é feito pelo backend (CalculationEngine) —
        o Excel apenas armazena o resultado. Depois de confirmada, a proposta congela os valores praticados (Seção 22/54):
        não pode ser gerada novamente.
      </p>

      {toast && (
        <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{toast}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <label className="block text-xs font-medium text-slate-600 mb-1">Proposta</label>
        <select
          value={propostaId}
          onChange={(e) => selecionarProposta(e.target.value)}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">Selecione uma proposta...</option>
          {propostas.map((p) => (
            <option key={String(p.ID_PROPOSTA)} value={String(p.ID_PROPOSTA)}>
              {resolverLabel(p)}
            </option>
          ))}
        </select>

        {propostaSelecionada && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
            <p><span className="font-medium text-slate-500">Aluno:</span> {alunoSelecionado ? String(alunoSelecionado.NOME) : "—"}</p>
            <p><span className="font-medium text-slate-500">Série:</span> {serieSelecionada ? String(serieSelecionada.NOME) : "—"}</p>
            <p><span className="font-medium text-slate-500">Status da proposta:</span> {String(propostaSelecionada.STATUS ?? "—")}</p>
            <p>
              <span className="font-medium text-slate-500">Parcelas já geradas:</span>{" "}
              {checandoExistentes ? "verificando..." : jaGerada ? `Sim (${parcelasExistentes?.length})` : "Não"}
            </p>
          </div>
        )}
      </div>

      {jaGerada && (
        <div className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Esta proposta já teve as parcelas geradas e congeladas. Para preservar o histórico financeiro (Seção 54), o
          sistema não permite gerar novamente. A tabela abaixo mostra o que já foi gravado.
        </div>
      )}

      {propostaId && !jaGerada && (
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

          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
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
                className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {confirmando ? "Gravando..." : "Confirmar Proposta"}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1 pr-3">#</th>
                  <th className="py-1 pr-3">Mês/Ano</th>
                  <th className="py-1 pr-3 text-right">Mensalidade</th>
                  <th className="py-1 pr-3 text-right">Mat. Didático</th>
                  <th className="py-1 pr-3 text-right">Mat. Inglês</th>
                  <th className="py-1 pr-3 text-right">Alimentação</th>
                  <th className="py-1 pr-3 text-right">Integral</th>
                  <th className="py-1 pr-3 text-right">Semi-Int.</th>
                  <th className="py-1 pr-3 text-right">Estendido</th>
                  <th className="py-1 pr-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {(jaGerada ? parcelasExistentes! : preview!.parcelas).map((p) => (
                  <tr key={p.numeroParcela} className="border-b border-slate-100">
                    <td className="py-1 pr-3">{p.numeroParcela}</td>
                    <td className="py-1 pr-3">{MESES[p.mesReferencia - 1]}/{p.anoReferencia}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorMensalidade)}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorMaterialDidatico)}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorMaterialDidaticoIngles)}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorAlimentacao)}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorIntegral)}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorSemiIntegral)}</td>
                    <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorEstendido)}</td>
                    <td className="py-1 pr-3 text-right font-semibold">{fmtMoeda(p.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
