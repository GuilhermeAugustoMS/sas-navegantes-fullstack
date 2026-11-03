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

  await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Matriculado", ATIVO: true });
  await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Rematriculado", ATIVO: true });
  const potencial = await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Negociação Potencial", ATIVO: true });
  statusPotencialId = potencial.body.ID_STATUS_NEGOCIACAO;
});

afterAll(async () => {
  await db.close();
});

const DATA_PAGAMENTO_ENTRADA = "2027-01-05";

// "Matriculado"/"Rematriculado" precisam existir ANTES de qualquer /confirmar
// (a rota busca por NOME) -- criados uma única vez, reaproveitados por todos
// os testes deste arquivo (igual à base real, que já tem esses dois valores).
let statusPotencialId: string;

/** Só um Ano Letivo pode estar ATIVO por vez na vida real -- cada teste deste
 * arquivo cria o seu próprio, então precisa desativar os anteriores pra não
 * confundir a rota de /confirmar (que resolve "o Ano Letivo ativo" sozinha). */
async function ativarSomente(idAnoLetivo: string) {
  const todos = await request(app).get("/api/cadastros/anos-letivos");
  for (const a of todos.body) {
    if (a.ID_ANO_LETIVO !== idAnoLetivo && a.ATIVO) {
      await request(app).put(`/api/cadastros/anos-letivos/${a.ID_ANO_LETIVO}`).send({ ATIVO: false });
    }
  }
}

/** Monta Aluno + Negociação + Proposta com parcelas já geradas (jaGerada) numa Série com 2 Turmas. */
async function montarPendente(opts: { anoLetivoAno: number; nomeAluno: string; nomeSerie: string }) {
  const anoLetivo = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: opts.anoLetivoAno, ATIVO: true });
  expect(anoLetivo.status).toBe(201);
  await ativarSomente(anoLetivo.body.ID_ANO_LETIVO);

  const serie = await request(app)
    .post("/api/cadastros/series")
    .send({ NOME: opts.nomeSerie, ID_ANO_LETIVO: anoLetivo.body.ID_ANO_LETIVO, ATIVO: true });
  expect(serie.status).toBe(201);

  const turmaA = await request(app)
    .post("/api/cadastros/turmas")
    .send({ NOME: `${opts.nomeSerie} A`, ID_SERIE: serie.body.ID_SERIE, CAPACIDADE_MAXIMA: 20, ATIVO: true });
  expect(turmaA.status).toBe(201);
  const turmaB = await request(app)
    .post("/api/cadastros/turmas")
    .send({ NOME: `${opts.nomeSerie} B`, ID_SERIE: serie.body.ID_SERIE, CAPACIDADE_MAXIMA: 20, ATIVO: true });
  expect(turmaB.status).toBe(201);

  const aluno = await request(app)
    .post("/api/cadastros/alunos")
    .send({ NOME: opts.nomeAluno, DATA_NASCIMENTO: "2019-01-01", DATA_CADASTRO: "2027-01-10", ATIVO: true });
  expect(aluno.status).toBe(201);

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

  const formaPagamento = await request(app)
    .post("/api/financeiro/formas-pagamento")
    .send({ NOME: "Boleto 12x", QTD_PARCELAS: 12, MULTIPLICADOR_AJUSTE: 1, ATIVO: true });
  expect(formaPagamento.status).toBe(201);

  const negociacao = await request(app)
    .post("/api/comercial/negociacoes")
    .send({ ID_ALUNO: aluno.body.ID_ALUNO, ID_SERIE: serie.body.ID_SERIE, ID_STATUS_NEGOCIACAO: statusPotencialId });
  expect(negociacao.status).toBe(201);

  const proposta = await request(app)
    .post("/api/comercial/propostas")
    .send({ ID_NEGOCIACAO: negociacao.body.ID_NEGOCIACAO, DATA_PROPOSTA: "2027-03-01", STATUS: "Criada" });
  expect(proposta.status).toBe(201);

  const parcelas = await request(app)
    .post(`/api/comercial/propostas/${proposta.body.ID_PROPOSTA}/parcelas`)
    .send({
      ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
      MES_ENTRADA: 3,
      DIA_ENTRADA: 1,
      NECESSIDADE_ALIMENTACAO: false,
      DATA_PAGAMENTO_ENTRADA,
    });
  expect(parcelas.status).toBe(201);

  return {
    idAluno: aluno.body.ID_ALUNO as string,
    idProposta: proposta.body.ID_PROPOSTA as string,
    idNegociacao: negociacao.body.ID_NEGOCIACAO as string,
    idSerie: serie.body.ID_SERIE as string,
    idTurmaA: turmaA.body.ID_TURMA as string,
    idTurmaB: turmaB.body.ID_TURMA as string,
    idAnoLetivo: anoLetivo.body.ID_ANO_LETIVO as string,
  };
}

