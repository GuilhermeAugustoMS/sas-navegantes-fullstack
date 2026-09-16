-- Decisão confirmada com o usuário em 2026-09-16 (Seção 57): colunas enum do
-- schema original (backend/src/schema/files.ts, type: "enum") viram TEXT no
-- Postgres, reforçadas com CHECK constraint -- não enum nativo do Postgres
-- (mais fácil de estender a lista de valores permitidos no futuro).
-- A validação "de verdade" continua na aplicação (excel/validate.ts); isto é
-- só uma rede de segurança a nível de banco.

ALTER TABLE "cadastros"."ResponsaveisFinanceiros"
  ADD CONSTRAINT "ResponsaveisFinanceiros_TIPO_check"
  CHECK ("TIPO" IN ('Legal', 'Financeiro', 'Legal e Financeiro'));

ALTER TABLE "financeiro"."Movimentacoes"
  ADD CONSTRAINT "Movimentacoes_TIPO_check"
  CHECK ("TIPO" IN ('Entrada', 'Saida'));

ALTER TABLE "financeiro"."ProgramasExtras"
  ADD CONSTRAINT "ProgramasExtras_NOME_check"
  CHECK ("NOME" IN ('Integral', 'Semi-Integral', 'Estendido'));

ALTER TABLE "orcamento"."Cenarios"
  ADD CONSTRAINT "Cenarios_TIPO_check"
  CHECK ("TIPO" IN ('Base', 'Otimista', 'Pessimista', 'Personalizado'));

ALTER TABLE "comercial"."Propostas"
  ADD CONSTRAINT "Propostas_STATUS_check"
  CHECK ("STATUS" IN ('Criada', 'Aprovada', 'Recusada', 'Cancelada', 'Aceita'));

ALTER TABLE "planejamento"."Ensalamento"
  ADD CONSTRAINT "Ensalamento_STATUS_check"
  CHECK ("STATUS" IS NULL OR "STATUS" IN ('Livre', 'Disponível', 'Atenção', 'Lotada', 'Necessita nova sala'));

ALTER TABLE "configuracoes"."Permissoes"
  ADD CONSTRAINT "Permissoes_PERFIL_check"
  CHECK ("PERFIL" IN ('Administrador', 'Diretor', 'Financeiro', 'Comercial', 'Secretaria', 'Gestor'));

ALTER TABLE "auditoria"."LogsAcesso"
  ADD CONSTRAINT "LogsAcesso_ACAO_check"
  CHECK ("ACAO" IN ('Login', 'Logout', 'Falha de login'));

ALTER TABLE "auditoria"."LogsSistema"
  ADD CONSTRAINT "LogsSistema_NIVEL_check"
  CHECK ("NIVEL" IN ('Info', 'Aviso', 'Erro'));
