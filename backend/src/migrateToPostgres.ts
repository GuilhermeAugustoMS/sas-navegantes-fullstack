/**
 * Migração dos dados reais dos .xlsx (backend/data/) para o Postgres
 * (Seção 57, decidida com o usuário em 2026-09-16).
 *
 * - Lê tudo via ExcelRepository (fonte de verdade continua sendo os .xlsx).
 * - Grava via upsert em cada tabela Postgres (Prisma) -- idempotente: rodar
 *   de novo não duplica nada, só reaplica os mesmos dados.
 * - Não passa pelo PostgresRepository.insert()/update() de propósito: isso
 *   geraria uma entrada de auditoria "CRIACAO" com a data de HOJE para cada
 *   registro migrado, sobrepondo o histórico real (que já está sendo
 *   migrado como dado, na própria aba LogsAlteracoes). A migração é uma
 *   relocação de dado existente, não uma criação nova.
 * - Sem FK real no banco (ver prisma/schema.prisma), então a ordem de
 *   inserção entre módulos não importa -- nenhuma tabela pode rejeitar a
 *   escrita de outra por integridade referencial.
 * - Os .xlsx originais em backend/data/ NUNCA são apagados ou alterados por
 *   este script -- continuam guardados como estão (confirmado com o usuário).
 *
 * Rodar (dentro de backend/, com DATABASE_URL configurado e as migrations já
 * aplicadas via `npx prisma migrate dev`): `npx tsx src/migrateToPostgres.ts`
 */
import { ExcelRepository } from "./excel/ExcelRepository.js";
import { validateRecord } from "./excel/validate.js";
import { ALL_FILES } from "./schema/files.js";
import { getPrismaClient } from "./repository/prismaClient.js";
import { modelAccessor, toDbData } from "./repository/mapping.js";
import type { FileDef, SheetDef } from "./types/schema.js";

interface Relatorio {
  arquivo: string;
  aba: string;
  lidos: number;
  migrados: number;
  invalidos: number;
}

async function migrarAba(
  excel: ExcelRepository,
  prisma: ReturnType<typeof getPrismaClient>,
  fileDef: FileDef,
  sheet: SheetDef,
): Promise<Relatorio> {
  const rows = await excel.readAll(fileDef, sheet.name);
  const idColumn = sheet.columns.find((c) => c.isId)?.name;
  if (!idColumn) throw new Error(`Aba ${sheet.name} não tem coluna de ID -- migração não sabe como fazer upsert.`);

  const accessor = modelAccessor(fileDef, sheet.name);
  const delegate = (prisma as any)[accessor];
  if (!delegate) throw new Error(`Nenhum modelo Prisma para ${fileDef.fileName} / ${sheet.name} (accessor "${accessor}").`);

  let migrados = 0;
  let invalidos = 0;
  for (const row of rows) {
    const id = row[idColumn];
    if (!id) {
      console.warn(`  [AVISO] ${fileDef.fileName}/${sheet.name}: registro sem ${idColumn}, pulado.`);
      invalidos++;
      continue;
    }
    const errors = validateRecord(sheet, row);
    if (errors.length > 0) {
      console.warn(`  [AVISO] ${fileDef.fileName}/${sheet.name} ${idColumn}=${id}: inválido, pulado -- ${errors.map((e) => `${e.field}: ${e.problem}`).join("; ")}`);
      invalidos++;
      continue;
    }
    const data = toDbData(sheet, row);
    await delegate.upsert({ where: { [idColumn]: id }, create: data, update: data });
    migrados++;
  }

  return { arquivo: fileDef.fileName, aba: sheet.name, lidos: rows.length, migrados, invalidos };
}

async function main() {
  const excel = new ExcelRepository();
  const prisma = getPrismaClient();

  const relatorios: Relatorio[] = [];
  for (const fileDef of ALL_FILES) {
    for (const sheet of fileDef.sheets) {
      const r = await migrarAba(excel, prisma, fileDef, sheet);
      relatorios.push(r);
      console.log(`${r.arquivo.padEnd(22)} ${r.aba.padEnd(28)} lidos=${r.lidos}  migrados=${r.migrados}  invalidos=${r.invalidos}`);
    }
  }

  const totalLidos = relatorios.reduce((s, r) => s + r.lidos, 0);
  const totalMigrados = relatorios.reduce((s, r) => s + r.migrados, 0);
  const totalInvalidos = relatorios.reduce((s, r) => s + r.invalidos, 0);
  console.log(`\nMigração concluída: ${totalMigrados}/${totalLidos} registros migrados (${totalInvalidos} inválidos/pulados) em ${relatorios.length} abas.`);
  console.log(`Os arquivos .xlsx originais em backend/data/ não foram alterados.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
