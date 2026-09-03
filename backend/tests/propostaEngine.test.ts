import { describe, expect, it } from "vitest";
import { gerarParcelas } from "../src/calc/propostaEngine.js";

const PRECO_SERIE = {
  MENSALIDADE: 1600,
  MATERIAL_DIDATICO: 290,
  MATERIAL_DIDATICO_INGLES: 40,
  ALIMENTACAO: 350,
};

describe("CalculationEngine — gerarParcelas (Gerador de Proposta)", () => {
  it("gera uma parcela por mês do ano letivo, de MES_ENTRADA até dezembro", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 3,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    expect(parcelas).toHaveLength(10); // março a dezembro
    expect(parcelas[0].mesReferencia).toBe(3);
    expect(parcelas.at(-1)!.mesReferencia).toBe(12);
    expect(parcelas.map((p) => p.numeroParcela)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("cobra o mês de entrada integral quando o aluno entra no dia 1", () => {
    const [parcela1] = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    expect(parcela1.valorMensalidade).toBe(1600);
    expect(parcela1.valorTotal).toBe(1600 + 290 + 40 + 350);
  });

  it("rateia o mês de entrada por dias corridos (entrada no meio do mês)", () => {
    // Agosto/2027 tem 31 dias; entrando no dia 16, restam 16 dias (16..31) -> 16/31 do valor.
    const [parcela1] = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 8,
      diaEntrada: 16,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    const fracaoEsperada = 16 / 31;
    expect(parcela1.valorMensalidade).toBeCloseTo(1600 * fracaoEsperada, 2);
    expect(parcela1.valorAlimentacao).toBeCloseTo(350 * fracaoEsperada, 2);
  });

  it("cobra os meses seguintes ao de entrada de forma integral (sem rateio)", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 8,
      diaEntrada: 16,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    const setembro = parcelas.find((p) => p.mesReferencia === 9)!;
    expect(setembro.valorMensalidade).toBe(1600);
    expect(setembro.valorTotal).toBe(1600 + 290 + 40 + 350);
  });

  it("zera a alimentação quando NECESSIDADE_ALIMENTACAO é false", () => {
    const [parcela1] = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: false,
      extrasContratados: [],
    });

    expect(parcela1.valorAlimentacao).toBe(0);
    expect(parcela1.valorTotal).toBe(1600 + 290 + 40);
  });

  it("aplica o multiplicador da forma de pagamento sobre todos os componentes", () => {
    const [parcela1] = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 0.92, // ex.: desconto de débito à vista
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    expect(parcela1.valorMensalidade).toBeCloseTo(1600 * 0.92, 2);
    expect(parcela1.valorTotal).toBeCloseTo((1600 + 290 + 40 + 350) * 0.92, 2);
  });

  it("inclui Integral/Semi-Integral/Estendido só quando contratados, rateados no mês de entrada", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 4, // abril tem 30 dias
      diaEntrada: 16, // restam 15 dias -> 15/30 = 0.5
      necessidadeAlimentacao: true,
      extrasContratados: [{ nome: "Integral", valorMes: 910 }],
    });

    expect(parcelas[0].valorIntegral).toBeCloseTo(910 * 0.5, 2);
    expect(parcelas[0].valorSemiIntegral).toBe(0);
    expect(parcelas[0].valorEstendido).toBe(0);

    const maio = parcelas.find((p) => p.mesReferencia === 5)!;
    expect(maio.valorIntegral).toBe(910);
  });

  it("não altera nada quando percentualDesconto é omitido ou 0 (retrocompatibilidade)", () => {
    const semCampo = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });
    const comZero = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
      percentualDesconto: 0,
    });

    expect(semCampo[0].valorMensalidade).toBe(1600);
    expect(comZero[0].valorMensalidade).toBe(1600);
  });

  it("aplica percentualDesconto só sobre a Mensalidade, mantendo os demais componentes intactos", () => {
    const [parcela1] = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
      percentualDesconto: 10,
    });

    expect(parcela1.valorMensalidade).toBeCloseTo(1600 * 0.9, 2);
    expect(parcela1.valorMaterialDidatico).toBe(290);
    expect(parcela1.valorMaterialDidaticoIngles).toBe(40);
    expect(parcela1.valorAlimentacao).toBe(350);
  });

  it("aplica o mesmo percentualDesconto em todas as parcelas do ano (não escalonado)", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 3,
      diaEntrada: 1,
      necessidadeAlimentacao: false,
      extrasContratados: [],
      percentualDesconto: 20,
    });

    for (const p of parcelas) {
      expect(p.valorMensalidade).toBeCloseTo(1600 * 0.8, 2);
    }
  });

  it("combina percentualDesconto com rateio do mês de entrada e multiplicador da forma de pagamento", () => {
    // Agosto/2027 tem 31 dias; entrada dia 16 -> fração 16/31.
    const [parcela1] = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 0.92,
      anoReferencia: 2027,
      mesEntrada: 8,
      diaEntrada: 16,
      necessidadeAlimentacao: false,
      extrasContratados: [],
      percentualDesconto: 10,
    });

    const esperado = 1600 * (16 / 31) * 0.92 * 0.9;
    expect(parcela1.valorMensalidade).toBeCloseTo(esperado, 2);
  });

  it("rejeita mês de entrada fora do intervalo 1-12", () => {
    expect(() =>
      gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 13,
        diaEntrada: 1,
        necessidadeAlimentacao: true,
        extrasContratados: [],
      }),
    ).toThrow();
  });
});
