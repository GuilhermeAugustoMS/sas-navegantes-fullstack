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

async function criarAluno(nome: string) {
  const res = await request(app)
    .post("/api/cadastros/alunos")
    .send({ NOME: nome, DATA_NASCIMENTO: "2019-01-01", DATA_CADASTRO: "2026-01-01", ATIVO: true });
  expect(res.status).toBe(201);
  return res.body.ID_ALUNO as string;
}

async function criarResponsavel(nome: string) {
  const res = await request(app).post("/api/cadastros/responsaveis").send({ NOME: nome, ATIVO: true });
  expect(res.status).toBe(201);
  return res.body.ID_RESPONSAVEL as string;
}

async function vincular(idAluno: string, idResponsavel: string, tipo: string, ativo = true) {
  const res = await request(app)
    .post("/api/cadastros/vinculos-responsavel")
    .send({ ID_ALUNO: idAluno, ID_RESPONSAVEL: idResponsavel, TIPO: tipo, ATIVO: ativo });
  expect(res.status).toBe(201);
  return res.body.ID_ALUNO_RESPONSAVEL as string;
}

describe("Regra de negócio: editar Aluno exige Responsável Financeiro vinculado", () => {
  it("permite criar (POST) um Aluno sem nenhum Responsável vinculado", async () => {
    const res = await request(app)
      .post("/api/cadastros/alunos")
      .send({ NOME: "Sem Responsável Ainda", DATA_NASCIMENTO: "2019-01-01", DATA_CADASTRO: "2026-01-01", ATIVO: true });
    expect(res.status).toBe(201);
  });

  it("rejeita editar (PUT) um Aluno sem nenhum Responsável vinculado (regra de negócio, 422)", async () => {
    const idAluno = await criarAluno("Sem Vínculo");

    const res = await request(app).put(`/api/cadastros/alunos/${idAluno}`).send({ NOME: "Sem Vínculo Editado" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
    expect(res.body.detalhes.some((d: { field: string }) => d.field === "ID_ALUNO")).toBe(true);
  });

  it("permite editar quando existe um vínculo TIPO Financeiro ativo", async () => {
    const idAluno = await criarAluno("Com Financeiro");
    const idResponsavel = await criarResponsavel("Responsável Financeiro");
    await vincular(idAluno, idResponsavel, "Financeiro");

    const res = await request(app).put(`/api/cadastros/alunos/${idAluno}`).send({ NOME: "Com Financeiro Editado" });
    expect(res.status).toBe(200);
  });

  it("permite editar quando existe um vínculo TIPO 'Legal e Financeiro' ativo", async () => {
    const idAluno = await criarAluno("Com Legal e Financeiro");
    const idResponsavel = await criarResponsavel("Responsável Legal e Financeiro");
    await vincular(idAluno, idResponsavel, "Legal e Financeiro");

    const res = await request(app).put(`/api/cadastros/alunos/${idAluno}`).send({ NOME: "Editado" });
    expect(res.status).toBe(200);
  });

  it("rejeita editar quando só existe um vínculo TIPO Legal (não financeiro)", async () => {
    const idAluno = await criarAluno("Só Legal");
    const idResponsavel = await criarResponsavel("Responsável Legal");
    await vincular(idAluno, idResponsavel, "Legal");

    const res = await request(app).put(`/api/cadastros/alunos/${idAluno}`).send({ NOME: "Editado" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
  });

  it("rejeita editar quando o vínculo Financeiro existente está inativo", async () => {
    const idAluno = await criarAluno("Financeiro Inativo");
    const idResponsavel = await criarResponsavel("Responsável Inativo");
    await vincular(idAluno, idResponsavel, "Financeiro", false);

    const res = await request(app).put(`/api/cadastros/alunos/${idAluno}`).send({ NOME: "Editado" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("REGRA_DE_NEGOCIO");
  });

  it("continua permitindo a exclusão lógica (DELETE) mesmo sem Responsável vinculado", async () => {
    const idAluno = await criarAluno("Pra Inativar");
    const res = await request(app).delete(`/api/cadastros/alunos/${idAluno}`);
    expect(res.status).toBe(204);
  });
});

describe("Validação de formato: EMAIL e TELEFONE de Responsaveis (opcionais, mas validados quando preenchidos)", () => {
  it("aceita Responsável sem EMAIL e sem TELEFONE (continuam opcionais)", async () => {
    const res = await request(app).post("/api/cadastros/responsaveis").send({ NOME: "Sem Contato", ATIVO: true });
    expect(res.status).toBe(201);
  });

  it("aceita EMAIL e TELEFONE em formato válido", async () => {
    const res = await request(app)
      .post("/api/cadastros/responsaveis")
      .send({ NOME: "Contato Válido", EMAIL: "responsavel@exemplo.com", TELEFONE: "(11) 99999-9999", ATIVO: true });
    expect(res.status).toBe(201);
  });

  it("rejeita EMAIL em formato inválido (400)", async () => {
    const res = await request(app)
      .post("/api/cadastros/responsaveis")
      .send({ NOME: "Email Ruim", EMAIL: "não-é-um-email", ATIVO: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDACAO");
    expect(res.body.detalhes.some((d: { field: string }) => d.field === "EMAIL")).toBe(true);
  });

  it("rejeita TELEFONE em formato inválido (400)", async () => {
    const res = await request(app)
      .post("/api/cadastros/responsaveis")
      .send({ NOME: "Telefone Ruim", TELEFONE: "123", ATIVO: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDACAO");
    expect(res.body.detalhes.some((d: { field: string }) => d.field === "TELEFONE")).toBe(true);
  });

  it("aceita TELEFONE com 10 dígitos (fixo com DDD) e com 11 (celular com 9)", async () => {
    const fixo = await request(app)
      .post("/api/cadastros/responsaveis")
      .send({ NOME: "Telefone Fixo", TELEFONE: "1133334444", ATIVO: true });
    expect(fixo.status).toBe(201);

    const celular = await request(app)
      .post("/api/cadastros/responsaveis")
      .send({ NOME: "Telefone Celular", TELEFONE: "11999998888", ATIVO: true });
    expect(celular.status).toBe(201);
  });
});
