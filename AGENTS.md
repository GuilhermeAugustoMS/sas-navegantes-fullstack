# Sas Navegantes — SaaS de Gestão Escolar (Postgres + Prisma)

Este arquivo dá contexto de continuidade para qualquer sessão do Codex
que abrir esta pasta. Leia isto antes de mexer no código.

## O que é este projeto

SaaS de gestão orçamentária/financeira/comercial/operacional para escolas.
Até 2026-09-16, a persistência era só arquivos `.xlsx` (decisão original,
Seção 2 do prompt mestre); a Seção 57 do mesmo prompt mestre já previa essa
troca por um banco de verdade via uma camada de repositório, sem reescrever
a aplicação — feita em 2026-09-16, antes de começar qualquer fase de negócio
nova (Orçamento/Planejamento/Dashboards), pra não migrar duas vezes. Ver
"Persistência: Postgres via Prisma (desde 2026-09-16)" mais abaixo para os
detalhes técnicos e as decisões tomadas. O prompt mestre completo (regras de
negócio, estrutura de dados, fases do projeto) está guardado no Projeto "Sas
Navegantes" do Codex — se você tiver acesso a ele, leia antes de qualquer
mudança estrutural. Resumo das regras mais importantes:

- **Nunca inventar** valores, fórmulas, regras, campos, categorias, preços,
  percentuais etc. Se uma planilha ou pedido for ambíguo: parar, explicar a
  dúvida, perguntar ao usuário, aguardar confirmação antes de implementar.
- **Nunca alterar arquivos originais do usuário** sem cópia/confirmação.
- Mudanças estruturais importantes exigem aprovação explícita antes de
  implementar.
- Histórico financeiro é imutável: uma vez gerada uma Proposta (parcelas
  congeladas), não pode ser alterada — cria-se uma nova.
- Exclusão é sempre lógica (`ATIVO = false`), nunca física, nas abas
  cadastrais. Abas puramente transacionais (Negociações, Propostas, Itens de
  Proposta, Matrículas, Rematrículas, Follow-Ups, Parcelas de Proposta) não
  têm coluna `ATIVO` por design.

## Repositório remoto

`origin` = `https://github.com/GuilhermeAugustoMS/sas-navegantes-fullstack`
— este é o histórico real do projeto (conectado em 2026-09-07). Branch
principal: `main`.

## Rotina de sincronização (projeto trabalhado em 2 computadores)

Este projeto é trabalhado em mais de um computador do usuário, sincronizado via
git (`origin` = https://github.com/GuilhermeAugustoMS/sas-navegantes-fullstack,
privado). Para nunca perder trabalho nem trabalhar em cima de uma versão
desatualizada:

**Antes de começar a trabalhar em qualquer sessão** (Claude Code, Codex, ou o
próprio usuário no terminal):
1. Rodar `git status` — se houver alterações não commitadas de uma sessão
   anterior nesta mesma máquina, resolver isso primeiro (perguntar ao usuário
   antes de descartar qualquer coisa).
2. Rodar `git pull` (ou `git pull --ff-only origin main`) antes de editar
   qualquer arquivo. Se o pull não for fast-forward (há commits locais e
   remotos divergentes), parar e avisar o usuário em vez de resolver conflito
   sozinho sem confirmação.

**Antes de encerrar a sessão / trocar de computador:**
3. Commitar todo trabalho concluído (nunca deixar mudança importante só
   local, sem commit).
4. Rodar `git push` antes de fechar o editor/terminal nesta máquina.
5. Se o trabalho ficou pela metade (não dá pra commitar algo funcional),
   avisar isso claramente no fim da sessão (ex.: no resumo pro usuário) para
   que ele saiba que vai continuar dali na outra máquina, ou usar
   `git stash` só se o próprio usuário confirmar que quer isso.

**Regra geral**: nunca supor que o estado local está atualizado só porque
"a sessão anterior terminou bem" — sempre confirmar com `git status`/`git log`
no início. Isso evita o tipo de problema que já aconteceu neste projeto antes
(ver checkpoint `claude/checkpoint-fase1-comercial.md`, Atualização 4: troca de
máquina exigiu reinstalar dependências e resolver `node_modules` órfão).

