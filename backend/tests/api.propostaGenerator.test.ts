import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sas-data-api-proposta-gen-"));
process.env.SAS_DATA_ROOT = tmpRoot;

const { createApp } = await import("../src/api/app.js");

let app: Awaited<ReturnType<typeof createApp>>;

beforeAll(async () => {
  app = await createApp();
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

async function montarFixtures() {
  const anoLetivo = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: 2027, ATIVO: true });
  const serie = await request(app)
    .post("/api/cadastros/series")
    .send({ NOME: "1º Ano A", ID_ANO_LETIVO: anoLetivo.body.ID_ANO_LETIVO, ATIVO: true });
  const unidade = await request(app).post("/api/cadastros/unidades").send({ NOME: "Carajás", ATIVO: true });
  const aluno = await request(app).post("/api/cadastros/alunos").send({
    NOME: "Laura",
    DATA_NASCIMENTO: "2019-01-01",
    ID_UNIDADE: unidade.body.ID_UNIDADE,
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
      });

    expect(res.status).toBe(200);
    expect(res.body.parcelas).toHaveLength(10); // março a dezembro
    expect(res.body.parcelas[0].valorTotal).toBeCloseTo(1600 + 290 + 40 + 350, 2);

    const check = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`);
    expect(check.body).toEqual([]); // preview não grava nada
  });

  it("gera e persiste as parcelas, atualizando VALOR_TOTAL_MES da Proposta", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.parcelas).toHaveLength(12);
    expect(res.body.valorTotalMes).toBeCloseTo(1600 + 290 + 40 + 350, 2);
    // Formato camelCase igual ao da resposta de preview (ParcelaProposta do frontend) --
    // regressão: já existiu um bug em que esta resposta vinha em SNAKE_CASE cru do Excel,
    // quebrando a tela ao tentar formatar valorTotal (undefined) como moeda.
    expect(res.body.parcelas[0]).toMatchObject({
      numeroParcela: 1,
      mesReferencia: 1,
      anoReferencia: 2027,
      valorTotal: expect.any(Number),
    });
    expect(res.body.parcelas[0].valorTotal).toBeCloseTo(1600 + 290 + 40 + 350, 2);

    const propostaAtualizada = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}`);
    expect(propostaAtualizada.body.VALOR_TOTAL_MES).toBeCloseTo(1600 + 290 + 40 + 350, 2);

    const listaParcelas = await request(app).get(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`);
    expect(listaParcelas.body).toHaveLength(12);
    expect(listaParcelas.body[0]).toMatchObject({ numeroParcela: 1, valorTotal: expect.any(Number) });
  });

  it("recusa gerar parcelas de novo para a mesma proposta (histórico congelado)", async () => {
    const { proposta, formaPagamento } = await montarFixtures();
    const body = {
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: true,
    };

    const primeira = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send(body);
    expect(primeira.status).toBe(201);

    const segunda = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send(body);
    expect(segunda.status).toBe(409);
    expect(segunda.body.error).toBe("PARCELAS_JA_GERADAS");
  });

  it("aplica e persiste PERCENTUAL_DESCONTO ao confirmar a proposta", async () => {
    const { proposta, formaPagamento } = await montarFixtures();

    const res = await request(app).post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`).send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 1,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: false,
      PERCENTUAL_DESCONTO: 10,
    });

    expect(res.status).toBe(201);
    expect(res.body.parcelas[0].valorMensalidade).toBeCloseTo(1600 * 0.9, 2);

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
        PERCENTUAL_DESCONTO: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.parcelas[0].valorMensalidade).toBeCloseTo(1600 * 0.9, 2);

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
    });

    expect(res.status).toBe(201);
    expect(res.body.parcelas[0].valorMensalidade).toBe(1600);

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
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
    expect(res.body.detalhes.length).toBeGreaterThan(0);
  });
});
