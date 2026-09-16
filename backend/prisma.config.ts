import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7: a URL de conexão usada pela CLI (migrate/db push/studio) vem
 * daqui, não mais de `datasource.url` em schema.prisma. Runtime (PrismaClient
 * na aplicação) usa o driver adapter em backend/src/repository/prismaClient.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
