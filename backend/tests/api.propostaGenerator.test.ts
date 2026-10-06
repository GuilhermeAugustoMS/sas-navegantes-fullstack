import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createTestDatabase, type TestDatabase } from "./setup/testDatabase.js";
import { PostgresRepository } from "../src/repository/PostgresRepository.js";

const { createApp } = await import("../src/api/app.js");

let db: TestDatabase;
let app: Awaited<ReturnType<typeof createApp>>;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp({ repo: new PostgresRepository(db.prisma) });
});

afterAll(async () => {
  await db.close();
});

// DATA_PAGAMENTO_ENTRADA é obrigatória desde 2026-09-13 (Entrada sempre
// cobrada -- ver propostaEngine.ts) em toda chamada de /parcelas.
const DATA_PAGAMENTO_ENTRADA = "2027-01-05";

async function montarFixtures() {
  const anoLetivo = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: 2027, ATIVO: true });
  const serie = await request(app)
    .post("/api/cadastros/series")
    .send({ NOME: "1º Ano A", ID_ANO_LETIVO: anoLetivo.body.ID_ANO_LETIVO, ATIVO: true });
  const aluno = await request(app).post("/api/cadastros/alunos").send({
    NOME: "Laura",
    DATA_NASCIMENTO: "2019-01-01",
    DATA_CADASTRO: "2027-01-10",
    ATIVO: true,
  });

  const tabelaPreco = await request(app).post("/api/financeiro/tabela-precos").send({
    ID_SERIE: serie.body.ID_SERIE,
    MENSALIDADE: 1600,
    MATERIAL_DIDATICO: 290,
    MATERIAL_DIDATICO_INGLES: 40,
    ALIMENTACAO: 350,
    DATA_VIGENCIA: "2027-01-01",
    ATIVO: true,
  });
  expect(tabelaPreco.status).toBe(201);

  const formaPagamento = await request(app).post("/api/financeiro/formas-pagamento").send({
    NOME: "Boleto 12x",
    QTD_PARCELAS: 12,
    MULTIPLICADOR_AJUSTE: 1,
    ATIVO: true,
  });
  expect(formaPagamento.status).toBe(201);

  const statusNeg = await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Matriculado", ATIVO: true });
  const negociacao = await request(app).post("/api/comercial/negociacoes").send({
    ID_ALUNO: aluno.body.ID_ALUNO,
    ID_SERIE: serie.body.ID_SERIE,
    ID_STATUS_NEGOCIACAO: statusNeg.body.ID_STATUS_NEGOCIACAO,
  });
  expect(negociacao.status).toBe(201);

  const proposta = await request(app).post("/api/comercial/propostas").send({
    ID_NEGOCIACAO: negociacao.body.ID_NEGOCIACAO,
    DATA_PROPOSTA: "2027-03-01",
    STATUS: "Criada",
  });
  expect(proposta.status).toBe(201);

  return { proposta, formaPagamento, serie };
}