## Arquitetura

```
Frontend (React + TS + Vite + Tailwind, porta 5173)
  -> Backend (Node + TS + Express REST, porta 3333)
      -> Repository (backend/src/repository/Repository.ts, interface única)
          -> PostgresRepository (produção/dev, via Prisma) -> Postgres
             (schemas: cadastros, financeiro, orcamento, comercial,
             planejamento, configuracoes, auditoria -- 1 por módulo,
             espelhando os antigos 7 arquivos .xlsx)
          -> ExcelRepository (legado, sem uso em produção -- mantido como
             base para uma futura exportação/importação Excel, Seção 35)
```

Padrão genérico de CRUD: cada módulo (Cadastros, Comercial, Financeiro) é
uma lista `ResourceDef[]` (`backend/src/api/*Resources.ts`), cada uma
apontando para um `FileDef`/aba (`backend/src/schema/files.ts` -- continua
sendo o vocabulário usado em toda a aplicação, mesmo agora que os dados
vivem no Postgres: "arquivo" = schema Postgres, "aba" = tabela). O
`crudRouter`/`CrudService` genéricos montam as rotas REST e validam FKs
(inclusive entre "arquivos"/schemas diferentes, via `ForeignKey.targetFile`)
-- essa validação continua 100% na aplicação, não existe FK real no banco
(ver "Persistência" abaixo). O catálogo (`/_catalogo` de cada módulo) expõe
o schema para o frontend se montar sozinho (tabela + formulário) sem
hardcode de tela por recurso.

Frontend: `MODULES` em `frontend/src/api/client.ts` lista os módulos;
`CatalogContext` agrega os catálogos; `Sidebar`/`CrudPage`/`DataTable`/
`RecordFormModal` são genéricos e funcionam para qualquer módulo novo que
seguir o mesmo padrão. Nada mudou no frontend com a troca de persistência --
os contratos REST são os mesmos.

## Persistência: Postgres via Prisma (desde 2026-09-16)

Decisões tomadas com o usuário para a troca de Excel para Postgres (Seção
57), documentadas aqui para não precisar reconfirmar em sessões futuras:

- **ORM**: Prisma. Schema único em `backend/prisma/schema.prisma`, um
  modelo Prisma por aba original, `@@schema("...")` marcando o módulo
  (multi-schema do Postgres). 4 modelos (`Configuracoes*`) têm prefixo no
  nome porque colidiam com tabelas ativas de outro módulo -- ver comentário
  no topo do arquivo.
- **IDs**: continuam strings com prefixo geradas pela aplicação
  (`ALU_000001` etc., `backend/src/util/ids.ts`) -- não serial/UUID nativo.
  Como isso não é mais serializado por lock de arquivo, uma colisão rara de
  concorrência é pega pela constraint de unicidade da PK do Postgres, e
  `PostgresRepository.insert` tenta de novo uma vez com novo ID.
- **Sem FK real no banco**: nenhum `@relation` no schema Prisma. A
  integridade referencial (inclusive checar que o alvo está `ATIVO`)
  continua 100% em `CrudService.checkForeignKeys`, inalterado -- uma FK real
  do Postgres não expressaria essa regra.
- **Enums viram TEXT**, não enum nativo do Postgres -- mais fácil de
  estender a lista de valores permitidos no futuro.
- **Valores numéricos** (`type: "number"` no schema) viram
  `Decimal @db.Decimal(12,2)` no Postgres -- mais seguro que float para
  dinheiro. `PostgresRepository`/`repository/mapping.ts` sempre convertem
  para `number` puro antes de devolver pro resto da aplicação (nunca vaza
  `Decimal` do Prisma pra fora da camada de repositório).
- **`excel/lock.ts` e `excel/backup.ts` foram removidos** (Postgres trata
  concorrência via transação; backup é responsabilidade do provedor
  gerenciado escolhido na hora do deploy). `ExcelRepository` foi simplificado
  de acordo (sem lock/backup automático), mas continua funcional para
  ler/escrever `.xlsx` -- só não é mais chamado por nenhuma rota real.
  `recovery.test.ts` foi removido (testava exatamente essas duas
  funcionalidades removidas).
