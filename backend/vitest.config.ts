import { defineConfig } from "vitest/config";

/**
 * Timeout padrão (5000ms) do vitest é curto demais pros testes de
 * integração deste projeto: eles gravam várias linhas em sequência via
 * Repository (Postgres real desde a Seção 57), e sob carga (suíte completa
 * rodando, Windows) isso passa de 5s por engano -- não é um bug de lógica
 * (já visto e corrigido pontualmente antes, ver commit b15e312;
 * generalizado aqui porque o Gerador de Proposta ganhou mais parcelas por
 * chamada com a Entrada e o parcelamento do Material de Inglês).
 *
 * hookTimeout mais alto porque createTestDatabase() (tests/setup/testDatabase.ts)
 * cria um banco Postgres efêmero por arquivo de teste e roda `prisma db push`
 * num subprocesso dentro de beforeAll -- mais lento que o antigo
 * fs.mkdtempSync, principalmente na primeira chamada de cada execução.
 *
 * fileParallelism: false (2026-09-16, achado ao validar a migração pra
 * Postgres): por padrão o vitest roda arquivos de teste em paralelo: cada
 * um dos 3 arquivos que usam createTestDatabase() dispara seu próprio
 * `npx prisma db push` em subprocesso ao mesmo tempo, e no Windows isso
 * competiu por CPU/IO a ponto de estourar o hookTimeout de 30s (visto na
 * prática: rodando em paralelo, 3 suítes falharam por timeout; rodando
 * sequencial, as mesmas 77 passaram em tempo total praticamente igual --
 * então desativar paralelismo não deixa a suíte mais lenta, só mais
 * confiável).
 */
export default defineConfig({
  test: {
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
