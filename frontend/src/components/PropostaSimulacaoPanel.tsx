import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useCatalog } from "../context/CatalogContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { CustomSelect } from "./CustomSelect";
import { CalendarField } from "./CalendarField";
import { ToggleSwitch } from "./ToggleSwitch";
import { HamburgerToggleIcon } from "./HamburgerToggleIcon";
import { fieldLabel } from "../lib/fieldLabels";
import logoNavegantes from "../assets/logo-navegantes.webp";
import type { GerarParcelasInput, ParcelaProposta, RecordRow } from "../api/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Cor do badge de STATUS da Proposta (enum fixo -- ver backend/src/schema/files.ts,
 * aba Propostas) -- mesmo padrão de pill já usado em DataTable.tsx pro Ativo/Inativo,
 * reaproveitando as cores de sistema já estabelecidas (azul = em andamento, verde =
 * sucesso, vermelho = recusada, cinza = encerrada sem sucesso). */
const STATUS_PROPOSTA_ESTILO: Record<string, string> = {
  Criada: "bg-brand-blue/10 text-brand-blue-dark",
  Aprovada: "bg-brand-blue/10 text-brand-blue-dark",
  Aceita: "bg-emerald-50 text-emerald-700",
  Recusada: "bg-red-50 text-red-700",
  Cancelada: "bg-slate-100 text-slate-500",
};

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