describe("GET /api/planejamento/pendentes-matricula", () => {
  it("lista Propostas com parcelas geradas cujo Aluno ainda não tem Matrícula/Rematrícula", async () => {
    const ctx = await montarPendente({ anoLetivoAno: 2040, nomeAluno: "Pendente Um", nomeSerie: "1º Ano A" });

    const res = await request(app).get("/api/planejamento/pendentes-matricula").query({ anoLetivo: ctx.idAnoLetivo });
    expect(res.status).toBe(200);
    expect(res.body.pendentes.some((p: { idProposta: string }) => p.idProposta === ctx.idProposta)).toBe(true);
  });
});

describe("POST /api/planejamento/pendentes-matricula/:id/confirmar", () => {
  it("rejeita confirmar sem ID_TURMA (422)", async () => {
    const ctx = await montarPendente({ anoLetivoAno: 2041, nomeAluno: "Sem Turma", nomeSerie: "2º Ano A" });
    const res = await request(app).post(`/api/planejamento/pendentes-matricula/${ctx.idProposta}/confirmar`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
  });

  it("rejeita Turma de outra Série (422)", async () => {
    const ctx1 = await montarPendente({ anoLetivoAno: 2042, nomeAluno: "Serie A", nomeSerie: "3º Ano A" });
    const ctx2 = await montarPendente({ anoLetivoAno: 2043, nomeAluno: "Serie B", nomeSerie: "4º Ano A" });

    const res = await request(app)
      .post(`/api/planejamento/pendentes-matricula/${ctx1.idProposta}/confirmar`)
      .send({ ID_TURMA: ctx2.idTurmaA });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
  });

  it("confirma como Matrícula (primeira vez), define Turma do Aluno e atualiza StatusNegociacao", async () => {
    const ctx = await montarPendente({ anoLetivoAno: 2044, nomeAluno: "Primeira Vez", nomeSerie: "5º Ano A" });

    const res = await request(app)
      .post(`/api/planejamento/pendentes-matricula/${ctx.idProposta}/confirmar`)
      .send({ ID_TURMA: ctx.idTurmaB });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe("Matricula");

    const aluno = await request(app).get(`/api/cadastros/alunos/${ctx.idAluno}`);
    expect(aluno.body.ID_TURMA).toBe(ctx.idTurmaB);

    const negociacao = await request(app).get(`/api/comercial/negociacoes/${ctx.idNegociacao}`);
    const statusNeg = await request(app).get(`/api/comercial/status-negociacao/${negociacao.body.ID_STATUS_NEGOCIACAO}`);
    expect(statusNeg.body.NOME).toBe("Matriculado");

    // some da lista de pendentes depois de confirmado
    const pendentesDepois = await request(app).get("/api/planejamento/pendentes-matricula").query({ anoLetivo: ctx.idAnoLetivo });
    expect(pendentesDepois.body.pendentes.some((p: { idProposta: string }) => p.idProposta === ctx.idProposta)).toBe(false);
  });

  it("rejeita confirmar de novo o mesmo Aluno/Ano Letivo (409)", async () => {
    const ctx = await montarPendente({ anoLetivoAno: 2045, nomeAluno: "Duplicado", nomeSerie: "6º Ano A" });
    const primeira = await request(app)
      .post(`/api/planejamento/pendentes-matricula/${ctx.idProposta}/confirmar`)
      .send({ ID_TURMA: ctx.idTurmaA });
    expect(primeira.status).toBe(201);

    const segunda = await request(app)
      .post(`/api/planejamento/pendentes-matricula/${ctx.idProposta}/confirmar`)
      .send({ ID_TURMA: ctx.idTurmaA });
    expect(segunda.status).toBe(409);
    expect(segunda.body.error).toBe("JA_MATRICULADO");
  });

  it("confirma como Rematrícula quando o Aluno já teve Matrícula em ano anterior", async () => {
    // Ano anterior: aluno já matriculado (via fluxo normal de Matrícula).
    const anterior = await montarPendente({ anoLetivoAno: 2046, nomeAluno: "Veterano", nomeSerie: "7º Ano A" });
    const confirmaAnterior = await request(app)
      .post(`/api/planejamento/pendentes-matricula/${anterior.idProposta}/confirmar`)
      .send({ ID_TURMA: anterior.idTurmaA });
    expect(confirmaAnterior.status).toBe(201);
    expect(confirmaAnterior.body.tipo).toBe("Matricula");

    // Novo Ano Letivo: mesma Série (nova, mas mesmo Aluno), nova Proposta/Negociação.
    const anoNovo = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: 2047, ATIVO: true });
    await ativarSomente(anoNovo.body.ID_ANO_LETIVO);
    const serieNova = await request(app)
      .post("/api/cadastros/series")
      .send({ NOME: "8º Ano A", ID_ANO_LETIVO: anoNovo.body.ID_ANO_LETIVO, ATIVO: true });
    const turmaNova = await request(app)
      .post("/api/cadastros/turmas")
      .send({ NOME: "8º Ano A", ID_SERIE: serieNova.body.ID_SERIE, CAPACIDADE_MAXIMA: 20, ATIVO: true });
    const tabelaPreco = await request(app).post("/api/financeiro/tabela-precos").send({
      ID_SERIE: serieNova.body.ID_SERIE,
      MENSALIDADE: 1900,
      MATERIAL_DIDATICO: 310,
      MATERIAL_DIDATICO_INGLES: 515,
      ALIMENTACAO: 470,
      DATA_VIGENCIA: "2047-01-01",
      ATIVO: true,
    });
    const formaPagamento = await request(app)
      .post("/api/financeiro/formas-pagamento")
      .send({ NOME: "Boleto 12x Novo", QTD_PARCELAS: 12, MULTIPLICADOR_AJUSTE: 1, ATIVO: true });
    const negociacaoNova = await request(app)
      .post("/api/comercial/negociacoes")
      .send({ ID_ALUNO: anterior.idAluno, ID_SERIE: serieNova.body.ID_SERIE, ID_STATUS_NEGOCIACAO: statusPotencialId });
    const propostaNova = await request(app)
      .post("/api/comercial/propostas")
      .send({ ID_NEGOCIACAO: negociacaoNova.body.ID_NEGOCIACAO, DATA_PROPOSTA: "2047-01-10", STATUS: "Criada" });
    const parcelasNovas = await request(app)
      .post(`/api/comercial/propostas/${propostaNova.body.ID_PROPOSTA}/parcelas`)
      .send({
        ID_FORMA_PAGAMENTO: formaPagamento.body.ID_FORMA_PAGAMENTO,
        MES_ENTRADA: 1,
        DIA_ENTRADA: 1,
        NECESSIDADE_ALIMENTACAO: false,
        DATA_PAGAMENTO_ENTRADA: "2047-01-05",
      });
    expect(parcelasNovas.status).toBe(201);

    const confirmaNovo = await request(app)
      .post(`/api/planejamento/pendentes-matricula/${propostaNova.body.ID_PROPOSTA}/confirmar`)
      .send({ ID_TURMA: turmaNova.body.ID_TURMA });
    expect(confirmaNovo.status).toBe(201);
    expect(confirmaNovo.body.tipo).toBe("Rematricula");
  });
});
