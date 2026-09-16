import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../..");

const BASE_URL = process.env.DATABASE_URL ?? "postgresql://sas:sas_dev_local_only@localhost:5432/sas_navegantes";

function urlWithDatabase(dbName: string): string {
  const u = new URL(BASE_URL);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export interface TestDatabase {
  prisma: PrismaClient;
  close: () => Promise<void>;
}

/**
 * Cria um banco Postgres efêmero -- equivalente ao fs.mkdtempSync usado
 * antes da Seção 57 para isolar cada arquivo de teste com seu próprio
 * .xlsx temporário. Exige um Postgres rodando (ver docker-compose.yml na
 * raiz do projeto: `docker compose up -d`) com o usuário de DATABASE_URL
 * podendo criar/derrubar bancos -- o usuário "sas" do compose tem isso por
 * ser o bootstrap user do container.
 *
 * Aplica o schema do prisma/schema.prisma via `prisma db push` (sem
 * histórico de migration -- o banco é descartável, criado e derrubado só
 * para esta suíte).
 */
function clientFor(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const dbName = `sas_test_${Math.random().toString(36).slice(2, 10)}`;

  const admin = clientFor(BASE_URL);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await admin.$disconnect();

  const url = urlWithDatabase(dbName);
  // shell: true é necessário no Windows -- spawnSync/execFileSync chamando
  // um shim .cmd (npx.cmd) direto falha com EINVAL sem isso. Prisma 7 não
  // tem mais a flag --skip-generate em `db push`.
  //
  // PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: o Prisma 7 bloqueia `db push
  // --accept-data-loss` quando detecta que quem chamou é um agente de IA, a
  // menos que essa env var traga o texto exato do consentimento do usuário.
  // Consentimento dado explicitamente em 2026-09-16 (ver CLAUDE.md/AGENTS.md,
  // Seção "Persistência") -- o alvo é sempre um banco `sas_test_*` recém-criado
  // vazio, nunca o banco de dev/produção.
  execFileSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: url,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "Sim, autorizo (Recomendado)",
    },
    stdio: "pipe",
    shell: true,
  });

  const prisma = clientFor(url);

  return {
    prisma,
    close: async () => {
      await prisma.$disconnect();
      const adminClose = clientFor(BASE_URL);
      await adminClose.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await adminClose.$disconnect();
    },
  };
}
