import { ExcelRepository } from "./excel/ExcelRepository.js";
import { ALL_FILES } from "./schema/files.js";
import { ensureDir } from "./excel/workbookIO.js";
import { DATA_ROOT, BACKUPS_ROOT } from "./config/paths.js";

async function main() {
  await ensureDir(DATA_ROOT);
  await ensureDir(BACKUPS_ROOT);

  const repo = new ExcelRepository();
  for (const fileDef of ALL_FILES) {
    await repo.ensureFile(fileDef);
    console.log(`OK  ${fileDef.fileName}  (${fileDef.sheets.length} abas)`);
  }
  console.log(`\nEstrutura criada em: ${DATA_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
