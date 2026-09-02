import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Raiz de dados. Hoje single-tenant; para multi-tenant (Seção 41 do prompt mestre)
 * basta passar uma DATA_ROOT diferente por tenant (ex.: DATA/<TENANT_ID>) --
 * todo o resto do ExcelRepository é agnóstico a isso.
 */
export const DATA_ROOT = process.env.SAS_DATA_ROOT ?? path.resolve(__dirname, "../../data");
export const BACKUPS_ROOT = path.join(DATA_ROOT, "BACKUPS");

export function filePath(fileName: string): string {
  return path.join(DATA_ROOT, fileName);
}
