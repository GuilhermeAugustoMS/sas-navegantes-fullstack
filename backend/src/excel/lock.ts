import lockfile from "proper-lockfile";
import fs from "node:fs";

/**
 * Controle de concorrência (Seção 36): antes de alterar um arquivo, adquire lock;
 * qualquer outra escrita concorrente espera ou falha rapidamente.
 */
export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Não é possível travar um arquivo que não existe: ${filePath}`);
  }
  const release = await lockfile.lock(filePath, {
    retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
    stale: 30_000,
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}
