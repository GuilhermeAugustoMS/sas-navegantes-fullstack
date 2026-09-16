/**
 * Semeia o Ano Letivo 2026, as 13 Séries e a Tabela de Preços/Programas
 * Extras a partir de "Excel mensalidades Navegantes.xlsx" (planilha real
 * fornecida pelo usuário, aba "Planilha1", tabela "TABELA PARA USO DE
 * REQUERIMENTO FINANCEIRO", linhas 63-76, e "PROGRAMAS EXTRAS
 * CURRICULARES", linhas 55-60).
 *
 * Ano letivo confirmado explicitamente pelo usuário como 2026.
 *
 * Rodar uma vez: `npx tsx src/seedPrecos.ts`. É seguro rodar de novo -- pula
 * séries/tabela de preço que já existem para o mesmo nome/ano (checa antes
 * de inserir), nunca duplica.
 *
 * Regra 52 do projeto (contra alucinação): os valores abaixo foram lidos
 * diretamente das células da planilha, não inventados. Onde a planilha era
 * ambígua (colunas de Estendido sem cabeçalho claro para "Hora"/"Fração"),
 * NÃO foram semeados -- só Dia/Mês, que tinham cabeçalho claro.
 */
import { PostgresRepository } from "./repository/PostgresRepository.js";
import { getPrismaClient } from "./repository/prismaClient.js";
import { CADASTROS, FINANCEIRO } from "./schema/files.js";

const USUARIO = "seed-precos";
const ANO_LETIVO = 2026;
const DATA_VIGENCIA = new Date("2026-01-01");

// Direto da planilha, linhas 64-76 (SÉRIE X IDADES | MENSALIDADES | Material Didático | M.D. Inglês | Alimentação)
const SERIES_PRECOS: { nome: string; nivelEnsino: string; mensalidade: number; materialDidatico: number; materialDidaticoIngles: number; alimentacao: number }[] = [
  { nome: "M1", nivelEnsino: "Educação Infantil", mensalidade: 1585, materialDidatico: 290, materialDidaticoIngles: 0, alimentacao: 350 },
  { nome: "M2", nivelEnsino: "Educação Infantil", mensalidade: 1585, materialDidatico: 290, materialDidaticoIngles: 0, alimentacao: 350 },
  { nome: "1º Período", nivelEnsino: "Educação Infantil", mensalidade: 1600, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "2º Período", nivelEnsino: "Educação Infantil", mensalidade: 1600, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "1º Ano", nivelEnsino: "Ensino Fundamental 1", mensalidade: 1650, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "2º Ano", nivelEnsino: "Ensino Fundamental 1", mensalidade: 1700, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "3º Ano", nivelEnsino: "Ensino Fundamental 1", mensalidade: 1700, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "4º Ano", nivelEnsino: "Ensino Fundamental 1", mensalidade: 1700, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "5º Ano", nivelEnsino: "Ensino Fundamental 1", mensalidade: 1700, materialDidatico: 290, materialDidaticoIngles: 480, alimentacao: 350 },
  { nome: "6º Ano", nivelEnsino: "Ensino Fundamental 2", mensalidade: 1900, materialDidatico: 310, materialDidaticoIngles: 515, alimentacao: 470 },
  { nome: "7º Ano", nivelEnsino: "Ensino Fundamental 2", mensalidade: 1900, materialDidatico: 310, materialDidaticoIngles: 515, alimentacao: 470 },
  { nome: "8º Ano", nivelEnsino: "Ensino Fundamental 2", mensalidade: 1900, materialDidatico: 310, materialDidaticoIngles: 515, alimentacao: 470 },
  { nome: "9º Ano", nivelEnsino: "Ensino Fundamental 2", mensalidade: 1910, materialDidatico: 330, materialDidaticoIngles: 515, alimentacao: 470 },
];

// Direto da planilha, linhas 56-60 (só Dia/Mês, colunas com cabeçalho claro).
const PROGRAMAS_EXTRAS: { nome: "Integral" | "Semi-Integral" | "Estendido"; valorDia: number; valorMes: number }[] = [
  { nome: "Integral", valorDia: 90, valorMes: 910 },
  { nome: "Semi-Integral", valorDia: 60, valorMes: 700 },
  { nome: "Estendido", valorDia: 40, valorMes: 350 },
];

async function main() {
  const prisma = getPrismaClient();
  const repo = new PostgresRepository(prisma);

  const anosExistentes = await repo.readAll(CADASTROS, "AnosLetivos");
  let anoLetivo = anosExistentes.find((a) => Number(a.ANO) === ANO_LETIVO);
  if (!anoLetivo) {
    anoLetivo = await repo.insert(CADASTROS, "AnosLetivos", { ANO: ANO_LETIVO, ATIVO: true }, { usuario: USUARIO });
    console.log(`Criado Ano Letivo ${ANO_LETIVO} (${anoLetivo.ID_ANO_LETIVO})`);
  } else {
    console.log(`Ano Letivo ${ANO_LETIVO} já existia (${anoLetivo.ID_ANO_LETIVO})`);
  }
  const idAnoLetivo = anoLetivo.ID_ANO_LETIVO;

  const seriesExistentes = await repo.readAll(CADASTROS, "Series");
  const precosExistentes = await repo.readAll(FINANCEIRO, "TabelaPrecos");

  for (const s of SERIES_PRECOS) {
    let serie = seriesExistentes.find((r) => r.NOME === s.nome && r.ID_ANO_LETIVO === idAnoLetivo);
    if (!serie) {
      serie = await repo.insert(
        CADASTROS,
        "Series",
        { NOME: s.nome, NIVEL_ENSINO: s.nivelEnsino, ID_ANO_LETIVO: idAnoLetivo, ATIVO: true },
        { usuario: USUARIO },
      );
      seriesExistentes.push(serie);
      console.log(`Criada Série "${s.nome}" (${serie.ID_SERIE})`);
    } else {
      console.log(`Série "${s.nome}" já existia (${serie.ID_SERIE})`);
    }

    const jaTemPreco = precosExistentes.some((p) => p.ID_SERIE === serie!.ID_SERIE && p.ATIVO === true);
    if (!jaTemPreco) {
      await repo.insert(
        FINANCEIRO,
        "TabelaPrecos",
        {
          ID_SERIE: serie.ID_SERIE,
          MENSALIDADE: s.mensalidade,
          MATERIAL_DIDATICO: s.materialDidatico,
          MATERIAL_DIDATICO_INGLES: s.materialDidaticoIngles,
          ALIMENTACAO: s.alimentacao,
          DATA_VIGENCIA,
          ATIVO: true,
        },
        { usuario: USUARIO },
      );
      console.log(`  -> Tabela de Preços criada para "${s.nome}"`);
    } else {
      console.log(`  -> Tabela de Preços já existia para "${s.nome}"`);
    }
  }

  const extrasExistentes = await repo.readAll(FINANCEIRO, "ProgramasExtras");
  for (const p of PROGRAMAS_EXTRAS) {
    const jaExiste = extrasExistentes.some((r) => r.NOME === p.nome && r.ATIVO === true);
    if (jaExiste) {
      console.log(`Programa Extra "${p.nome}" já existia`);
      continue;
    }
    await repo.insert(
      FINANCEIRO,
      "ProgramasExtras",
      { NOME: p.nome, VALOR_DIA: p.valorDia, VALOR_MES: p.valorMes, DATA_VIGENCIA, ATIVO: true },
      { usuario: USUARIO },
    );
    console.log(`Criado Programa Extra "${p.nome}"`);
  }

  console.log("\nSemeadura concluída.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
