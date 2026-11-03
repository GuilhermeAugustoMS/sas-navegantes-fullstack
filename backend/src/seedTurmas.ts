/**
 * Semeia as 51 Turmas reais a partir de "0.2.2.1-2025-Planejamento
 * Orçamentário (1).xlsx" (planilha real fornecida pelo usuário), aba
 * "Base-Gerais", colunas B ("Séries & Turmas") e C ("Qtde máxima de
 * estudantes por sala"), linhas 4-54.
 *
 * Cada linha da planilha já corresponde, pelo nome, a uma Série existente
 * no banco (a base real importada colapsou Série+Turma num nome só, ex.
 * "1º Ano A" -- ver CLAUDE.md, pendência "Aba Turmas vazia"). Por isso este
 * script casa por NOME exato com a Série já cadastrada e cria uma Turma
 * 1:1 apontando pra ela, com a capacidade máxima real.
 *
 * ID_TURNO e ID_SALA ficam de fora -- a planilha não tem turno/sala
 * confiável por turma (as colunas correspondentes em Base-Gerais são só
 * listas de opções soltas, não dados por linha; o ensalamento físico foi
 * adiado pelo usuário em 2026-11-02).
 *
 * Rodar uma vez: `npx tsx src/seedTurmas.ts`. Seguro rodar de novo -- pula
 * Turmas que já existem para a mesma Série (checa antes de inserir).
 *
 * Regra 52 do projeto (contra alucinação): os nomes/capacidades abaixo
 * foram lidos diretamente das células da planilha, não inventados.
 */
import { PostgresRepository } from "./repository/PostgresRepository.js";
import { getPrismaClient } from "./repository/prismaClient.js";
import { CADASTROS } from "./schema/files.js";

const USUARIO = "seed-turmas";

// Direto da planilha, aba "Base-Gerais", colunas B/C, linhas 4-54.
const TURMAS: { nome: string; capacidade: number }[] = [
  { nome: "G1 A", capacidade: 12 },
  { nome: "G1 B", capacidade: 12 },
  { nome: "G1 C", capacidade: 12 },
  { nome: "Maternal 1 A", capacidade: 15 },
  { nome: "Maternal 1 B", capacidade: 15 },
  { nome: "Maternal 1 C", capacidade: 15 },
  { nome: "Maternal 2 A", capacidade: 18 },
  { nome: "Maternal 2 B", capacidade: 18 },
  { nome: "Maternal 2 C", capacidade: 18 },
  { nome: "1º Período A", capacidade: 18 },
  { nome: "1º Período B", capacidade: 18 },
  { nome: "1º Período C", capacidade: 18 },
  { nome: "2º Período A", capacidade: 19 },
  { nome: "2º Período B", capacidade: 19 },
  { nome: "2º Período C", capacidade: 19 },
  { nome: "1º Ano A", capacidade: 20 },
  { nome: "1º Ano B", capacidade: 20 },
  { nome: "1º Ano C", capacidade: 20 },
  { nome: "2º Ano A", capacidade: 21 },
  { nome: "2º Ano B", capacidade: 21 },
  { nome: "2º Ano C", capacidade: 21 },
  { nome: "3º Ano A", capacidade: 21 },
  { nome: "3º Ano B", capacidade: 21 },
  { nome: "3º Ano C", capacidade: 21 },
  { nome: "4º Ano A", capacidade: 21 },
  { nome: "4º Ano B", capacidade: 21 },
  { nome: "4º Ano C", capacidade: 21 },
  { nome: "5º Ano A", capacidade: 22 },
  { nome: "5º Ano B", capacidade: 22 },
  { nome: "5º Ano C", capacidade: 22 },
  { nome: "6º Ano A", capacidade: 25 },
  { nome: "6º Ano B", capacidade: 25 },
  { nome: "6º Ano C", capacidade: 25 },
  { nome: "7º Ano A", capacidade: 25 },
  { nome: "7º Ano B", capacidade: 25 },
  { nome: "7º Ano C", capacidade: 25 },
  { nome: "8º Ano A", capacidade: 25 },
  { nome: "8º Ano B", capacidade: 25 },
  { nome: "8º Ano C", capacidade: 25 },
  { nome: "9º Ano A", capacidade: 25 },
  { nome: "9º Ano B", capacidade: 25 },
  { nome: "9º Ano C", capacidade: 30 },
  { nome: "EM-1° Ano A", capacidade: 30 },
  { nome: "EM-1º Ano B", capacidade: 30 },
  { nome: "EM-1º Ano C", capacidade: 30 },
  { nome: "EM-2º Ano A", capacidade: 30 },
  { nome: "EM-2º Ano B", capacidade: 30 },
  { nome: "EM-2º Ano C", capacidade: 30 },
  { nome: "EM-3º Ano A", capacidade: 30 },
  { nome: "EM-3º Ano B", capacidade: 30 },
  { nome: "EM-3º Ano C", capacidade: 30 },
];

async function main() {
  const prisma = getPrismaClient();
  const repo = new PostgresRepository(prisma);

  const series = await repo.readAll(CADASTROS, "Series");
  const turmasExistentes = await repo.readAll(CADASTROS, "Turmas");

  let criadas = 0;
  let jaExistiam = 0;
  const naoEncontradas: string[] = [];

  for (const t of TURMAS) {
    const serie = series.find((s) => s.NOME === t.nome);
    if (!serie) {
      naoEncontradas.push(t.nome);
      console.log(`AVISO: nenhuma Série encontrada com o nome "${t.nome}" -- pulando.`);
      continue;
    }

    const jaExiste = turmasExistentes.some((tu) => tu.ID_SERIE === serie.ID_SERIE);
    if (jaExiste) {
      jaExistiam++;
      console.log(`Turma "${t.nome}" já existia para a Série ${serie.ID_SERIE}`);
      continue;
    }

    const turma = await repo.insert(
      CADASTROS,
      "Turmas",
      { ID_SERIE: serie.ID_SERIE, NOME: t.nome, CAPACIDADE_MAXIMA: t.capacidade, ATIVO: true },
      { usuario: USUARIO },
    );
    turmasExistentes.push(turma);
    criadas++;
    console.log(`Criada Turma "${t.nome}" (${turma.ID_TURMA}), capacidade ${t.capacidade}`);
  }

  console.log(`\nSemeadura concluída: ${criadas} criadas, ${jaExistiam} já existiam, ${naoEncontradas.length} sem Série correspondente.`);
  if (naoEncontradas.length > 0) {
    console.log("Sem Série correspondente:", naoEncontradas);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
