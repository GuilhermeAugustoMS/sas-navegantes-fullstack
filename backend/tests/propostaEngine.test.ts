import { describe, expect, it } from "vitest";
import { gerarParcelas } from "../src/calc/propostaEngine.js";

const PRECO_SERIE = {
  MENSALIDADE: 1600,
  MATERIAL_DIDATICO: 290,
  MATERIAL_DIDATICO_INGLES: 40,
  ALIMENTACAO: 350,
};

describe("CalculationEngine — gerarParcelas (Gerador de Proposta)", () => {
  it("gera uma parcela de Entrada (1ª) + uma por mês do ano letivo, de MES_ENTRADA até dezembro", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 3,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    expect(parcelas).toHaveLength(11); // Entrada + março a dezembro (10 meses)
    expect(parcelas[0].mesReferencia).toBe(3); // Entrada referencia o mês de entrada
    expect(parcelas[1].mesReferencia).toBe(3); // 1º mês de mensalidade também é março
    expect(parcelas.at(-1)!.mesReferencia).toBe(12);
    expect(parcelas.map((p) => p.numeroParcela)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("cobra o mês de entrada integral quando o aluno entra no dia 1", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    const primeiraMensalidade = parcelas[1];
    expect(primeiraMensalidade.valorMensalidade).toBe(1600);
    // Material de Inglês: valor fixo total (40) ÷ 4 parcelas padrão = 10, não os 40 inteiros.
    expect(primeiraMensalidade.valorTotal).toBe(1600 + 290 + 10 + 350);
  });

  it("rateia o mês de entrada por dias corridos (entrada no meio do mês)", () => {
    // Agosto/2027 tem 31 dias; entrando no dia 16, restam 16 dias (16..31) -> 16/31 do valor.
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 8,
      diaEntrada: 16,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    const primeiraMensalidade = parcelas[1];
    const fracaoEsperada = 16 / 31;
    expect(primeiraMensalidade.valorMensalidade).toBeCloseTo(1600 * fracaoEsperada, 2);
    expect(primeiraMensalidade.valorAlimentacao).toBeCloseTo(350 * fracaoEsperada, 2);
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
    // Material de Inglês: 40 ÷ 4 parcelas padrão = 10 (setembro é a 2ª parcela dele).
    expect(setembro.valorTotal).toBe(1600 + 290 + 10 + 350);
  });

  it("zera a alimentação quando NECESSIDADE_ALIMENTACAO é false", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: false,
      extrasContratados: [],
    });

    const primeiraMensalidade = parcelas[1];
    expect(primeiraMensalidade.valorAlimentacao).toBe(0);
    expect(primeiraMensalidade.valorTotal).toBe(1600 + 290 + 10);
  });

  it("aplica o multiplicador da forma de pagamento sobre todos os componentes da mensalidade", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 0.92, // ex.: desconto de débito à vista
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
    });

    const primeiraMensalidade = parcelas[1];
    expect(primeiraMensalidade.valorMensalidade).toBeCloseTo(1600 * 0.92, 2);
    // Material de Inglês (10 = 40÷4) NÃO leva o multiplicador -- só mensalidade, material comum e alimentação.
    expect(primeiraMensalidade.valorTotal).toBeCloseTo((1600 + 290 + 350) * 0.92 + 10, 2);
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

    const primeiraMensalidade = parcelas[1];
    expect(primeiraMensalidade.valorIntegral).toBeCloseTo(910 * 0.5, 2);
    expect(primeiraMensalidade.valorSemiIntegral).toBe(0);
    expect(primeiraMensalidade.valorEstendido).toBe(0);

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

    expect(semCampo[1].valorMensalidade).toBe(1600);
    expect(comZero[1].valorMensalidade).toBe(1600);
  });

  it("aplica percentualDesconto só sobre a Mensalidade, mantendo os demais componentes intactos", () => {
    const parcelas = gerarParcelas({
      precoSerie: PRECO_SERIE,
      multiplicadorFormaPagamento: 1,
      anoReferencia: 2027,
      mesEntrada: 1,
      diaEntrada: 1,
      necessidadeAlimentacao: true,
      extrasContratados: [],
      percentualDesconto: 10,
    });

    const primeiraMensalidade = parcelas[1];
    expect(primeiraMensalidade.valorMensalidade).toBeCloseTo(1600 * 0.9, 2);
    expect(primeiraMensalidade.valorMaterialDidatico).toBe(290);
    expect(primeiraMensalidade.valorMaterialDidaticoIngles).toBe(10); // 40 ÷ 4 parcelas padrão, sem desconto
    expect(primeiraMensalidade.valorAlimentacao).toBe(350);
  });

  it("aplica o mesmo percentualDesconto em todas as mensalidades do ano (não escalonado)", () => {
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

    for (const p of parcelas.slice(1)) {
      expect(p.valorMensalidade).toBeCloseTo(1600 * 0.8, 2);
    }
  });

  it("combina percentualDesconto com rateio do mês de entrada e multiplicador da forma de pagamento", () => {
    // Agosto/2027 tem 31 dias; entrada dia 16 -> fração 16/31.
    const parcelas = gerarParcelas({
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
    expect(parcelas[1].valorMensalidade).toBeCloseTo(esperado, 2);
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

  describe("Entrada (parcela 1ª, sempre cobrada, desconto próprio)", () => {
    it("vale o valor cheio da Mensalidade da Série, sem rateio por dia/mês de entrada", () => {
      // Entrando no meio do mês (dia 16 de agosto), a mensalidade normal seria rateada,
      // mas a Entrada deve continuar com o valor cheio de MENSALIDADE.
      const [entrada] = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 8,
        diaEntrada: 16,
        necessidadeAlimentacao: true,
        extrasContratados: [],
      });

      expect(entrada.numeroParcela).toBe(1);
      expect(entrada.valorMensalidade).toBe(1600);
      expect(entrada.valorTotal).toBe(1600);
    });

    it("ignora o multiplicador da forma de pagamento", () => {
      const [entrada] = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 0.92,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: true,
        extrasContratados: [],
      });

      expect(entrada.valorMensalidade).toBe(1600); // não 1600 * 0.92
    });

    it("não soma material didático, alimentação nem extras", () => {
      const [entrada] = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: true,
        extrasContratados: [{ nome: "Integral", valorMes: 910 }],
      });

      expect(entrada.valorMaterialDidatico).toBe(0);
      expect(entrada.valorMaterialDidaticoIngles).toBe(0);
      expect(entrada.valorAlimentacao).toBe(0);
      expect(entrada.valorIntegral).toBe(0);
      expect(entrada.valorSemiIntegral).toBe(0);
      expect(entrada.valorEstendido).toBe(0);
      expect(entrada.valorTotal).toBe(1600);
    });

    it("aplica percentualDescontoEntrada só na Entrada, sem afetar a mensalidade nem o desconto de mensalidade", () => {
      const parcelas = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: true,
        extrasContratados: [],
        percentualDesconto: 10, // desconto de mensalidade
        percentualDescontoEntrada: 25, // desconto de entrada (independente)
      });

      const entrada = parcelas[0];
      const primeiraMensalidade = parcelas[1];

      expect(entrada.valorTotal).toBeCloseTo(1600 * 0.75, 2); // 25% off, não 10%
      expect(primeiraMensalidade.valorMensalidade).toBeCloseTo(1600 * 0.9, 2); // 10% off, não 25%
    });

    it("mantém a Entrada no valor cheio quando percentualDescontoEntrada é omitido ou 0", () => {
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
        percentualDescontoEntrada: 0,
      });

      expect(semCampo[0].valorTotal).toBe(1600);
      expect(comZero[0].valorTotal).toBe(1600);
    });
  });

  describe("Material Didático de Inglês (valor fixo dividido em até 4 parcelas, a partir da 2ª parcela)", () => {
    it("divide o valor total em 4 parcelas iguais por padrão, a partir da 2ª parcela, e zera depois", () => {
      const parcelas = gerarParcelas({
        precoSerie: PRECO_SERIE, // MATERIAL_DIDATICO_INGLES: 40
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: false,
        extrasContratados: [],
      });

      expect(parcelas[0].valorMaterialDidaticoIngles).toBe(0); // Entrada nunca leva material
      expect(parcelas[1].valorMaterialDidaticoIngles).toBe(10);
      expect(parcelas[2].valorMaterialDidaticoIngles).toBe(10);
      expect(parcelas[3].valorMaterialDidaticoIngles).toBe(10);
      expect(parcelas[4].valorMaterialDidaticoIngles).toBe(10);
      expect(parcelas[5].valorMaterialDidaticoIngles).toBe(0); // 5ª mensalidade em diante, já quitado
      expect(parcelas[6].valorMaterialDidaticoIngles).toBe(0);
    });

    it("não aplica rateio por dia nem multiplicador da forma de pagamento", () => {
      // Agosto/2027, entrada dia 16 -> fração 16/31; multiplicador 0.5 -- nada disso deve afetar o material de inglês.
      const parcelas = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 0.5,
        anoReferencia: 2027,
        mesEntrada: 8,
        diaEntrada: 16,
        necessidadeAlimentacao: false,
        extrasContratados: [],
      });

      expect(parcelas[1].valorMaterialDidaticoIngles).toBe(10); // 40 ÷ 4, valor cheio
    });

    it("não sofre nenhum desconto (nem o de mensalidade, nem o de entrada)", () => {
      const parcelas = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: false,
        extrasContratados: [],
        percentualDesconto: 50,
        percentualDescontoEntrada: 25,
      });

      expect(parcelas[1].valorMaterialDidaticoIngles).toBe(10);
    });

    it("permite escolher uma quantidade de parcelas menor que 4", () => {
      const parcelas = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: false,
        extrasContratados: [],
        quantidadeParcelasMaterialIngles: 2,
      });

      expect(parcelas[1].valorMaterialDidaticoIngles).toBe(20);
      expect(parcelas[2].valorMaterialDidaticoIngles).toBe(20);
      expect(parcelas[3].valorMaterialDidaticoIngles).toBe(0);
    });

    it("reduz automaticamente a quantidade de parcelas quando restam menos meses letivos do que o solicitado", () => {
      // Entrando em novembro, só restam novembro e dezembro (2 mensalidades) --
      // mesmo pedindo 4 parcelas, só cabem 2.
      const parcelas = gerarParcelas({
        precoSerie: PRECO_SERIE,
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 11,
        diaEntrada: 1,
        necessidadeAlimentacao: false,
        extrasContratados: [],
        quantidadeParcelasMaterialIngles: 4,
      });

      expect(parcelas).toHaveLength(3); // Entrada + nov + dez
      expect(parcelas[1].valorMaterialDidaticoIngles).toBe(20); // 40 ÷ 2, não ÷ 4
      expect(parcelas[2].valorMaterialDidaticoIngles).toBe(20);
    });

    it("a última parcela absorve a diferença de arredondamento, para a soma bater com o valor total", () => {
      const parcelas = gerarParcelas({
        precoSerie: { ...PRECO_SERIE, MATERIAL_DIDATICO_INGLES: 100 },
        multiplicadorFormaPagamento: 1,
        anoReferencia: 2027,
        mesEntrada: 1,
        diaEntrada: 1,
        necessidadeAlimentacao: false,
        extrasContratados: [],
        quantidadeParcelasMaterialIngles: 3,
      });

      expect(parcelas[1].valorMaterialDidaticoIngles).toBe(33.33);
      expect(parcelas[2].valorMaterialDidaticoIngles).toBe(33.33);
      expect(parcelas[3].valorMaterialDidaticoIngles).toBe(33.34);
      const soma = parcelas[1].valorMaterialDidaticoIngles + parcelas[2].valorMaterialDidaticoIngles + parcelas[3].valorMaterialDidaticoIngles;
      expect(soma).toBe(100);
    });
  });
});
