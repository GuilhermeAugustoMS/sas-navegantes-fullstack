/**
 * Importa a aba "Gestão-Negociação" da planilha real
 * "0.2.2.1-2025-Planejamento Orçamentário (1).xlsx" (fornecida pelo
 * usuário em C:\...\Projetos\Planilha) -- decisão explícita do usuário em
 * 2026-11-02 ("suba os dados que estão na planilha só para termos como
 * fazer teste"), depois de confirmar via AskUserQuestion:
 *
 * - Só linhas com "Status da Negociação" = "Matriculado" ou "Rematriculado"
 *   (244 de 296) entram. "Oportunidade perdida" (52 linhas) ficou de fora
 *   desta passada -- CRM histórico que não contribui pro preenchimento de
 *   Turmas, que é o objetivo combinado aqui.
 * - Essas negociações são de 2025 (fechadas em 2024/2025 -- ver coluna
 *   "Mensalidade de 2025"/datas de assinatura), não de 2026 (o Ano Letivo
 *   ativo hoje). Cria um Ano Letivo 2025 histórico (ATIVO:false) e vincula
 *   as Matrículas/Rematrículas a ele -- não inventa que são de 2026.
 * - DATA_NASCIMENTO não existe nessa planilha -- fica em branco (campo
 *   virou opcional em 2026-11-02 pra isso, ver
 *   prisma/migrations/20261102180000_alunos_data_nascimento_opcional e
 *   backend/src/schema/files.ts).
 * - 27 das 244 linhas não têm "Data de assinatura do contrato" -- sem essa
 *   data não dá pra preencher DATA_CADASTRO/DATA_MATRICULA (obrigatórios)
 *   sem inventar valor, então ficaram de fora também (logadas abaixo).
 * - GENERO: "Menina"/"Menino" da planilha normalizado para "Feminino"/
 *   "Masculino" (mesma convenção já usada nos Alunos existentes).
 * - Nenhuma Proposta/Parcela é criada -- não há valores de mensalidade
 *   confiáveis o bastante pra rodar o motor de cálculo (propostaEngine)
 *   sem inventar regra de desconto/forma de pagamento real. Só
 *   Aluno + Negociação + Matrícula/Rematrícula.
 *
 * Regra 52 do projeto (contra alucinação): todo valor abaixo vem direto de
 * uma célula da planilha, nada foi inventado.
 *
 * Rodar uma vez: `npx tsx src/seedNegociacoes2025.ts`. Seguro rodar de
 * novo -- pula Alunos que já existem com o mesmo NOME.
 */
import ExcelJS from "exceljs";
import { PostgresRepository } from "./repository/PostgresRepository.js";
import { getPrismaClient } from "./repository/prismaClient.js";
import { CADASTROS, COMERCIAL } from "./schema/files.js";

const USUARIO = "seed-negociacoes-2025";
const PLANILHA_PATH =
  "C:\\Users\\Administrador\\OneDrive\\Área de Trabalho\\Projetos\\Planilha\\0.2.2.1-2025-Planejamento Orçamentário (1).xlsx";
const ABA = "Gestão-Negociação";

interface LinhaNegociacao {
  linha: number;
  status: "Matriculado" | "Rematriculado";
  turma: string;
  genero: string | null;
  nome: string;
  dataContrato: Date | null;
}

function normalizarGenero(g: string | null): string | undefined {
  if (g === "Menina") return "Feminino";
  if (g === "Menino") return "Masculino";
  return undefined;
}

async function lerPlanilha(): Promise<LinhaNegociacao[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA_PATH);
  const sh = wb.getWorksheet(ABA);
  if (!sh) throw new Error(`Aba "${ABA}" não encontrada na planilha.`);

  const linhas: LinhaNegociacao[] = [];
  // Header real está na linha 3 (confirmado por inspeção manual); dados começam na linha 4.
  for (let r = 4; r <= sh.rowCount; r++) {
    const row = sh.getRow(r);
    const nomeRaw = row.getCell(8).value; // H: Nome do Estudante
    if (!nomeRaw || typeof nomeRaw !== "string" || !nomeRaw.trim()) continue;

    const status = row.getCell(5).value; // E: Status da Negociação
    if (status !== "Matriculado" && status !== "Rematriculado") continue;

    const turma = row.getCell(6).value; // F: Turma
    const genero = row.getCell(7).value; // G: Gênero
    const dataContratoRaw = row.getCell(60).value; // BH: Data de assinatura do contrato

    linhas.push({
      linha: r,
      status,
      turma: typeof turma === "string" ? turma.trim() : "",
      genero: typeof genero === "string" ? genero : null,
      nome: nomeRaw.trim(),
      dataContrato: dataContratoRaw instanceof Date ? dataContratoRaw : null,
    });
  }
  return linhas;
}

