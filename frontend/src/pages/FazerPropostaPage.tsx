import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "../context/CatalogContext";
import { useUsuario } from "../hooks/useUsuario";
import { api } from "../api/client";
import { RecordFormModal } from "../components/RecordFormModal";
import { PropostaSimulacaoPanel } from "../components/PropostaSimulacaoPanel";
import { WizardProgressTrail, type WizardStep } from "../components/WizardProgressTrail";
import { PressButton } from "../components/PressButton";
import { CustomSelect } from "../components/CustomSelect";
import { encontrarPropostaRascunho } from "../lib/propostaRascunho";
import type { RecordRow } from "../api/types";

type ModalAberto = "novo-aluno" | "nova-negociacao" | "editar-aluno" | "editar-negociacao" | null;

/**
 * Wizard "Fazer Proposta": tela única que conduz Aluno -> Negociação ->
 * Proposta (criada automaticamente) -> simulação -> confirmação, sem sair
 * da tela. Reaproveita RecordFormModal (para criar/editar Aluno e
 * Negociação) e PropostaSimulacaoPanel (para simular/confirmar parcelas —
 * mesma lógica do "Gerador de Proposta" legado). Nenhuma rota nova: Aluno,
 * Negociação e Proposta são criados via api.create (CRUD genérico); as
 * parcelas continuam sendo geradas pela rota dedicada existente.
 *
 * Depois de confirmada, a Proposta fica congelada (Seção 54) — "modificar"
 * aqui significa editar os dados cadastrais de Aluno/Negociação (não as
 * parcelas) ou criar uma nova Proposta (nova versão, reaproveitando a mesma
 * Negociação), preservando a anterior intacta no histórico.
 */
