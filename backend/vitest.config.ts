import { defineConfig } from "vitest/config";

/**
 * Timeout padrão (5000ms) do vitest é curto demais pros testes de
 * integração deste projeto: eles gravam várias linhas em sequência num
 * .xlsx real via ExcelRepository (lock de arquivo + backup + escrita
 * atômica), e sob carga (suíte completa rodando, Windows) isso passa de 5s
 * por engano -- não é um bug de lógica (já visto e corrigido pontualmente
 * antes, ver commit b15e312; generalizado aqui porque o Gerador de
 * Proposta ganhou mais parcelas por chamada com a Entrada e o
 * parcelamento do Material de Inglês).
 */
export default defineConfig({
  test: {
    testTimeout: 15000,
  },
});
