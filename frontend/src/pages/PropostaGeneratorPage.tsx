import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "../context/CatalogContext";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../api/client";
import { PropostaSimulacaoPanel } from "../components/PropostaSimulacaoPanel";
import { CustomSelect } from "../components/CustomSelect";
import type { RecordRow } from "../api/types";

/**
 * Gerador de Proposta com simulação de parcelas (Seção 22 do prompt mestre).
 * Não é um CRUD genérico: resolve Proposta -> Negociação -> Série/Aluno, e
 * delega a simulação/confirmação de parcelas para PropostaSimulacaoPanel
 * (compartilhado com o wizard "Fazer Proposta" — ver FazerPropostaPage.tsx).
 * Uma proposta que já teve parcelas geradas não pode gerar de novo (o
 * backend responde 409 -- ver propostaGenerator.routes.ts).
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
    <div className="p-6 min-h-full">
      <h2 className="text-lg font-semibold text-brand-navy mb-1">Gerador de Proposta</h2>
      <p className="text-xs text-slate-500 mb-6">
        Simulação de parcelas a partir da Tabela de Preços vigente. O cálculo é feito pelo backend (CalculationEngine) —
        o Excel apenas armazena o resultado. Depois de confirmada, a proposta congela os valores praticados (Seção 22/54):
        não pode ser gerada novamente. Para criar Aluno/Negociação/Proposta do zero numa tela só, use "Fazer Proposta"
        na barra lateral.
      </p>

      <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <label className="block text-xs font-medium text-slate-600 mb-1">Proposta</label>
        <CustomSelect
          ariaLabel="Proposta"
          value={propostaId}
          onChange={setPropostaId}
          placeholder="Selecione uma proposta..."
          options={propostas.map((p) => ({ value: String(p.ID_PROPOSTA), label: resolverLabel(p) }))}
        />

        {propostaSelecionada && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
            <p><span className="font-medium text-slate-500">Aluno:</span> {alunoSelecionado ? String(alunoSelecionado.NOME) : "—"}</p>
            <p><span className="font-medium text-slate-500">Série:</span> {serieSelecionada ? String(serieSelecionada.NOME) : "—"}</p>
            <p><span className="font-medium text-slate-500">Status da proposta:</span> {String(propostaSelecionada.STATUS ?? "—")}</p>
          </div>
        )}
      </div>

      {propostaId && (
        <PropostaSimulacaoPanel
          key={propostaId}
          propostaId={propostaId}
          formasPagamento={formasPagamento}
          usuario={usuario}
          aluno={alunoSelecionado ?? null}
          serie={serieSelecionada ?? null}
        />
      )}
    </div>
  );
}