export function FazerPropostaPage() {
  const { resourceBySlug, invalidate } = useCatalog();
  const [usuario] = useUsuario();

  const [alunos, setAlunos] = useState<RecordRow[]>([]);
  const [negociacoes, setNegociacoes] = useState<RecordRow[]>([]);
  const [series, setSeries] = useState<RecordRow[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<RecordRow[]>([]);
  const [statusNegociacao, setStatusNegociacao] = useState<RecordRow[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [baseError, setBaseError] = useState<string | null>(null);

  const [alunoId, setAlunoId] = useState("");
  const [negociacaoId, setNegociacaoId] = useState("");
  const [tabelaPrecoAtiva, setTabelaPrecoAtiva] = useState<RecordRow | null>(null);

  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [criandoProposta, setCriandoProposta] = useState(false);
  const [erroProposta, setErroProposta] = useState<string | null>(null);
  const [modoPosConfirmacao, setModoPosConfirmacao] = useState(false);

  const [modalAberto, setModalAberto] = useState<ModalAberto>(null);

  // "Criar Nova Proposta" (handleNovaVersao) precisa sempre criar uma
  // Proposta nova de verdade, nunca reaproveitar um rascunho -- ver
  // encontrarPropostaRascunho abaixo. Usa ref (não state) porque só serve
  // pra avisar a próxima execução do efeito de auto-criação, sem precisar
  // disparar re-render.
  const forcarNovaPropostaRef = useRef(false);

  useEffect(() => {
    async function load() {
      setLoadingBase(true);
      setBaseError(null);
      try {
        const alunosResource = resourceBySlug.get("alunos");
        const negociacoesResource = resourceBySlug.get("negociacoes");
        const seriesResource = resourceBySlug.get("series");
        const formasResource = resourceBySlug.get("formas-pagamento");
        const statusResource = resourceBySlug.get("status-negociacao");
        if (!alunosResource || !negociacoesResource || !seriesResource || !formasResource || !statusResource) {
          throw new Error("Catálogo ainda não carregou os recursos necessários (Alunos/Negociações/Séries/Formas de Pagamento/Status).");
        }
        const [a, n, s, f, st] = await Promise.all([
          api.list(alunosResource, { ativo: "true" }),
          api.list(negociacoesResource),
          api.list(seriesResource, { ativo: "true" }),
          api.list(formasResource, { ativo: "true" }),
          api.list(statusResource),
        ]);
        setAlunos(a);
        setNegociacoes(n);
        setSeries(s);
        setFormasPagamento(f);
        setStatusNegociacao(st);
      } catch (err) {
        setBaseError(err instanceof Error ? err.message : "Não foi possível carregar os dados base.");
      } finally {
        setLoadingBase(false);
      }
    }
    load();
  }, [resourceBySlug]);

  const seriePorId = useMemo(() => new Map(series.map((s) => [String(s.ID_SERIE), s])), [series]);
  const statusPorId = useMemo(() => new Map(statusNegociacao.map((s) => [String(s.ID_STATUS_NEGOCIACAO), s])), [statusNegociacao]);

  const alunoSelecionado = alunos.find((a) => String(a.ID_ALUNO) === alunoId) ?? null;
  const negociacoesDoAluno = useMemo(
    () => negociacoes.filter((n) => String(n.ID_ALUNO) === alunoId),
    [negociacoes, alunoId],
  );
  const negociacaoSelecionada = negociacoesDoAluno.find((n) => String(n.ID_NEGOCIACAO) === negociacaoId) ?? null;
  const serieIdAtual = negociacaoSelecionada ? String(negociacaoSelecionada.ID_SERIE) : "";
  const serieAtual = serieIdAtual ? seriePorId.get(serieIdAtual) : undefined;

  function resolverLabelNegociacao(n: RecordRow): string {
    const serie = seriePorId.get(String(n.ID_SERIE));
    const status = statusPorId.get(String(n.ID_STATUS_NEGOCIACAO));
    const partes = [String(n.ID_NEGOCIACAO), serie ? String(serie.NOME) : "(sem série)", status ? String(status.NOME) : ""];
    return partes.filter(Boolean).join(" — ");
  }

  // Tabela de Preços ativa da Série da Negociação (só exibição -- a validação
  // "de verdade" já é feita pela rota de geração de parcelas ao confirmar).
  useEffect(() => {
    let cancelled = false;
    async function carregar() {
      if (!serieIdAtual) {
        setTabelaPrecoAtiva(null);
        return;
      }
      const tabelaPrecosResource = resourceBySlug.get("tabela-precos");
      if (!tabelaPrecosResource) return;
      try {
        const rows = await api.list(tabelaPrecosResource, { id_serie: serieIdAtual, ativo: "true" });
        if (!cancelled) setTabelaPrecoAtiva(rows[0] ?? null);
      } catch {
        if (!cancelled) setTabelaPrecoAtiva(null);
      }
    }
    carregar();
    return () => {
      cancelled = true;
    };
  }, [serieIdAtual, resourceBySlug]);

  // Cria a Proposta automaticamente assim que a Negociação está definida --
  // mas antes, reaproveita uma Proposta em rascunho já existente para essa
  // Negociação (nenhuma parcela gerada ainda), se houver. Sem isso, reabrir
  // o wizard na mesma Negociação (mesmo só pra consultar, sem confirmar
  // nada) acumulava uma Proposta órfã nova a cada vez.
  useEffect(() => {
    if (!negociacaoId || propostaId !== null) return;
    const forcarNova = forcarNovaPropostaRef.current;
    forcarNovaPropostaRef.current = false;
    let cancelled = false;

    async function resolverProposta() {
      setCriandoProposta(true);
      setErroProposta(null);
      try {
        const propostasResource = resourceBySlug.get("propostas");
        if (!propostasResource) throw new Error("Recurso 'propostas' não encontrado no catálogo.");
        const candidatas = forcarNova ? [] : await api.list(propostasResource, { id_negociacao: negociacaoId });
        const rascunho = forcarNova ? null : await encontrarPropostaRascunho(candidatas, api.listarParcelas);
        if (rascunho) {
          if (!cancelled) setPropostaId(rascunho);
          return;
        }
        const hoje = new Date().toISOString().slice(0, 10);
        const criada = await api.create(propostasResource, { ID_NEGOCIACAO: negociacaoId, DATA_PROPOSTA: hoje, STATUS: "Criada" }, usuario);
        if (!cancelled) setPropostaId(String(criada.ID_PROPOSTA));
      } catch (err) {
        if (!cancelled) setErroProposta(err instanceof Error ? err.message : "Não foi possível criar/carregar a Proposta.");
      } finally {
        if (!cancelled) setCriandoProposta(false);
      }
    }
    resolverProposta();
    return () => {
      cancelled = true;
    };
  }, [negociacaoId, propostaId, resourceBySlug, usuario]);

  function selecionarAluno(id: string) {
    forcarNovaPropostaRef.current = false;
    setAlunoId(id);
    setNegociacaoId("");
    setPropostaId(null);
    setModoPosConfirmacao(false);
  }

  function selecionarNegociacao(id: string) {
    forcarNovaPropostaRef.current = false;
    setNegociacaoId(id);
    setPropostaId(null);
    setModoPosConfirmacao(false);
  }

  // "Criar Nova Proposta": sempre cria uma versão nova de verdade (nunca
  // reaproveita rascunho), mesmo que já exista uma Proposta confirmada para
  // essa Negociação -- é assim que se registra uma nova versão.
  function handleNovaVersao() {
    forcarNovaPropostaRef.current = true;
    setPropostaId(null);
    setModoPosConfirmacao(false);
  }

  const alunosResource = resourceBySlug.get("alunos")!;
  const negociacoesResource = resourceBySlug.get("negociacoes")!;

  if (loadingBase) {
    return <div className="p-8 text-slate-500 text-sm">Carregando dados base do wizard de proposta...</div>;
  }

  if (baseError) {
    return (
      <div className="p-8 max-w-md">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{baseError}</p>
      </div>
    );
  }

  // Progresso real do wizard (2026-10-12): "Série"/"Proposta" (④ antigo) eram
  // derivados automaticamente no exato instante em que a Negociação é
  // escolhida (sem ação própria do usuário), então não viram passo -- os 4
  // marcos sequenciais de verdade são Aluno -> Negociação -> Proposta
  // (criação assíncrona) -> Confirmação (parcelas geradas).
  const wizardSteps: WizardStep[] = [
    { label: "Aluno", status: alunoId ? "done" : "current" },
    { label: "Negociação", status: negociacaoId ? "done" : alunoId ? "current" : "pending" },
    { label: "Proposta", status: propostaId ? "done" : negociacaoId ? "current" : "pending" },
    { label: "Confirmação", status: modoPosConfirmacao ? "done" : propostaId ? "current" : "pending" },
  ];

  const painelSimulacao = propostaId && (
    <PropostaSimulacaoPanel
      key={propostaId}
      propostaId={propostaId}
      formasPagamento={formasPagamento}
      usuario={usuario}
      aluno={alunoSelecionado}
      serie={serieAtual ?? null}
      onGerado={() => setModoPosConfirmacao(true)}
    />
  );

  return (
    <div className="p-6 min-h-full">
      <h2 className="text-lg font-semibold text-brand-navy mb-1">Fazer Proposta</h2>
      <p className="text-xs text-slate-500 mb-6">
        Monte a Proposta do zero numa tela só: escolha ou crie o Aluno, escolha ou crie a Negociação, e a Proposta é
        criada automaticamente. Para gerenciar uma Proposta já existente sem passar por aqui, use "Gerador de
        Proposta" na barra lateral.
      </p>

      <div className="max-w-2xl">
        <WizardProgressTrail steps={wizardSteps} />

        {/* Aluno */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <label className="block text-xs font-medium text-slate-600 mb-1">Aluno</label>
          <div className="flex gap-2">
            <CustomSelect
              ariaLabel="Aluno"
              className="flex-1"
              value={alunoId}
              onChange={selecionarAluno}
              placeholder="Selecione um aluno..."
              options={alunos.map((a) => ({ value: String(a.ID_ALUNO), label: String(a.NOME) }))}
            />
            <PressButton onClick={() => setModalAberto("novo-aluno")}>+ Novo Aluno</PressButton>
          </div>
        </div>

        {/* Negociação */}
        {alunoId && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Negociação</label>
            <div className="flex gap-2">
              <CustomSelect
                ariaLabel="Negociação"
                className="flex-1"
                value={negociacaoId}
                onChange={selecionarNegociacao}
                placeholder="Selecione uma negociação..."
                options={negociacoesDoAluno.map((n) => ({ value: String(n.ID_NEGOCIACAO), label: resolverLabelNegociacao(n) }))}
              />
              <PressButton onClick={() => setModalAberto("nova-negociacao")}>+ Nova Negociação</PressButton>
            </div>
          </div>
        )}

        {/* Série & Tabela de Preços (derivado, readonly) */}
        {negociacaoId && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Série</label>
            <p className="text-sm text-slate-800 mb-2">{serieAtual ? String(serieAtual.NOME) : "—"}</p>
            {tabelaPrecoAtiva ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-slate-600">
                <p><span className="font-medium text-slate-500">Mensalidade:</span> {String(tabelaPrecoAtiva.MENSALIDADE)}</p>
                <p><span className="font-medium text-slate-500">Mat. Didático:</span> {String(tabelaPrecoAtiva.MATERIAL_DIDATICO)}</p>
                <p><span className="font-medium text-slate-500">Mat. Inglês:</span> {String(tabelaPrecoAtiva.MATERIAL_DIDATICO_INGLES)}</p>
                <p><span className="font-medium text-slate-500">Alimentação:</span> {String(tabelaPrecoAtiva.ALIMENTACAO)}</p>
              </div>
            ) : (
              <p className="text-xs text-amber-700">Nenhuma Tabela de Preços ativa encontrada para esta série.</p>
            )}
          </div>
        )}

        {/* Proposta (auto-criada) */}
        {negociacaoId && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Proposta</label>
            {criandoProposta && <p className="text-sm text-slate-500">Criando proposta...</p>}
            {erroProposta && <p className="text-sm text-red-700">{erroProposta}</p>}
            {propostaId && !criandoProposta && <p className="text-sm text-slate-800">Proposta Nº {propostaId} criada.</p>}
          </div>
        )}
      </div>

      {/* Simulação/Confirmação + pós-confirmação */}
      {propostaId &&
        (modoPosConfirmacao ? (
          <div className="grid grid-cols-[260px_1fr] gap-6">
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs space-y-1.5">
                <p><span className="font-medium text-slate-500">Aluno:</span> {alunoSelecionado ? String(alunoSelecionado.NOME) : "—"}</p>
                <p><span className="font-medium text-slate-500">Série:</span> {serieAtual ? String(serieAtual.NOME) : "—"}</p>
                <p><span className="font-medium text-slate-500">Negociação:</span> {negociacaoId}</p>
                <p><span className="font-medium text-slate-500">Proposta:</span> {propostaId}</p>
              </div>
              <button
                onClick={() => setModalAberto("editar-aluno")}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Editar Aluno
              </button>
              <button
                onClick={() => setModalAberto("editar-negociacao")}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Editar Negociação
              </button>
              <button
                onClick={handleNovaVersao}
                className="w-full px-3 py-1.5 text-xs rounded-md bg-brand-blue text-white hover:bg-brand-blue-dark"
              >
                Criar Nova Proposta
              </button>
              <p className="text-[11px] text-slate-400">
                As edições acima só alteram dados cadastrais — as parcelas já gravadas continuam congeladas.
                "Criar Nova Proposta" gera uma nova versão a partir da mesma Negociação, preservando esta intacta.
              </p>
            </div>
            <div>{painelSimulacao}</div>
          </div>
        ) : (
          painelSimulacao
        ))}

      {modalAberto === "novo-aluno" && (
        <RecordFormModal
          resource={alunosResource}
          record={null}
          usuario={usuario}
          onClose={() => setModalAberto(null)}
          onSaved={(saved) => {
            setAlunos((prev) => [...prev, saved]);
            invalidate("Alunos");
            selecionarAluno(String(saved.ID_ALUNO));
            setModalAberto(null);
          }}
        />
      )}

      {modalAberto === "nova-negociacao" && (
        <RecordFormModal
          resource={negociacoesResource}
          record={null}
          initialValues={{ ID_ALUNO: alunoId }}
          usuario={usuario}
          onClose={() => setModalAberto(null)}
          onSaved={(saved) => {
            setNegociacoes((prev) => [...prev, saved]);
            invalidate("Negociacoes");
            selecionarNegociacao(String(saved.ID_NEGOCIACAO));
            setModalAberto(null);
          }}
        />
      )}

      {modalAberto === "editar-aluno" && alunoSelecionado && (
        <RecordFormModal
          resource={alunosResource}
          record={alunoSelecionado}
          usuario={usuario}
          onClose={() => setModalAberto(null)}
          onSaved={(saved) => {
            setAlunos((prev) => prev.map((a) => (String(a.ID_ALUNO) === String(saved.ID_ALUNO) ? saved : a)));
            invalidate("Alunos");
            setModalAberto(null);
          }}
        />
      )}

      {modalAberto === "editar-negociacao" && negociacaoSelecionada && (
        <RecordFormModal
          resource={negociacoesResource}
          record={negociacaoSelecionada}
          usuario={usuario}
          onClose={() => setModalAberto(null)}
          onSaved={(saved) => {
            setNegociacoes((prev) => prev.map((n) => (String(n.ID_NEGOCIACAO) === String(saved.ID_NEGOCIACAO) ? saved : n)));
            invalidate("Negociacoes");
            setModalAberto(null);
          }}
        />
      )}
    </div>
  );
}
