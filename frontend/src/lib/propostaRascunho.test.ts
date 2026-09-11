import { describe, expect, it } from "vitest";
import { encontrarPropostaRascunho } from "./propostaRascunho";
import type { ParcelaProposta, RecordRow } from "../api/types";

function parcela(numeroParcela: number): ParcelaProposta {
  return {
    numeroParcela,
    mesReferencia: 1,
    anoReferencia: 2026,
    valorMensalidade: 100,
    valorMaterialDidatico: 0,
    valorMaterialDidaticoIngles: 0,
    valorAlimentacao: 0,
    valorIntegral: 0,
    valorSemiIntegral: 0,
    valorEstendido: 0,
    valorTotal: 100,
  };
}

/** Simula o backend: cada ID_PROPOSTA aponta pras parcelas já gravadas para ela (vazio = rascunho). */
function fakeListarParcelas(parcelasPorProposta: Record<string, ParcelaProposta[]>) {
  return async (propostaId: string) => parcelasPorProposta[propostaId] ?? [];
}

describe("encontrarPropostaRascunho", () => {
  it("retorna null quando não há nenhuma Proposta para a Negociação", async () => {
    const resultado = await encontrarPropostaRascunho([], fakeListarParcelas({}));
    expect(resultado).toBeNull();
  });

  it("reaproveita a única Proposta existente quando ela ainda não tem parcelas (rascunho)", async () => {
    const candidatas: RecordRow[] = [{ ID_PROPOSTA: "PRO_000001", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-10", STATUS: "Criada" }];
    const resultado = await encontrarPropostaRascunho(candidatas, fakeListarParcelas({}));
    expect(resultado).toBe("PRO_000001");
  });

  it("reproduz o cenário do bug: reabrir o wizard duas vezes seguidas na mesma Negociação sem confirmar nada gera só UMA Proposta, não duas", async () => {
    // Simula o "banco" de Propostas indo sendo populado, como o wizard faria de verdade.
    const propostas: RecordRow[] = [];
    const parcelasPorProposta: Record<string, ParcelaProposta[]> = {};
    let proximoId = 1;

    async function abrirWizardNaNegociacao(idNegociacao: string): Promise<string> {
      const candidatas = propostas.filter((p) => p.ID_NEGOCIACAO === idNegociacao);
      const rascunho = await encontrarPropostaRascunho(candidatas, fakeListarParcelas(parcelasPorProposta));
      if (rascunho) return rascunho;
      const novoId = `PRO_${String(proximoId++).padStart(6, "0")}`;
      propostas.push({ ID_PROPOSTA: novoId, ID_NEGOCIACAO: idNegociacao, DATA_PROPOSTA: "2026-09-10", STATUS: "Criada" });
      return novoId;
    }

    const primeiraAbertura = await abrirWizardNaNegociacao("NEG_000001");
    const segundaAbertura = await abrirWizardNaNegociacao("NEG_000001"); // reabre sem confirmar nada

    expect(segundaAbertura).toBe(primeiraAbertura);
    expect(propostas.filter((p) => p.ID_NEGOCIACAO === "NEG_000001")).toHaveLength(1);
  });

  it("não reaproveita uma Proposta que já tem parcelas geradas (congelada)", async () => {
    const candidatas: RecordRow[] = [{ ID_PROPOSTA: "PRO_000001", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-10", STATUS: "Aceita" }];
    const resultado = await encontrarPropostaRascunho(candidatas, fakeListarParcelas({ PRO_000001: [parcela(1)] }));
    expect(resultado).toBeNull();
  });

  it("entre várias Propostas em rascunho (dados legados do bug), reaproveita a de DATA_PROPOSTA mais recente e ignora as outras", async () => {
    const candidatas: RecordRow[] = [
      { ID_PROPOSTA: "PRO_000001", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-01", STATUS: "Criada" },
      { ID_PROPOSTA: "PRO_000003", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-10", STATUS: "Criada" },
      { ID_PROPOSTA: "PRO_000002", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-05", STATUS: "Criada" },
    ];
    const resultado = await encontrarPropostaRascunho(candidatas, fakeListarParcelas({}));
    expect(resultado).toBe("PRO_000003");
  });

  it("em empate de DATA_PROPOSTA, usa o maior ID_PROPOSTA como desempate", async () => {
    const candidatas: RecordRow[] = [
      { ID_PROPOSTA: "PRO_000001", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-10", STATUS: "Criada" },
      { ID_PROPOSTA: "PRO_000002", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-10", STATUS: "Criada" },
    ];
    const resultado = await encontrarPropostaRascunho(candidatas, fakeListarParcelas({}));
    expect(resultado).toBe("PRO_000002");
  });

  it("pula rascunhos mais recentes que já têm parcelas e reaproveita o rascunho mais antigo ainda sem parcelas", async () => {
    const candidatas: RecordRow[] = [
      { ID_PROPOSTA: "PRO_000001", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-01", STATUS: "Criada" },
      { ID_PROPOSTA: "PRO_000002", ID_NEGOCIACAO: "NEG_000001", DATA_PROPOSTA: "2026-09-10", STATUS: "Aceita" },
    ];
    const resultado = await encontrarPropostaRascunho(candidatas, fakeListarParcelas({ PRO_000002: [parcela(1)] }));
    expect(resultado).toBe("PRO_000001");
  });
});