interface Props {
  propostaId: string;
  formasPagamento: RecordRow[];
  usuario: string;
  /** Aluno e Série já resolvidos pela tela-pai (FazerPropostaPage/PropostaGeneratorPage já
   * fazem essa resolução Proposta -> Negociação -> Aluno/Série) -- só para exibição no
   * cabeçalho de identificação (Seção "layout parecido com o Excel", 2026-09-13). */
  aluno?: RecordRow | null;
  serie?: RecordRow | null;
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
 */
export function PropostaSimulacaoPanel({ propostaId, formasPagamento, usuario, aluno, serie, onGerado }: Props) {
  const { resourceBySlug } = useCatalog();
  const [parcelasExistentes, setParcelasExistentes] = useState<ParcelaProposta[] | null>(null);
  const [checandoExistentes, setChecandoExistentes] = useState(false);

  const [statusProposta, setStatusProposta] = useState<string | null>(null);
  const [anoProposta, setAnoProposta] = useState<number | null>(null);
  const [responsavelFinanceiro, setResponsavelFinanceiro] = useState<RecordRow | null>(null);
  const [descontoPersistido, setDescontoPersistido] = useState<number | null>(null);
  const [descontoEntradaPersistido, setDescontoEntradaPersistido] = useState<number | null>(null);
  const [dataPagamentoEntradaPersistida, setDataPagamentoEntradaPersistida] = useState<string | null>(null);
  const [qtdParcelasMaterialInglesPersistida, setQtdParcelasMaterialInglesPersistida] = useState<number | null>(null);
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
  const [dataPagamentoEntrada, setDataPagamentoEntrada] = useState("");
  const [percentualDescontoEntrada, setPercentualDescontoEntrada] = useState(0);
  const [quantidadeParcelasMaterialIngles, setQuantidadeParcelasMaterialIngles] = useState(4);

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
      setDataPagamentoEntradaPersistida(typeof rec.DATA_PAGAMENTO_ENTRADA === "string" ? rec.DATA_PAGAMENTO_ENTRADA : null);
      setQtdParcelasMaterialInglesPersistida(
        typeof rec.QUANTIDADE_PARCELAS_MATERIAL_INGLES === "number" ? rec.QUANTIDADE_PARCELAS_MATERIAL_INGLES : null,
      );
      const dataProposta = typeof rec.DATA_PROPOSTA === "string" ? rec.DATA_PROPOSTA : null;
      setAnoProposta(dataProposta ? new Date(dataProposta).getUTCFullYear() : null);
    } catch {
      setStatusProposta(null);
      setDescontoPersistido(null);
      setDescontoEntradaPersistido(null);
      setDataPagamentoEntradaPersistida(null);
      setQtdParcelasMaterialInglesPersistida(null);
      setAnoProposta(null);
    }
  }

  useEffect(() => {
    carregarStatusProposta();
  }, [propostaId, resourceBySlug]);

  // Responsável Financeiro do aluno (cabeçalho de identificação, Seção "layout
  // parecido com o Excel", 2026-09-13): um aluno pode ter mais de um Responsável
  // vinculado (ResponsaveisFinanceiros, N:N com TIPO Legal/Financeiro/Legal e
  // Financeiro) -- prioriza o vínculo "Financeiro", depois "Legal e Financeiro",
  // conforme decisão do usuário (o documento real só tem espaço para um nome).
  // Telefone/Email adicionados em 2026-09-15 (mesma prioridade, exibidos junto
  // do Nome) -- ver RecordFormModal.tsx, onde o vínculo agora é exigido.
  useEffect(() => {
    let cancelled = false;
    async function carregarResponsavel() {
      const idAluno = aluno ? String(aluno.ID_ALUNO) : "";
      if (!idAluno) {
        setResponsavelFinanceiro(null);
        return;
      }
      const vinculosResource = resourceBySlug.get("vinculos-responsavel");
      const responsaveisResource = resourceBySlug.get("responsaveis");
      if (!vinculosResource || !responsaveisResource) return;
      try {
        const vinculos = await api.list(vinculosResource, { id_aluno: idAluno, ativo: "true" });
        const vinculo =
          vinculos.find((v) => v.TIPO === "Financeiro") ??
          vinculos.find((v) => v.TIPO === "Legal e Financeiro") ??
          null;
        if (!vinculo) {
          if (!cancelled) setResponsavelFinanceiro(null);
          return;
        }
        const responsavel = await api.get(responsaveisResource, String(vinculo.ID_RESPONSAVEL));
        if (!cancelled) setResponsavelFinanceiro(responsavel);
      } catch {
        if (!cancelled) setResponsavelFinanceiro(null);
      }
    }
    carregarResponsavel();
    return () => {
      cancelled = true;
    };
  }, [aluno, resourceBySlug]);

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
      DATA_PAGAMENTO_ENTRADA: dataPagamentoEntrada,
      PERCENTUAL_DESCONTO_ENTRADA: percentualDescontoEntrada,
      QUANTIDADE_PARCELAS_MATERIAL_INGLES: quantidadeParcelasMaterialIngles,
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

  // Recalcula a Prévia automaticamente quando o desconto é ajustado no painel
  // expansível (só depois da 1ª simulação manual, e só antes de confirmar --
  // uma vez congeladas, as parcelas não recalculam mais, Seção 54).
  useEffect(() => {
    if (jaGerada || !preview || !descontoAberto) return;
    const t = setTimeout(() => {
      handleSimular();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percentualDesconto, percentualDescontoEntrada, quantidadeParcelasMaterialIngles]);

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
      setDataPagamentoEntradaPersistida(dataPagamentoEntrada);
      setQtdParcelasMaterialInglesPersistida(quantidadeParcelasMaterialIngles);
      setToast("Proposta gerada e parcelas gravadas com sucesso (histórico congelado).");
      onGerado?.(res);
    } catch (err) {
      tratarErro(err);
    } finally {
      setConfirmando(false);
    }
  }

  const jaGerada = (parcelasExistentes?.length ?? 0) > 0;
  const podeSimular = Boolean(propostaId && idFormaPagamento && dataPagamentoEntrada) && !jaGerada;

  const cabecalhoIdentificacao = (
    <div id="cabecalho-identificacao-impressao" className="bg-brand-navy text-white rounded-lg px-6 py-5 mb-5 flex items-center gap-5">
      <img
        src={logoNavegantes}
        alt="Sas Navegantes"
        className="h-16 w-16 rounded-full bg-white/95 p-2 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-amber">
          Proposta Financeira{anoProposta ? ` ${anoProposta}` : ""}
        </p>
        <h2 className="text-lg font-semibold leading-tight truncate">{aluno ? String(aluno.NOME) : "—"}</h2>
        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-0.5 text-xs text-white/80">
          <p><span className="text-white/50">Série:</span> {serie ? String(serie.NOME) : "—"}</p>
          <p><span className="text-white/50">Sexo:</span> {aluno?.GENERO ? String(aluno.GENERO) : "—"}</p>
          <p>
            <span className="text-white/50">Nascimento:</span>{" "}
            {aluno?.DATA_NASCIMENTO ? fmtData(String(aluno.DATA_NASCIMENTO)) : "—"}
          </p>
          <p><span className="text-white/50">Responsável:</span> {responsavelFinanceiro ? String(responsavelFinanceiro.NOME) : "—"}</p>
          <p>
            <span className="text-white/50">Telefone:</span>{" "}
            {responsavelFinanceiro?.TELEFONE ? String(responsavelFinanceiro.TELEFONE) : "—"}
          </p>
          <p>
            <span className="text-white/50">Email:</span>{" "}
            {responsavelFinanceiro?.EMAIL ? String(responsavelFinanceiro.EMAIL) : "—"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {toast && (
        <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500 flex items-center gap-2">
          Status da Proposta:
          {statusProposta ? (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_PROPOSTA_ESTILO[statusProposta] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {statusProposta}
            </span>
          ) : (
            <span className="font-medium text-slate-700">—</span>
          )}
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
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Forma de Pagamento</label>
              <CustomSelect
                ariaLabel="Forma de Pagamento"
                value={idFormaPagamento}
                onChange={setIdFormaPagamento}
                options={formasPagamento.map((f) => ({
                  value: String(f.ID_FORMA_PAGAMENTO),
                  label: String(f.NOME),
                }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mês de entrada</label>
                <CustomSelect
                  ariaLabel="Mês de entrada"
                  value={String(mesEntrada)}
                  onChange={(v) => setMesEntrada(Number(v))}
                  options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dia de entrada</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaEntrada}
                  onChange={(e) => setDiaEntrada(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm transition-colors hover:border-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data de pagamento da Entrada</label>
              <CalendarField
                ariaLabel="Data de pagamento da Entrada"
                value={dataPagamentoEntrada}
                onChange={setDataPagamentoEntrada}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 mb-2">
            <ToggleSwitch
              className="text-xs text-slate-700"
              checked={necessidadeAlimentacao}
              onChange={setNecessidadeAlimentacao}
              label="Alimentação"
            />
            <ToggleSwitch
              className="text-xs text-slate-700"
              checked={contratouIntegral}
              onChange={setContratouIntegral}
              label="Integral"
            />
            <ToggleSwitch
              className="text-xs text-slate-700"
              checked={contratouSemiIntegral}
              onChange={setContratouSemiIntegral}
              label="Semi-Integral"
            />
            <ToggleSwitch
              className="text-xs text-slate-700"
              checked={contratouEstendido}
              onChange={setContratouEstendido}
              label="Estendido"
            />
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
                <li key={i}>{fieldLabel(d.field)}: {d.problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(preview || (jaGerada && parcelasExistentes)) && (
        <div id="proposta-imprimivel" className="bg-white border border-slate-200 rounded-lg p-5">
          {/* Impressão/"PDF" (2026-09-15): sem biblioteca nova -- window.print() do
           * navegador + CSS de impressão dedicado (ver <style> logo abaixo), que
           * esconde o resto da página e imprime só este card (cabeçalho + tabela).
           * Ajustes de 2026-09-15 (pedido explícito do usuário, sem supor nada
           * além do confirmado): (1) o fundo azul-marinho do cabeçalho de
           * identificação precisa sair colorido na impressão -- por padrão o
           * navegador omite cor de fundo ao imprimir (pra economizar tinta), daí
           * o print-color-adjust:exact escopado só nesse card (id
           * cabecalho-identificacao-impressao), não no resto da página; (2) texto
           * quebrando em duas linhas dentro das células da tabela de parcelas
           * (11 colunas) -- mantém retrato (não pediu paisagem) e impede a quebra
           * com white-space:nowrap, diminuindo a fonte da tabela o quanto for
           * preciso pra caber. */}
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #proposta-imprimivel, #proposta-imprimivel * { visibility: visible; }
              #proposta-imprimivel { position: absolute; left: 0; top: 0; width: 100%; border: none; }

              #cabecalho-identificacao-impressao,
              #cabecalho-identificacao-impressao * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              #proposta-imprimivel table {
                font-size: 8px;
              }
              #proposta-imprimivel th,
              #proposta-imprimivel td {
                white-space: nowrap;
                padding-left: 4px;
                padding-right: 4px;
              }
            }
          `}</style>

          {/* Cabeçalho de identificação (layout inspirado na aba "Requerimento 2026" do
           * Excel de referência, 2026-09-13): junto do corpo da proposta (tabela de
           * parcelas), não separado acima do formulário -- pedido do usuário em
           * 2026-09-13. Aparece tanto na prévia quanto depois de confirmada, porque
           * esse card cobre os dois casos (preview || jaGerada). */}
          {cabecalhoIdentificacao}

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {jaGerada ? "Parcelas gravadas" : "Prévia (não gravado)"}
            </h3>
            <div className="flex items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Baixar / Imprimir PDF
              </button>
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
          </div>

          {!jaGerada && preview && (
            <div className="mb-4 print:hidden">
              <HamburgerToggleIcon
                checked={descontoAberto}
                onChange={setDescontoAberto}
                ariaLabel={descontoAberto ? "Ocultar desconto" : "Aplicar desconto"}
                className="h-7 w-7 rounded-md text-slate-400 hover:text-brand-blue-dark hover:bg-slate-100 transition-colors"
              />
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
                      className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm transition-colors hover:border-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Desconto (%) sobre Entrada</label>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      step="0.01"
                      value={percentualDescontoEntrada}
                      onChange={(e) => setPercentualDescontoEntrada(Number(e.target.value))}
                      className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm transition-colors hover:border-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600">Parcelas do Material de Inglês</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      step={1}
                      value={quantidadeParcelasMaterialIngles}
                      onChange={(e) => setQuantidadeParcelasMaterialIngles(Number(e.target.value))}
                      className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm transition-colors hover:border-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                    />
                  </div>
                  {simulando && <span className="text-xs text-slate-400">recalculando...</span>}
                </div>
              )}
            </div>
          )}

          {jaGerada && descontoPersistido !== null && descontoPersistido > 0 && (
            <p className="text-xs text-slate-500 mb-1">Desconto aplicado: {descontoPersistido}%</p>
          )}
          {jaGerada && descontoEntradaPersistido !== null && descontoEntradaPersistido > 0 && (
            <p className="text-xs text-slate-500 mb-1">Desconto na Entrada: {descontoEntradaPersistido}%</p>
          )}
          {jaGerada && dataPagamentoEntradaPersistida && (
            <p className="text-xs text-slate-500 mb-1">Data de pagamento da Entrada: {fmtData(dataPagamentoEntradaPersistida)}</p>
          )}
          {jaGerada && qtdParcelasMaterialInglesPersistida !== null && (
            <p className="text-xs text-slate-500 mb-4">
              Parcelas do Material de Inglês: {qtdParcelasMaterialInglesPersistida}x
            </p>
          )}

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
                  <th className="py-1 pr-3 text-right font-semibold text-brand-navy">Total</th>
                </tr>
              </thead>
              <tbody>
                {(jaGerada ? parcelasExistentes! : preview!.parcelas).map((p) => {
                  const ehEntrada = p.numeroParcela === 1;
                  return (
                    <tr key={p.numeroParcela} className={`border-b border-slate-100 ${ehEntrada ? "bg-brand-amber/10 font-medium" : ""}`}>
                      <td className="py-1 pr-3">{p.numeroParcela}ª</td>
                      <td className="py-1 pr-3">{ehEntrada ? "Entrada" : `${MESES[p.mesReferencia - 1]}/${p.anoReferencia}`}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorMensalidade)}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorMaterialDidatico)}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorMaterialDidaticoIngles)}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorAlimentacao)}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorIntegral)}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorSemiIntegral)}</td>
                      <td className="py-1 pr-3 text-right">{fmtMoeda(p.valorEstendido)}</td>
                      <td className="py-1 pr-3 text-right font-semibold text-brand-navy">{fmtMoeda(p.valorTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const todas = jaGerada ? parcelasExistentes! : preview!.parcelas;
                  const somar = (campo: keyof ParcelaProposta) => todas.reduce((acc, p) => acc + (p[campo] as number), 0);
                  return (
                    <tr className="border-t-2 border-slate-300 font-semibold text-slate-800">
                      <td className="py-1.5 pr-3" colSpan={2}>Total</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorMensalidade"))}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorMaterialDidatico"))}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorMaterialDidaticoIngles"))}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorAlimentacao"))}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorIntegral"))}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorSemiIntegral"))}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtMoeda(somar("valorEstendido"))}</td>
                      <td className="py-1.5 pr-3 text-right text-brand-navy">{fmtMoeda(somar("valorTotal"))}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