- **Sem alternância em runtime** entre Excel e Postgres (corte definitivo) --
  `AppDeps.repo` aceita qualquer `Repository`, usado pelos testes pra
  injetar um `PostgresRepository` apontando pra um banco efêmero, mas
  `createApp()` sem argumento sempre usa Postgres.
- **Testes automatizados usam um Postgres local via Docker** (`docker
  compose up -d` na raiz do projeto) -- **não** o banco de dados reais. Cada
  arquivo de teste de API cria seu próprio banco efêmero
  (`tests/setup/testDatabase.ts`, equivalente ao antigo `fs.mkdtempSync` do
  Excel) via `prisma db push`, e derruba no `afterAll`. `repository.test.ts`
  continua testando `ExcelRepository` diretamente (não precisa de Postgres)
  -- é o único teste que ainda usa Excel de propósito.
- **Dados reais migrados para Neon (Postgres gerenciado) em 2026-09-16** --
  o projeto é trabalhado em 2 computadores (ver "Rotina de sincronização"
  acima) e um Postgres só local não sincronizaria os dados reais entre eles.
  `backend/.env` (não versionado) tem a `DATABASE_URL` apontando para o
  projeto Neon "Saas Navegantes", branch `production`, com pooler
  (`sslmode=require&channel_binding=require`) -- é esse banco que
  `npm run dev`/`npm run seed:precos`/`npm run migrate:postgres` usam por
  padrão, tanto em dev quanto em produção; não há mais um Postgres "local
  de dados reais". O Postgres do `docker-compose.yml` continua existindo,
  mas só para os bancos efêmeros da suíte de testes -- nunca para dados
  reais.

## Como rodar localmente

```
cd backend && npm install
npx prisma migrate deploy                      # aplica migrations pendentes no Neon (dados reais)
npm run dev                                     # http://localhost:3333
cd frontend && npm install && npm run dev       # http://localhost:5173
```

`backend/.env` (não versionado, pedir o valor a quem já tem -- não está no
git) tem a `DATABASE_URL` do Neon (projeto "Saas Navegantes", branch
`production`) -- o mesmo banco usado pelas duas máquinas onde o projeto é
trabalhado. Por isso, em dev/produção usar sempre `prisma migrate deploy`
(só aplica migrations pendentes) -- **nunca `prisma migrate dev`** contra
essa `DATABASE_URL` (gera/reseta migration a partir de drift, arriscado
num banco compartilhado com dados reais).

Se `npm install` do backend bloquear o script de instalação do `esbuild`:
`npm approve-scripts esbuild` e rode `npm install` de novo.

`npx tsc -p . --noEmit` deve ficar limpo no backend.

Testes do backend usam Postgres **local**, não o Neon: `docker compose up
-d` na raiz do projeto (sobe o Postgres local, porta 5432, só para os
bancos efêmeros de teste) e depois `cd backend && npx vitest run`.

Migração dos dados reais dos `.xlsx` (`backend/data/`) para o Postgres já
configurado em `DATABASE_URL` (idempotente, não apaga os `.xlsx`
originais -- roda contra o Neon por padrão agora): `cd backend && npm run
migrate:postgres`.

