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

async function criarAnoLetivo(ano: number, ativo: boolean) {
  const res = await request(app).post("/api/cadastros/anos-letivos").send({ ANO: ano, ATIVO: ativo });
  expect(res.status).toBe(201);
  return res.body.ID_ANO_LETIVO as string;
}

async function criarSerie(nome: string, idAnoLetivo: string) {
  const res = await request(app).post("/api/cadastros/series").send({ NOME: nome, ID_ANO_LETIVO: idAnoLetivo, ATIVO: true });
  expect(res.status).toBe(201);
  return res.body.ID_SERIE as string;
}

async function criarTurma(nome: string, idSerie: string, capacidadeMaxima: number) {
  const res = await request(app)
    .post("/api/cadastros/turmas")
    .send({ NOME: nome, ID_SERIE: idSerie, CAPACIDADE_MAXIMA: capacidadeMaxima, ATIVO: true });
  expect(res.status).toBe(201);
  return res.body.ID_TURMA as string;
}

async function criarAluno(nome: string, idTurma?: string) {
  const res = await request(app)
    .post("/api/cadastros/alunos")
    .send({ NOME: nome, DATA_NASCIMENTO: "2019-01-01", DATA_CADASTRO: "2026-01-01", ID_TURMA: idTurma, ATIVO: true });
  expect(res.status).toBe(201);
  return res.body.ID_ALUNO as string;
}

async function criarMatricula(idAluno: string, idAnoLetivo: string) {
  const res = await request(app)
    .post("/api/comercial/matriculas")
    .send({ ID_ALUNO: idAluno, ID_ANO_LETIVO: idAnoLetivo, DATA_MATRICULA: "2026-01-10", STATUS: "Matriculado" });
  expect(res.status).toBe(201);
}

async function criarRematricula(idAluno: string, idAnoLetivo: string) {
  const res = await request(app)
    .post("/api/comercial/rematriculas")
    .send({ ID_ALUNO: idAluno, ID_ANO_LETIVO: idAnoLetivo, STATUS: "Rematriculado" });
  expect(res.status).toBe(201);
}

describe("GET /api/planejamento/gestao-vagas", () => {
  // Precisa rodar antes dos demais testes deste arquivo: depende de ser o
  // único Ano Letivo ATIVO no banco efêmero (os outros testes criam mais
  // Anos Letivos ATIVO, o que tornaria esta asserção ambígua depois).
  it("usa o Ano Letivo ATIVO quando nenhum é informado na query", async () => {
    const idAnoLetivo = await criarAnoLetivo(2035, true);
    const res = await request(app).get("/api/planejamento/gestao-vagas");
    expect(res.status).toBe(200);
    expect(res.body.anoLetivo.id).toBe(idAnoLetivo);
  });

  it("calcula matrículas, rematrículas e vagas disponíveis por turma, cruzando Aluno.ID_TURMA", async () => {
    const idAnoLetivo = await criarAnoLetivo(2030, true);
    const idSerie = await criarSerie("1º Ano A", idAnoLetivo);
    const idTurma = await criarTurma("1º Ano A", idSerie, 5);

    const aluno1 = await criarAluno("Aluno Matriculado 1", idTurma);
    const aluno2 = await criarAluno("Aluno Matriculado 2", idTurma);
    const aluno3 = await criarAluno("Aluno Rematriculado", idTurma);

    await criarMatricula(aluno1, idAnoLetivo);
    await criarMatricula(aluno2, idAnoLetivo);
    await criarRematricula(aluno3, idAnoLetivo);

    const res = await request(app).get("/api/planejamento/gestao-vagas").query({ anoLetivo: idAnoLetivo });
    expect(res.status).toBe(200);
    expect(res.body.anoLetivo.id).toBe(idAnoLetivo);

    const linha = res.body.turmas.find((t: { idTurma: string }) => t.idTurma === idTurma);
    expect(linha).toBeDefined();
    expect(linha.capacidadeMaxima).toBe(5);
    expect(linha.matriculas).toBe(2);
    expect(linha.rematriculas).toBe(1);
    expect(linha.totalPreenchido).toBe(3);
    expect(linha.vagasDisponiveis).toBe(2);
    expect(linha.status).toBe("Com vagas");
  });

  it("não conta Matrícula de Aluno sem Turma vinculada (ID_TURMA vazio)", async () => {
    const idAnoLetivo = await criarAnoLetivo(2031, true);
    const idSerie = await criarSerie("2º Ano A", idAnoLetivo);
    const idTurma = await criarTurma("2º Ano A", idSerie, 10);

    const alunoSemTurma = await criarAluno("Sem Turma");
    await criarMatricula(alunoSemTurma, idAnoLetivo);

    const res = await request(app).get("/api/planejamento/gestao-vagas").query({ anoLetivo: idAnoLetivo });
    const linha = res.body.turmas.find((t: { idTurma: string }) => t.idTurma === idTurma);
    expect(linha.matriculas).toBe(0);
    expect(linha.status).toBe("Vazia");
  });

  it("não mistura Matrículas de um Ano Letivo diferente", async () => {
    const idAnoLetivoA = await criarAnoLetivo(2032, true);
    const idAnoLetivoB = await criarAnoLetivo(2033, true);
    const idSerie = await criarSerie("3º Ano A", idAnoLetivoA);
    const idTurma = await criarTurma("3º Ano A", idSerie, 10);
    const aluno = await criarAluno("Aluno Ano B", idTurma);
    await criarMatricula(aluno, idAnoLetivoB);

    const res = await request(app).get("/api/planejamento/gestao-vagas").query({ anoLetivo: idAnoLetivoA });
    const linha = res.body.turmas.find((t: { idTurma: string }) => t.idTurma === idTurma);
    expect(linha.matriculas).toBe(0);
  });

  it("marca status Lotada quando preenchido atinge a capacidade máxima", async () => {
    const idAnoLetivo = await criarAnoLetivo(2034, true);
    const idSerie = await criarSerie("4º Ano A", idAnoLetivo);
    const idTurma = await criarTurma("4º Ano A", idSerie, 1);
    const aluno = await criarAluno("Aluno Único", idTurma);
    await criarMatricula(aluno, idAnoLetivo);

    const res = await request(app).get("/api/planejamento/gestao-vagas").query({ anoLetivo: idAnoLetivo });
    const linha = res.body.turmas.find((t: { idTurma: string }) => t.idTurma === idTurma);
    expect(linha.vagasDisponiveis).toBe(0);
    expect(linha.status).toBe("Lotada");
  });
});
