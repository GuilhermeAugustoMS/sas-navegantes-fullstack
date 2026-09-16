// Seção 57: a estrutura (schemas/tabelas) agora é criada pelas migrations do
// Prisma (`npx prisma migrate dev`), não por este script -- ver
// backend/prisma/schema.prisma. Mantido só para checar que a conexão com o
// Postgres configurado em DATABASE_URL está de pé.
import { ALL_FILES } from "./schema/files.js";
import { getPrismaClient } from "./repository/prismaClient.js";

async function main() {
  const prisma = getPrismaClient();
  await prisma.$connect();
  console.log(`Conectado ao Postgres. Rode "npx prisma migrate dev" (dentro de backend/) para aplicar o schema.`);
  console.log(`Módulos esperados: ${ALL_FILES.map((f) => f.fileName).join(", ")}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