describe("Gerador de Proposta (motor de cálculo + persistência)", () => {
  it("simula sem persistir quando preview=true", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app)
      .post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas?preview=true`)
      .send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 3,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
        DATA_PAGAMENTO_ENTRADA,
      });

    expect(res.status).toBe(200);
    // Forma de pagamento "Boleto 12x" tem QTD_PARCELAS=12 (correção de
    // 2026-10-06: antes esse campo nunca era lido). Entrada em março sobram
    // 10 meses letivos (mar-dez), mas a quantidade de parcelas passa a ser a
    // da forma de pagamento (12), decoplada dos meses -- Entrada + 12 = 13.
    expect(res.body.parcelas).toHaveLength(13);
    expect(res.body.parcelas[0].valorTotal).toBeCloseTo(1600, 2); // Entrada: só a mensalidade cheia, nunca afetada pela forma de pagamento
    // Mensalidade+Material+Alimentação de 10 meses (mar-dez, sem rateio pois
    // DIA_ENTRADA=1) somados e divididos em 12 parcelas: (1600+290+350)*10/12.
    // Material de Inglês continua com sua própria contagem (40 ÷ 4 = 10).
    expect(res.body.parcelas[1].valorTotal).toBeCloseTo(1876.67, 2);

    const check = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`);
    expect(check.body).toEqual([]); // preview não grava nada
  });

  it("gera e persiste as parcelas (Entrada + mensalidades), atualizando VALOR_TOTAL_MES da Proposta", async () => {
    // Timeout maior: grava 13 parcelas em sequência (I/O real de Excel via
    // proper-lockfile) -- sob carga (suíte completa rodando em paralelo),
    // isso passa de 5s por engano nesta máquina, sem ser um bug de lógica.
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
      DATA_PAGAMENTO_ENTRADA,
    });

    expect(res.status).toBe(201);
    expect(res.body.parcelas).toHaveLength(13); // Entrada + 12 meses
    // VALOR_TOTAL_MES reflete o último mês (dezembro): o M.D. de Inglês (10 x 4
    // parcelas padrão, cobrado só nos 4 primeiros meses) já foi quitado nele.
    expect(res.body.valorTotalMes).toBeCloseTo(1600 + 290 + 0 + 350, 2);
    // Formato camelCase igual ao da resposta de preview (ParcelaProposta do frontend) --
    // regressão: já existiu um bug em que esta resposta vinha em SNAKE_CASE cru do Excel,
    // quebrando a tela ao tentar formatar valorTotal (undefined) como moeda.
    expect(res.body.parcelas[0]).toMatchObject({
      numeroParcela: 1,
      mesReferencia: 1,
      anoReferencia: 2027,
      valorTotal: 1600, // Entrada: valor cheio da mensalidade, sem material/alimentação
    });
    expect(res.body.parcelas[1]).toMatchObject({
      numeroParcela: 2,
      mesReferencia: 1,
      anoReferencia: 2027,
      valorTotal: expect.any(Number),
    });
    expect(res.body.parcelas[1].valorTotal).toBeCloseTo(1600 + 290 + 10 + 350, 2);

    const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
    expect(propostaAtualizada.body.VALOR_TOTAL_MES).toBeCloseTo(1600 + 290 + 0 + 350, 2);

    const listaParcelas = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`);
    expect(listaParcelas.body).toHaveLength(13);
    expect(listaParcelas.body[0]).toMatchObject({ numeroParcela: 1, valorTotal: 1600 });
  }, 15000);

  it("recusa gerar parcelas de novo para a mesma proposta (histórico congelado)", async () => {
    const { proposta, formaPagamento } = await montarFixtures();
    const body = {
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
      DATA_PAGAMENTO_ENTRADA,
    };

    const primeira = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send(body);
    expect(primeira.status).toBe(201);

    const segunda = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send(body);
    expect(segunda.status).toBe(409);
    expect(segunda.body.error).toBe("PARCELAS_JA_GERADAS");
  });

  it("aplica e persiste PERCENTUAL_DESCONTO ao confirmar a proposta (só na mensalidade, não na Entrada)", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: false,
      DATA_PAGAMENTO_ENTRADA,
      PERCENTUAL_DESCONTO: 10,
    });

    expect(res.status).toBe(201);
    expect(res.body.parcelas[0].valorTotal).toBe(1600); // Entrada sem desconto de mensalidade
    expect(res.body.parcelas[1].valorMensalidade).toBeCloseTo(1600 * 0.9, 2);

    const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
    expect(propostaAtualizada.body.PERCENTUAL_DESCONTO).toBe(10);
  });

  it("não persiste PERCENTUAL_DESCONTO em modo preview", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app)
      .post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas?preview=true`)
      .send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: false,
        DATA_PAGAMENTO_ENTRADA,
        PERCENTUAL_DESCONTO: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.parcelas[1].valorMensalidade).toBeCloseTo(1600 * 0.9, 2);

    const propostaInalterada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
    expect(propostaInalterada.body.PERCENTUAL_DESCONTO ?? null).toBeFalsy();
  });

  it("mantém compatibilidade quando PERCENTUAL_DESCONTO não é enviado no body", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
      DATA_PAGAMENTO_ENTRADA,
    });

    expect(res.status).toBe(201);
    expect(res.body.parcelas[1].valorMensalidade).toBe(1600);

    const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
    expect(propostaAtualizada.body.PERCENTUAL_DESCONTO).toBe(0);
  });

  it("rejeita PERCENTUAL_DESCONTO fora da faixa 0-100 (regra de negócio, 422)", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const acima = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
      DATA_PAGAMENTO_ENTRADA,
      PERCENTUAL_DESCONTO: 150,
    });
    expect(acima.status).toBe(422);
    expect(acima.body.error).toBe("REGRA_DE_NEGOCIO");
    expect(acima.body.detalhes.some((d: { field: string }) => d.field === "PERCENTUAL_DESCONTO")).toBe(true);

    const abaixo = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
      DATA_PAGAMENTO_ENTRADA,
      PERCENTUAL_DESCONTO: -5,
    });
    expect(abaixo.status).toBe(422);
    expect(abaixo.body.error).toBe("REGRA_DE_NEGOCIO");
    expect(abaixo.body.detalhes.some((d: { field: string }) => d.field === "PERCENTUAL_DESCONTO")).toBe(true);
  });

  it("rejeita quando não há Tabela de Preços ativa para a série (regra de negócio, 422)", async () => {
    // Fixtures manuais sem TabelaPrecos.
    const anoLetivo = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: 2027, ATIVO: true });
    const serie = await request(app)
      .post("/api/cadastros/series")
      .send({ NOME: "Sem Preço", ID_ANO_LETIVO: anoLetivo.body.ID_ANO_LETIVO, ATIVO: true });
    const statusNeg = await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Em negociação", ATIVO: true });
    const negociacao = await request(app)
      .post("/api/comercial/negociacoes")
      .send({ ID_SERIE: serie.body.ID_SERIE, ID_STATUS_NEGOCIACAO: statusNeg.body.ID_STATUS_NEGOCIACAO });
    const proposta = await request(app)
      .post("/api/comercial/propostas")
      .send({ ID_NEGOCIACAO: negociacao.body.ID_NEGOCIACAO, DATA_PROPOSTA: "2027-03-01", STATUS: "Criada" });

    const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: "FPG_999999",
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
      DATA_PAGAMENTO_ENTRADA,
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
    expect(res.body.detalhes.length).toBeGreaterThan(0);
  });

  describe("Entrada (parcela 1ª, sempre cobrada, desconto e data próprios)", () => {
    it("aplica e persiste PERCENTUAL_DESCONTO_ENTRADA e DATA_PAGAMENTO_ENTRADA ao confirmar", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: false,
        DATA_PAGAMENTO_ENTRADA,
        PERCENTUAL_DESCONTO_ENTRADA: 25,
      });

      expect(res.status).toBe(201);
      expect(res.body.parcelas[0].valorTotal).toBeCloseTo(1600 * 0.75, 2);

      const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
      expect(propostaAtualizada.body.PERCENTUAL_DESCONTO_ENTRADA).toBe(25);
      expect(new Date(propostaAtualizada.body.DATA_PAGAMENTO_ENTRADA).toISOString().slice(0, 10)).toBe(DATA_PAGAMENTO_ENTRADA);
    });

    it("rejeita PERCENTUAL_DESCONTO_ENTRADA fora da faixa 0-25 (regra de negócio, 422)", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const acima = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
        DATA_PAGAMENTO_ENTRADA,
        PERCENTUAL_DESCONTO_ENTRADA: 30,
      });
      expect(acima.status).toBe(422);
      expect(acima.body.error).toBe("REGRA_DE_NEGOCIO");
      expect(acima.body.detalhes.some((d: { field: string }) => d.field === "PERCENTUAL_DESCONTO_ENTRADA")).toBe(true);

      const abaixo = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
        DATA_PAGAMENTO_ENTRADA,
        PERCENTUAL_DESCONTO_ENTRADA: -1,
      });
      expect(abaixo.status).toBe(422);
      expect(abaixo.body.error).toBe("REGRA_DE_NEGOCIO");
      expect(abaixo.body.detalhes.some((d: { field: string }) => d.field === "PERCENTUAL_DESCONTO_ENTRADA")).toBe(true);
    });

    it("rejeita DATA_PAGAMENTO_ENTRADA ausente ou inválida (regra de negócio, 422)", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const ausente = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
      });
      expect(ausente.status).toBe(422);
      expect(ausente.body.error).toBe("REGRA_DE_NEGOCIO");
      expect(ausente.body.detalhes.some((d: { field: string }) => d.field === "DATA_PAGAMENTO_ENTRADA")).toBe(true);

      const invalida = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
        DATA_PAGAMENTO_ENTRADA: "não é uma data",
      });
      expect(invalida.status).toBe(422);
      expect(invalida.body.error).toBe("REGRA_DE_NEGOCIO");
      expect(invalida.body.detalhes.some((d: { field: string }) => d.field === "DATA_PAGAMENTO_ENTRADA")).toBe(true);
    });

    it("não persiste PERCENTUAL_DESCONTO_ENTRADA em modo preview", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const res = await request(app)
        .post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas?preview=true`)
        .send({
          ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
          MES_ENTRADA: 1,
          DIA_ENTRADA: 1,
          NECESSIDADE_ALIMENTACAO: false,
          DATA_PAGAMENTO_ENTRADA,
          PERCENTUAL_DESCONTO_ENTRADA: 25,
        });

      expect(res.status).toBe(200);
      expect(res.body.parcelas[0].valorTotal).toBeCloseTo(1600 * 0.75, 2);

      const propostaInalterada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
      expect(propostaInalterada.body.PERCENTUAL_DESCONTO_ENTRADA ?? null).toBeFalsy();
      expect(propostaInalterada.body.DATA_PAGAMENTO_ENTRADA ?? null).toBeFalsy();
    });
  });

  describe("Material Didático de Inglês (parcelas fixas, quantidade escolhida)", () => {
    it("aplica e persiste QUANTIDADE_PARCELAS_MATERIAL_INGLES ao confirmar", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: false,
        DATA_PAGAMENTO_ENTRADA,
        QUANTIDADE_PARCELAS_MATERIAL_INGLES: 2,
      });

      expect(res.status).toBe(201);
      // 40 ÷ 2 parcelas = 20 (não os 10 do padrão de 4).
      expect(res.body.parcelas[1].valorMaterialDidaticoIngles).toBeCloseTo(20, 2);
      expect(res.body.parcelas[2].valorMaterialDidaticoIngles).toBeCloseTo(20, 2);
      expect(res.body.parcelas[3].valorMaterialDidaticoIngles).toBe(0);

      const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
      expect(propostaAtualizada.body.QUANTIDADE_PARCELAS_MATERIAL_INGLES).toBe(2);
    });

    it("assume 4 parcelas por padrão quando QUANTIDADE_PARCELAS_MATERIAL_INGLES não é enviado", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: false,
        DATA_PAGAMENTO_ENTRADA,
      });

      expect(res.status).toBe(201);
      expect(res.body.parcelas[1].valorMaterialDidaticoIngles).toBeCloseTo(10, 2);

      const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
      expect(propostaAtualizada.body.QUANTIDADE_PARCELAS_MATERIAL_INGLES).toBe(4);
    });

    it("rejeita QUANTIDADE_PARCELAS_MATERIAL_INGLES fora da faixa 1-4 (regra de negócio, 422)", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const acima = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
        DATA_PAGAMENTO_ENTRADA,
        QUANTIDADE_PARCELAS_MATERIAL_INGLES: 5,
      });
      expect(acima.status).toBe(422);
      expect(acima.body.error).toBe("REGRA_DE_NEGOCIO");
      expect(acima.body.detalhes.some((d: { field: string }) => d.field === "QUANTIDADE_PARCELAS_MATERIAL_INGLES")).toBe(true);

      const abaixo = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: true,
        DATA_PAGAMENTO_ENTRADA,
        QUANTIDADE_PARCELAS_MATERIAL_INGLES: 0,
      });
      expect(abaixo.status).toBe(422);
      expect(abaixo.body.error).toBe("REGRA_DE_NEGOCIO");
      expect(abaixo.body.detalhes.some((d: { field: string }) => d.field === "QUANTIDADE_PARCELAS_MATERIAL_INGLES")).toBe(true);
    });

    it("não persiste QUANTIDADE_PARCELAS_MATERIAL_INGLES em modo preview", async () => {
      const { proposta, formaPagamento } = await montarFixtures();

      const res = await request(app)
        .post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas?preview=true`)
        .send({
          ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
          MES_ENTRADA: 1,
          DIA_ENTRADA: 1,
          NECESSIDADE_ALIMENTACAO: false,
          DATA_PAGAMENTO_ENTRADA,
          QUANTIDADE_PARCELAS_MATERIAL_INGLES: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.parcelas[1].valorMaterialDidaticoIngles).toBeCloseTo(20, 2);

      const propostaInalterada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
      expect(propostaInalterada.body.QUANTIDADE_PARCELAS_MATERIAL_INGLES ?? null).toBeFalsy();
    });
  });
});
