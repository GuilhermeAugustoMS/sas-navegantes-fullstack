-- Alunos.DATA_NASCIMENTO passa a ser opcional: alunos importados de
-- planilhas de CRM legadas (ex.: aba "Gestão-Negociação" do planejamento
-- orçamentário) não têm data de nascimento disponível. Decisão explícita
-- do usuário em 2026-11-02 -- ver backend/src/seedNegociacoes2025.ts.
ALTER TABLE "cadastros"."Alunos" ALTER COLUMN "DATA_NASCIMENTO" DROP NOT NULL;
