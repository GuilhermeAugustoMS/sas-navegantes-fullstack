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

describe("API REST de Cadastros", () => {
  it("expõe um catálogo de recursos", async () => {
    const res = await request(app).get("/api/cadastros/_catalogo");
    expect(res.status).toBe(200);
    expect(res.body.some((r: any) => r.slug === "alunos")).toBe(true);
  });

  it("lista vazio no início", async () => {
    const res = await request(app).get("/api/cadastros/alunos");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("rejeita criação de Aluno referenciando Série inexistente (regra de negócio, 422)", async () => {
    const res = await request(app)
      .post("/api/cadastros/alunos")
      .send({ NOME: "Aluno Teste", DATA_NASCIMENTO: "2019-01-01", ID_SERIE: "SER_999999", DATA_CADASTRO: "2026-01-01", ATIVO: true });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
  });

  it("cria um Aluno (fluxo completo da tela de Cadastros)", async () => {
    const res = await request(app)
      .post("/api/cadastros/alunos")
      .set("x-usuario", "gui")
      .send({
        NOME: "Laura",
        DATA_NASCIMENTO: "2024-08-23",
        DATA_CADASTRO: "2026-09-02",
        ATIVO: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.ID_ALUNO).toBe("ALU_000001");
    expect(res.body.NOME).toBe("Laura");
    expect(res.body.__row).toBeUndefined(); // detalhe interno não deve vazar na API
  });

  it("busca por ID", async () => {
    const res = await request(app).get("/api/cadastros/alunos/ALU_000001");
    expect(res.status).toBe(200);
    expect(res.body.NOME).toBe("Laura");
  });

  it("retorna 404 para ID inexistente", async () => {
    const res = await request(app).get("/api/cadastros/alunos/ALU_999999");
    expect(res.status).toBe(404);
  });

  it("valida payload malformado (400)", async () => {
    const res = await request(app).post("/api/cadastros/anos-letivos").send({ ATIVO: true }); // ANO obrigatório ausente
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDACAO");
  });

  it("atualiza um registro existente (com Responsável Financeiro já vinculado)", async () => {
    // Editar um Aluno exige um Responsável Financeiro ativo vinculado (regra
    // confirmada em 2026-09-15) -- ver testes dedicados abaixo pra essa regra em si.
    const responsavel = await request(app)
      .post("/api/cadastros/responsaveis")
      .send({ NOME: "Responsável da Laura", ATIVO: true });
    await request(app).post("/api/cadastros/vinculos-responsavel").send({
      ID_ALUNO: "ALU_000001",
      ID_RESPONSAVEL: responsavel.body.ID_RESPONSAVEL,
      TIPO: "Financeiro",
      ATIVO: true,
    });

    const res = await request(app).put("/api/cadastros/alunos/ALU_000001").send({ NOME: "Laura Atualizada" });
    expect(res.status).toBe(200);
    expect(res.body.NOME).toBe("Laura Atualizada");
  });

  it("exclusão lógica retorna 204 e o registro some da listagem de ativos", async () => {
    const del = await request(app).delete("/api/cadastros/alunos/ALU_000001");
    expect(del.status).toBe(204);

    const ativos = await request(app).get("/api/cadastros/alunos?ativo=true");
    expect(ativos.body.find((a: any) => a.ID_ALUNO === "ALU_000001")).toBeUndefined();

    const todos = await request(app).get("/api/cadastros/alunos");
    expect(todos.body.find((a: any) => a.ID_ALUNO === "ALU_000001")).toBeDefined();
  });

  it("cada escrita via API fica registrada na auditoria com o usuário do header x-usuario", async () => {
    const { AUDITORIA } = await import("../src/schema/files.js");
    const repo = new PostgresRepository(db.prisma);
    const logs = await repo.readAll(AUDITORIA, "LogsAlteracoes");
    const doGui = logs.find((l) => l.USUARIO === "gui");
    expect(doGui).toBeDefined();
  });
});
