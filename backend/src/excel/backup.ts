import fs from "node:fs";
import path from "node:path";
import { BACKUPS_ROOT } from "../config/paths.js";
import { ensureDir } from "./workbookIO.js";

/**
 * Backups automáticos (Seção 38): /BACKUPS/AAAA-MM-DD/HH-mm-ss/<arquivo>.
 * Chamado sempre antes de qualquer escrita (Seção 37).
 */
export async function backupFile(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "-");
  const dir = path.join(BACKUPS_ROOT, day, time);
  await ensureDir(dir);
  const dest = path.join(dir, path.basename(filePath));
  await fs.promises.copyFile(filePath, dest);
  return dest;
}

export async function restoreFile(backupPath: string, targetPath: string): Promise<void> {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup não encontrado: ${backupPath}`);
  }
  await fs.promises.copyFile(backupPath, targetPath);
}

export interface BackupEntry {
  day: string;
  time: string;
  fullPath: string;
}

export async function listBackups(fileName: string): Promise<BackupEntry[]> {
  if (!fs.existsSync(BACKUPS_ROOT)) return [];
  const entries: BackupEntry[] = [];
  const days = await fs.promises.readdir(BACKUPS_ROOT);
  for (const day of days) {
    const dayDir = path.join(BACKUPS_ROOT, day);
    if (!(await fs.promises.stat(dayDir)).isDirectory()) continue;
    const times = await fs.promises.readdir(dayDir);
    for (const time of times) {
      const candidate = path.join(dayDir, time, fileName);
      if (fs.existsSync(candidate)) {
        entries.push({ day, time, fullPath: candidate });
      }
    }
  }
  entries.sort((a, b) => (a.day + a.time > b.day + b.time ? -1 : 1));
  return entries;
}

export async function latestBackup(fileName: string): Promise<BackupEntry | null> {
  const all = await listBackups(fileName);
  return all[0] ?? null;
}
