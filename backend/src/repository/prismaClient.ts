import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let client: PrismaClient | undefined;

/**
 * Cliente Prisma único do processo (produção/dev). Testes não usam isto --
 * cada arquivo de teste cria seu próprio PrismaClient apontando para um
 * banco Postgres efêmero (ver tests/setup/testDatabase.ts).
 *
 * Prisma 7 exige um driver adapter (Seção "no Rust engine") -- não é mais
 * possível passar só `datasources.db.url`.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter });
  }
  return client;
}
