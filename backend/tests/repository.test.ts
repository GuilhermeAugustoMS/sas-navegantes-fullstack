import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// DATA_ROOT é lido de process.env no momento do import de config/paths.ts,
// então isolamos cada suíte de teste num diretório temporário próprio antes
// de importar qualquer módulo do repositório.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sas-data-"));
process.env.SAS_DATA_ROOT = tmpRoot;

const { ExcelRepository, ValidationFailedError, RecordNotFoundError } = await import("../src/excel/ExcelRepository.js");
const { CADASTROS, AUDITORIA } = await import("../src/schema/files.js");

const repo = new ExcelRepository();
const ctx = { usuario: "teste-automatizado" };

beforeAll(async () => {
  await repo.ensureFile(AUDITORIA);
  await repo.ensureFile(CADASTROS);
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("ExcelRepository - CRUD sobre Alunos", () => {
  it("cria um arquivo com todas as abas e cabeçalhos esperados", async () => {
    const rows = await repo.readAll(CADASTROS, "Alunos");
    expect(rows).toEqual([]);
  });

  it("insere um aluno e gera ID sequencial estável (ALU_000001)", async () => {
    const aluno = await repo.insert(
      CADASTROS,
      "Alunos",
      {
        NOME: "Aluno Um",
        DATA_NASCIMENTO: new Date("2019-03-01"),
        GENERO: "Menino",
        ID_UNIDADE: "UNI_000001",
        DATA_CADASTRO: new Date(),
        ATIVO: true,
      },
      ctx,
    );
    expect(aluno.ID_ALUNO).toBe("ALU_000001");
  });

  it("o segundo aluno recebe ALU_000002, nunca reaproveitando o primeiro", async () => {
    const aluno2 = await repo.insert(
      CADASTROS,
      "Alunos",
      {
        NOME: "Aluno Dois",
        DATA_NASCIMENTO: new Date("2020-05-01"),
        ID_UNIDADE: "UNI_000001",
        DATA_CADASTRO: new Date(),
        ATIVO: true,
      },
      ctx,
    );
    expect(aluno2.ID_ALUNO).toBe("ALU_000002");
  });

  it("rejeita inserção sem campo obrigatório", async () => {
    await expect(
      repo.insert(CADASTROS, "Alunos", { NOME: "" } as any, ctx),
    ).rejects.toBeInstanceOf(ValidationFailedError);
  });

  it("atualiza um campo e preserva o restante do registro", async () => {
    const updated = await repo.update(CADASTROS, "Alunos", "ALU_000001", { NOME: "Aluno Um Renomeado" }, ctx);
    expect(updated.NOME).toBe("Aluno Um Renomeado");
    expect(updated.ID_ALUNO).toBe("ALU_000001");

    const reread = await repo.findById(CADASTROS, "Alunos", "ALU_000001");
    expect(reread?.NOME).toBe("Aluno Um Renomeado");
  });

  it("falha ao atualizar ID inexistente", async () => {
    await expect(
      repo.update(CADASTROS, "Alunos", "ALU_999999", { NOME: "x" }, ctx),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it("exclusão lógica marca ATIVO=false em vez de apagar a linha (Seção 62)", async () => {
    await repo.softDelete(CADASTROS, "Alunos", "ALU_000002", ctx);
    const rows = await repo.readAll(CADASTROS, "Alunos");
    expect(rows).toHaveLength(2); // linha continua existindo
    const aluno2 = rows.find((r) => r.ID_ALUNO === "ALU_000002");
    expect(aluno2?.ATIVO).toBe(false);
  });

  it("query filtra registros ativos", async () => {
    const ativos = await repo.query(CADASTROS, "Alunos", (r) => r.ATIVO === true);
    expect(ativos.map((r) => r.ID_ALUNO)).toEqual(["ALU_000001"]);
  });

  it("cada alteração gera uma linha em LogsAlteracoes com usuário, ação e campo", async () => {
    const logs = await repo.readAll(AUDITORIA, "LogsAlteracoes");
    const criacoes = logs.filter((l) => l.ACAO === "CRIACAO" && l.ARQUIVO === "01_CADASTROS.xlsx");
    expect(criacoes.length).toBeGreaterThanOrEqual(2);

    const alteracaoNome = logs.find((l) => l.ACAO === "ALTERACAO" && l.CAMPO === "NOME");
    expect(alteracaoNome).toBeDefined();
    expect(alteracaoNome?.VALOR_NOVO).toBe("Aluno Um Renomeado");
    expect(alteracaoNome?.USUARIO).toBe("teste-automatizado");
  });
});
