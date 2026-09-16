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

describe("API REST de Comercial", () => {
  it("expõe um catálogo de recursos do módulo Comercial, com apiBase próprio", async () => {
    const res = await request(app).get("/api/comercial/_catalogo");
    expect(res.status).toBe(200);
    const negociacoes = res.body.find((r: any) => r.slug === "negociacoes");
    expect(negociacoes).toBeDefined();
    expect(negociacoes.apiBase).toBe("/api/comercial");
    expect(negociacoes.arquivo).toBe("04_COMERCIAL.xlsx");
  });

  it("rejeita Negociação referenciando Status inexistente (FK dentro do próprio arquivo Comercial)", async () => {
    const res = await request(app)
      .post("/api/comercial/negociacoes")
      .send({ ID_SERIE: "SER_000001", ID_STATUS_NEGOCIACAO: "SNG_999999" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
  });

  it("rejeita Negociação referenciando Aluno inexistente (FK CROSS-ARQUIVO: Comercial -> Cadastros)", async () => {
    // Cria um Status de Negociação válido em 04_COMERCIAL.xlsx primeiro.
    const status = await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Em negociação", ATIVO: true });
    expect(status.status).toBe(201);

    const res = await request(app).post("/api/comercial/negociacoes").send({
      ID_ALUNO: "ALU_999999",
      ID_SERIE: "SER_000001",
      ID_STATUS_NEGOCIACAO: status.body.ID_STATUS_NEGOCIACAO,
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
    expect(res.body.detalhes.some((d: any) => d.field === "ID_ALUNO")).toBe(true);
  });

  it("cria uma Negociação válida referenciando Aluno e Série de 01_CADASTROS.xlsx e Status de 04_COMERCIAL.xlsx", async () => {
    // Fixtures em Cadastros.
    const unidade = await request(app).post("/api/cadastros/unidades").send({ NOME: "Carajás", ATIVO: true });
    const anoLetivo = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: 2027, ATIVO: true });
    const serie = await request(app)
      .post("/api/cadastros/series")
      .send({ NOME: "G1 A", ID_ANO_LETIVO: anoLetivo.body.ID_ANO_LETIVO, ATIVO: true });
    const aluno = await request(app).post("/api/cadastros/alunos").send({
      NOME: "Laura",
      DATA_NASCIMENTO: "2024-08-23",
      ID_UNIDADE: unidade.body.ID_UNIDADE,
      DATA_CADASTRO: "2027-01-10",
      ATIVO: true,
    });
    const statusNeg = await request(app).post("/api/comercial/status-negociacao").send({ NOME: "Matriculado", ATIVO: true });

    const res = await request(app).post("/api/comercial/negociacoes").send({
      ID_ALUNO: aluno.body.ID_ALUNO,
      ID_SERIE: serie.body.ID_SERIE,
      ID_STATUS_NEGOCIACAO: statusNeg.body.ID_STATUS_NEGOCIACAO,
    });

    expect(res.status).toBe(201);
    expect(res.body.ID_NEGOCIACAO).toMatch(/^NEG_\d{6}$/);
    expect(res.body.ID_ALUNO).toBe(aluno.body.ID_ALUNO);
  });

  it("Negociacoes, Propostas e Matriculas não têm coluna ATIVO -- DELETE deve falhar (sem exclusão lógica por design)", async () => {
    const list = await request(app).get("/api/comercial/negociacoes");
    const id = list.body[0].ID_NEGOCIACAO;

    const res = await request(app).delete(`/api/comercial/negociacoes/${id}`);
    expect(res.status).toBe(500); // Repository.softDelete lança erro explícito (aba sem coluna ATIVO)
  });
});
