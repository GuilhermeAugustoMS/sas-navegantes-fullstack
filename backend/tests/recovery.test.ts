import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sas-data-recovery-"));
process.env.SAS_DATA_ROOT = tmpRoot;

const { ExcelRepository } = await import("../src/excel/ExcelRepository.js");
const { CADASTROS, AUDITORIA } = await import("../src/schema/files.js");
const { filePath } = await import("../src/config/paths.js");
const { listBackups, latestBackup, restoreFile } = await import("../src/excel/backup.js");

const repo = new ExcelRepository();
const ctx = { usuario: "teste-recovery" };

beforeAll(async () => {
  await repo.ensureFile(AUDITORIA);
  await repo.ensureFile(CADASTROS);
  await repo.insert(
    CADASTROS,
    "Equipes",
    { NOME: "Equipe Carajás", ATIVO: true },
    ctx,
  );
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("Backup e recuperação (Seções 38/39/59)", () => {
  it("gera um backup antes de cada escrita", async () => {
    await repo.insert(CADASTROS, "Equipes", { NOME: "Equipe Liberdade", ATIVO: true }, ctx);
    const backups = await listBackups(CADASTROS.fileName);
    expect(backups.length).toBeGreaterThanOrEqual(1);
  });

  it("restaura a partir do último backup e recupera o estado anterior", async () => {
    const before = await repo.readAll(CADASTROS, "Equipes");

    await repo.insert(CADASTROS, "Equipes", { NOME: "Equipe Temporária", ATIVO: true }, ctx);
    const afterInsert = await repo.readAll(CADASTROS, "Equipes");
    expect(afterInsert.length).toBe(before.length + 1);

    // O backup mais recente foi tirado ANTES desta última inserção.
    await repo.restoreLatestBackup(CADASTROS);
    const afterRestore = await repo.readAll(CADASTROS, "Equipes");
    expect(afterRestore.length).toBe(before.length);
  });

  it("simula falha durante a etapa final de gravação (substituição atômica) e preserva o arquivo original", async () => {
    const target = filePath(CADASTROS.fileName);
    const before = fs.readFileSync(target);

    // Simula uma falha exatamente na etapa crítica descrita na Seção 37: o
    // arquivo temporário já foi escrito e validado, mas o rename() final que
    // substitui o original falha (disco cheio, permissão revogada em runtime etc).
    const renameSpy = vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("Falha simulada de disco"));

    await expect(
      repo.insert(CADASTROS, "Equipes", { NOME: "Não deve ser gravada", ATIVO: true }, ctx),
    ).rejects.toThrow("Falha simulada de disco");

    renameSpy.mockRestore();

    const after = fs.readFileSync(target);
    expect(after.equals(before)).toBe(true); // arquivo original preservado, conforme Seção 37/59

    const rows = await repo.readAll(CADASTROS, "Equipes");
    expect(rows.some((r) => r.NOME === "Não deve ser gravada")).toBe(false);
  });
});