async function main() {
  const prisma = getPrismaClient();
  const repo = new PostgresRepository(prisma);

  const linhas = await lerPlanilha();
  console.log(`Linhas Matriculado/Rematriculado na planilha: ${linhas.length}`);

  const semData = linhas.filter((l) => !l.dataContrato);
  const comData = linhas.filter((l) => l.dataContrato);
  console.log(`Sem "Data de assinatura do contrato" (puladas, não dá pra preencher data obrigatória sem inventar): ${semData.length}`);
  for (const l of semData) console.log(`  linha ${l.linha}: ${l.nome} (${l.status})`);

  const anosLetivos = await repo.readAll(CADASTROS, "AnosLetivos");
  let anoLetivo2025 = anosLetivos.find((a) => Number(a.ANO) === 2025);
  if (!anoLetivo2025) {
    anoLetivo2025 = await repo.insert(CADASTROS, "AnosLetivos", { ANO: 2025, ATIVO: false }, { usuario: USUARIO });
    console.log(`\nCriado Ano Letivo 2025 histórico (${anoLetivo2025.ID_ANO_LETIVO})`);
  } else {
    console.log(`\nAno Letivo 2025 já existia (${anoLetivo2025.ID_ANO_LETIVO})`);
  }

  const turmas = await repo.readAll(CADASTROS, "Turmas");
  const statusNegociacao = await repo.readAll(COMERCIAL, "StatusNegociacao");
  const alunosExistentes = await repo.readAll(CADASTROS, "Alunos");

  const statusMatriculado = statusNegociacao.find((s) => s.NOME === "Matriculado" && s.ATIVO === true);
  const statusRematriculado = statusNegociacao.find((s) => s.NOME === "Rematriculado" && s.ATIVO === true);
  if (!statusMatriculado || !statusRematriculado) {
    throw new Error("StatusNegociacao 'Matriculado'/'Rematriculado' não encontrado no banco -- abortando.");
  }

  let criados = 0;
  let pulados = 0;
  const semTurma: string[] = [];

  for (const l of comData) {
    const jaExiste = alunosExistentes.some((a) => a.NOME === l.nome);
    if (jaExiste) {
      pulados++;
      continue;
    }

    const turma = turmas.find((t) => t.NOME === l.turma);
    if (!turma) {
      semTurma.push(`${l.nome} (${l.turma})`);
      continue;
    }

    const aluno = await repo.insert(
      CADASTROS,
      "Alunos",
      {
        NOME: l.nome,
        GENERO: normalizarGenero(l.genero),
        ID_SERIE: turma.ID_SERIE,
        ID_TURMA: turma.ID_TURMA,
        DATA_CADASTRO: l.dataContrato as Date,
        ATIVO: true,
      },
      { usuario: USUARIO },
    );
    alunosExistentes.push(aluno);

    await repo.insert(
      COMERCIAL,
      "Negociacoes",
      {
        ID_ALUNO: aluno.ID_ALUNO,
        ID_SERIE: turma.ID_SERIE,
        ID_STATUS_NEGOCIACAO:
          l.status === "Matriculado" ? statusMatriculado.ID_STATUS_NEGOCIACAO : statusRematriculado.ID_STATUS_NEGOCIACAO,
        DATA_ULTIMA_ATUALIZACAO: l.dataContrato as Date,
      },
      { usuario: USUARIO },
    );

    if (l.status === "Matriculado") {
      await repo.insert(
        COMERCIAL,
        "Matriculas",
        {
          ID_ALUNO: aluno.ID_ALUNO,
          ID_ANO_LETIVO: anoLetivo2025.ID_ANO_LETIVO,
          DATA_MATRICULA: l.dataContrato as Date,
          STATUS: "Matriculado",
        },
        { usuario: USUARIO },
      );
    } else {
      await repo.insert(
        COMERCIAL,
        "Rematriculas",
        {
          ID_ALUNO: aluno.ID_ALUNO,
          ID_ANO_LETIVO: anoLetivo2025.ID_ANO_LETIVO,
          STATUS: "Rematriculado",
        },
        { usuario: USUARIO },
      );
    }

    criados++;
    console.log(`Criado: ${l.nome} -> ${turma.NOME} (${l.status})`);
  }

  console.log(
    `\nConcluído: ${criados} alunos criados, ${pulados} já existiam (nome duplicado), ${semTurma.length} sem Turma correspondente.`,
  );
  if (semTurma.length > 0) console.log("Sem Turma correspondente:", semTurma);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