Seed de preços (idempotente, semeia Ano Letivo 2026 + Séries + Tabela de
Preços + Programas Extras a partir da planilha real do usuário "Excel
mensalidades Navegantes.xlsx", agora gravando no Neon): `cd backend &&
npm run seed:precos`. **Só rodar contra o banco de produção com confirmação
explícita do usuário.**

## O que já existe (módulos)

- **Cadastros** (`01_CADASTROS.xlsx`): Alunos, Responsáveis, Unidades, Anos
  Letivos, Séries, Turmas, Salas, Funcionários etc. — CRUD genérico completo.
- **Comercial** (`04_COMERCIAL.xlsx`): Leads, Negociações, Propostas, Itens
  de Proposta, Matrículas, Rematrículas, Follow-Ups, Parcelas de Proposta —
  CRUD genérico completo, com FKs cross-arquivo para Cadastros.
- **Financeiro** (`02_FINANCEIRO.xlsx`): Tipos de Receita/Despesa, Formas de
  Pagamento, Tabela de Preços, Programas Extras, Receitas, Despesas, Contas
  a Pagar/Receber, Movimentações — CRUD genérico completo.
- **Gerador de Proposta** (Seção 22 do prompt mestre): tela dedicada (não é
  CRUD genérico) em `frontend/src/pages/PropostaGeneratorPage.tsx`. Resolve
  Proposta → Negociação → Série → Tabela de Preços ativa, chama o motor de
  cálculo puro `backend/src/calc/propostaEngine.ts` (proração da mensalidade
  por dia corrido no mês de entrada, valor cheio nos meses seguintes,
  multiplicador por forma de pagamento), e persiste em `ParcelasProposta`
  via rota dedicada `backend/src/api/routes/propostaGenerator.routes.ts`
  (`POST /api/comercial/propostas/:id/parcelas`, com `?preview=true` para
  simular sem gravar). Uma vez geradas, as parcelas ficam congeladas — nova
  tentativa recebe 409.
- **Fazer Proposta** (`frontend/src/pages/FazerPropostaPage.tsx`): wizard de
  tela única (Aluno → Negociação → Proposta auto-criada → simulação/
  confirmação via `PropostaSimulacaoPanel`), pensado para reduzir o
  ziguezague entre as telas de CRUD separadas ao fechar uma proposta nova.
  Reaproveita `RecordFormModal` (com o novo prop `initialValues`, para
  pré-preencher `ID_ALUNO` ao abrir "+ Nova Negociação" a partir do wizard)
  em vez de rotas novas. Depois de confirmada, mostra um painel à esquerda
  com "Editar Aluno" / "Editar Negociação" / "Criar Nova Proposta" (nova
  versão a partir da mesma Negociação, preservando a Proposta anterior e
  suas parcelas congeladas intactas).
- **Sugestão de Série por idade** (`frontend/src/lib/serieSugerida.ts`, usado
  em `RecordFormModal.tsx`): no cadastro de Aluno, ao informar
  `DATA_NASCIMENTO`, o campo `ID_SERIE` (adicionado à aba `Alunos` em
  2026-09-07) é sugerido/filtrado automaticamente pela idade completada até
  31/03 do Ano Letivo ativo. Regra de corte (31/03) e tabela idade→nível
  (G1=1, Maternal 1=2, Maternal 2=3, 1º Período=4, 2º Período=5, 1º a 9º
  Ano=6 a 14, EM-1º a EM-3º Ano=15 a 17) foram **confirmadas explicitamente
  pelo usuário** — não alterar sem nova confirmação. Como cada nível tem 3
  Séries (A/B/C) na base real importada, o campo só auto-seleciona quando há
  exatamente 1 opção; com várias, apenas filtra o dropdown para as do nível
  certo. `ID_TURMA` continua sem uso real (aba `Turmas` está vazia — ver
  pendência abaixo).
- **Ainda não implementados**: Planejamento (Seção 26/27), Orçamento (Seção
  24), Dashboards (Seção 30-32), Auditoria com tela própria (hoje só grava
  em `07_AUDITORIA.xlsx`, sem UI), Autenticação real (Fase 2 — hoje
  "usuário" é só um campo de texto usado na auditoria, sem controle de
  acesso), Multi-tenant (Seção 41 — antes da Seção 57 a arquitetura suportava
  trocar `SAS_DATA_ROOT` por tenant; com Postgres, a estratégia equivalente
  ainda não foi decidida -- banco por tenant vs. schema por tenant vs. coluna
  de tenant -- e roteamento por tenant autenticado também não existe),
  Importação das planilhas legadas (Fase 9).

## Pendências conhecidas (na última atualização — 2026-09-16)

- **Corrigido em 2026-09-07**: o erro de tipos em `RecordFormModal.tsx`
  (`{ ...emptyRecordFor(...), ...initialValues }` podia carregar `undefined`)
  foi resolvido filtrando entradas `undefined` de `initialValues` antes do
  merge. `npx tsc -b` no frontend está limpo agora.
- Aba `Turmas` está vazia (0 registros) — os dados reais importados
  colapsaram Série+Turma num nome só (ex.: "1º Ano A"), então não há Turmas
  cadastradas com `CAPACIDADE_MAXIMA`. Isso ficou pendente de decisão do
  usuário (ver seção "Sugestão de Série por idade" acima) — se/quando
  Turmas reais forem cadastradas, revisar se `ID_TURMA` do Aluno também
  deveria ganhar sugestão automática pela Série calculada.
- Duas telas cobrem fluxos parecidos de proposta hoje: `FazerPropostaPage.tsx`
  (wizard de criação) e `PropostaGeneratorPage.tsx` (gerenciar proposta já
  existente). Ainda não há uma decisão registrada sobre unificar as duas.
- **Resolvido em 2026-09-16**: dados reais migrados para o Neon
  (`npx prisma migrate deploy` + `npm run migrate:postgres`, 502/502
  registros, 0 inválidos) -- ver "Persistência" acima. `seed:precos` já
  tinha rodado contra dados reais antes dessa migração (a `TabelaPrecos`
  já veio populada, 64 registros).
- `node_modules` pode ter problemas de instalação em pastas sincronizadas
  por rede/nuvem (OneDrive, unidades de rede) — se `npm run dev` falhar com
  erros de binário nativo (esbuild, etc.), rodar
  `rm -rf node_modules && npm install` direto no terminal local (evitar
  rodar `npm install`/build a partir de uma pasta montada por ponte
  remota/rede).
- Autenticação real, Multi-tenant, módulos Planejamento/Orçamento/
  Dashboards, importação das planilhas legadas — todos pendentes, sem
  código ainda. As tabelas Postgres de Orçamento/Planejamento/Configurações
  já existem (Seção 57 migrou o schema inteiro de uma vez), mas seguem sem
  nenhuma rota/ResourceDef montada -- só ficam prontas para quando essas
  fases forem implementadas.
- Colunas ambíguas de "Hora"/"Fração" do programa Estendido (planilha real
  do usuário) não foram semeadas — se forem necessárias, pedir confirmação
  explícita do usuário sobre o que significam antes de implementar
  qualquer interpretação.

## Regras de processo já aprendidas nesta jornada

- **Sempre checar se já existe um remoto conectado (`git remote -v`) antes
  de reconstruir histórico do zero a partir de backups locais.** Em
  2026-09-07, uma sessão reconstruiu um "commit inicial" a partir de zips
  de backup (achando que não havia remoto) — quando na verdade o histórico
  real de 8 commits já estava em
  `https://github.com/GuilhermeAugustoMS/sas-navegantes-fullstack`,
  incluindo uma solução já funcional (`FazerPropostaPage.tsx`) para um
  pedido que estava sendo reimplementado do zero. O trabalho local
  descartado ficou preservado na branch `backup-local-antes-do-github-2026-09-07`
  antes do `git reset --hard origin/main`, caso algum trecho valha a pena
  recuperar.
- **Sempre commitar no git** depois de qualquer mudança de código — já
  houve uma perda real de trabalho por depender só de uma sessão de nuvem
  efêmera sem persistência em git.
- Ao adicionar uma aba/coluna nova ao schema (`backend/src/schema/files.ts`),
  espelhe a mudança em `backend/prisma/schema.prisma` e rode
  `npx prisma migrate dev` -- desde a Seção 57 (2026-09-16), é isso que cria
  a tabela/coluna real no Postgres, não mais `ExcelRepository.ensureFile`
  (que hoje só serve pro Excel legado, sem uso em produção).
- Testes automatizados (`npx vitest run`) e `tsc --noEmit` devem ficar
  limpos antes de considerar qualquer mudança pronta. Idealmente, some um
  smoke test real de navegador (Playwright) para fluxos novos importantes —
  isso já pegou bugs reais que os testes unitários/integração não cobriam
  (formato de resposta camelCase vs. snake_case; proração de valores; um
  `<main>` HTML aninhado dentro de outro `<main>`).
