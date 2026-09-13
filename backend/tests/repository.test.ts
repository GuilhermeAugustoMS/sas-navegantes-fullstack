import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";

// DATA_ROOT é lido de process.env no momento do import de config/paths.ts,
// então isolamos cada suíte de teste num diretório temporário próprio antes
// de importar qualquer módulo do repositório.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sas-data-"));
process.env.SAS_DATA_ROOT = tmpRoot;

const { ExcelRepository, ValidationFailedError, RecordNotFoundError } = await import("../src/excel/ExcelRepository.js");
const { CADASTROS, AUDITORIA, FINANCEIRO, COMERCIAL } = await import("../src/schema/files.js");

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

describe("ExcelRepository.ensureFile - migração de schema em arquivo já existente", () => {
  // Regressão de um bug real: o usuário já tinha 02_FINANCEIRO.xlsx criado antes
  // do schema ganhar as abas TabelaPrecos/ProgramasExtras (Gerador de Proposta,
  // Seção 22). `ensureFile` só criava o arquivo do zero se ele não existisse --
  // rodando `seed:precos` contra o arquivo real, o script quebrava com
  // "Aba não encontrada: TabelaPrecos". ensureFile agora também adiciona, num
  // arquivo já existente, só as abas que estiverem faltando, sem tocar nas que
  // já têm dados.
  it("acrescenta abas novas do schema a um arquivo antigo sem perder dados existentes", async () => {
    // DATA_ROOT já foi congelado (a partir de process.env.SAS_DATA_ROOT) no momento
    // em que este arquivo de teste importou config/paths.ts lá em cima -- reatribuir
    // a variável de ambiente aqui não teria efeito. Por isso o arquivo "antigo" é
    // escrito direto dentro do mesmo tmpRoot já em uso por esta suíte (não conflita
    // com CADASTROS/AUDITORIA, que são arquivos .xlsx diferentes).
    fs.rmSync(path.join(tmpRoot, FINANCEIRO.fileName), { force: true });

    // Simula um 02_FINANCEIRO.xlsx "antigo": todas as abas do schema atual,
    // MENOS TabelaPrecos/ProgramasExtras, com um registro real em Receitas.
    const wbAntigo = new ExcelJS.Workbook();
    for (const sheet of FINANCEIRO.sheets) {
      if (sheet.name === "TabelaPrecos" || sheet.name === "ProgramasExtras") continue;
      const ws = wbAntigo.addWorksheet(sheet.name);
      ws.addRow(sheet.columns.map((c) => c.name));
    }
    const wsReceitas = wbAntigo.getWorksheet("Receitas")!;
    wsReceitas.addRow(["REC_000001", "", "", "Mensalidade", "", "2026-01", "", 1700, "Pago", "", "não pode se perder"]);
    await wbAntigo.xlsx.writeFile(path.join(tmpRoot, FINANCEIRO.fileName));

    await repo.ensureFile(FINANCEIRO);

    const receitas = await repo.readAll(FINANCEIRO, "Receitas");
    expect(receitas).toHaveLength(1);
    expect(receitas[0].ID_LANCAMENTO).toBe("REC_000001");
    expect(receitas[0].OBSERVACAO).toBe("não pode se perder");

    const tabelaPrecos = await repo.readAll(FINANCEIRO, "TabelaPrecos");
    expect(tabelaPrecos).toEqual([]); // aba nova, legível, vazia

    const programasExtras = await repo.readAll(FINANCEIRO, "ProgramasExtras");
    expect(programasExtras).toEqual([]);

    // Idempotente: rodar de novo não duplica nem apaga nada.
    await repo.ensureFile(FINANCEIRO);
    const receitasDepois = await repo.readAll(FINANCEIRO, "Receitas");
    expect(receitasDepois).toHaveLength(1);
  });

  // Regressão de um bug real (2026-09-13): PERCENTUAL_DESCONTO_ENTRADA e
  // DATA_PAGAMENTO_ENTRADA foram adicionados à aba Propostas, que já existia
  // com dados reais. ensureFile só migrava ABAS novas, não COLUNAS novas numa
  // aba já existente -- a coluna nova nunca aparecia no cabeçalho físico, e
  // por isso sumia na leitura (sheetToRecords resolve por nome do cabeçalho).
  // Pior: writeRecordAtRow/appendRecord escreviam por POSIÇÃO do schema, então
  // se algum registro antigo tivesse uma linha "mais larga" que o cabeçalho
  // (ex.: escrita por uma versão anterior e buggy do código), a nova coluna
  // podia entrar deslocada, deixando células órfãs sem nome no meio do
  // cabeçalho. Este teste cobre os dois ângulos: a coluna nova é adicionada
  // corretamente ao final do cabeçalho FÍSICO (não da linha de dado mais
  // larga), e leitura/escrita continuam resolvendo por nome, não por posição.
  it("acrescenta colunas novas do schema a uma aba já existente, resolvendo sempre por nome (não por posição)", async () => {
    fs.rmSync(path.join(tmpRoot, COMERCIAL.fileName), { force: true });

    const propostasDef = COMERCIAL.sheets.find((s) => s.name === "Propostas")!;
    const colunasAntigas = propostasDef.columns.filter(
      (c) =>
        c.name !== "PERCENTUAL_DESCONTO_ENTRADA" &&
        c.name !== "DATA_PAGAMENTO_ENTRADA" &&
        c.name !== "QUANTIDADE_PARCELAS_MATERIAL_INGLES",
    );

    const wbAntigo = new ExcelJS.Workbook();
    for (const sheet of COMERCIAL.sheets) {
      const ws = wbAntigo.addWorksheet(sheet.name);
      if (sheet.name === "Propostas") {
        ws.addRow(colunasAntigas.map((c) => c.name)); // cabeçalho SEM as 2 colunas novas
        ws.addRow(["PRO_000001", "NEG_000001", "2026-01-01", "Criada", 1000, 0]); // registro antigo normal
        // Linha "mais larga" que o cabeçalho -- simula uma célula deixada por uma
        // escrita antiga feita por POSIÇÃO (bug real corrigido em 2026-09-13).
        // ensureFile não pode se guiar pela linha mais larga da aba
        // (ws.columnCount), só pela extensão do próprio cabeçalho -- senão a
        // coluna nova entra deslocada, com posições vazias sem nome no meio.
        ws.addRow(["PRO_000002", "NEG_000001", "2026-02-01", "Criada", 2000, 0, "célula fora do cabeçalho"]);
      } else {
        ws.addRow(sheet.columns.map((c) => c.name));
      }
    }
    await wbAntigo.xlsx.writeFile(path.join(tmpRoot, COMERCIAL.fileName));

    await repo.ensureFile(COMERCIAL);

    // O cabeçalho ganhou as 2 colunas novas logo em seguida às 6 antigas,
    // contíguas -- não deslocadas por causa da linha mais larga (PRO_000002).
    const wbDepois = new ExcelJS.Workbook();
    await wbDepois.xlsx.readFile(path.join(tmpRoot, COMERCIAL.fileName));
    const headerDepois = wbDepois.getWorksheet("Propostas")!.getRow(1).values as unknown[];
    expect(headerDepois.slice(1)).toEqual([
      "ID_PROPOSTA",
      "ID_NEGOCIACAO",
      "DATA_PROPOSTA",
      "STATUS",
      "VALOR_TOTAL_MES",
      "PERCENTUAL_DESCONTO",
      "PERCENTUAL_DESCONTO_ENTRADA",
      "DATA_PAGAMENTO_ENTRADA",
      "QUANTIDADE_PARCELAS_MATERIAL_INGLES",
    ]);

    const propostas = await repo.readAll(COMERCIAL, "Propostas");
    expect(propostas).toHaveLength(2);

    // Registro antigo "normal" continua legível pelas colunas antigas, e a
    // coluna nova existe vazia (registro é anterior a ela).
    const antigo = propostas.find((p) => p.ID_PROPOSTA === "PRO_000001")!;
    expect(antigo.VALOR_TOTAL_MES).toBe(1000);
    expect(antigo.PERCENTUAL_DESCONTO_ENTRADA ?? null).toBeFalsy();

    // Um registro novo grava e relê corretamente pelas colunas novas.
    const novo = await repo.insert(
      COMERCIAL,
      "Propostas",
      {
        ID_NEGOCIACAO: "NEG_000001",
        DATA_PROPOSTA: "2027-01-01",
        STATUS: "Criada",
        PERCENTUAL_DESCONTO_ENTRADA: 25,
        DATA_PAGAMENTO_ENTRADA: "2027-01-05",
      },
      ctx,
    );
    expect(novo.PERCENTUAL_DESCONTO_ENTRADA).toBe(25);

    const relido = await repo.findById(COMERCIAL, "Propostas", novo.ID_PROPOSTA as string);
    expect(relido?.PERCENTUAL_DESCONTO_ENTRADA).toBe(25);

    // Idempotente: rodar de novo não duplica a coluna nem perde dado.
    await repo.ensureFile(COMERCIAL);
    const propostasDepois = await repo.readAll(COMERCIAL, "Propostas");
    expect(propostasDepois).toHaveLength(3);
  });
});
