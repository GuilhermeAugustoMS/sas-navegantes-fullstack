# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipe interna da escola Navegantes, em três frentes confirmadas:

- **Secretaria/Cadastros** — cadastra e mantém alunos, responsáveis, unidades,
  anos letivos, séries, turmas, salas e funcionários.
- **Comercial** — conduz negociações, monta e fecha Propostas (simulação e
  confirmação de parcelas), fecha Matrículas/Rematrículas.
- **Financeiro** — mantém tabela de preços, formas de pagamento, programas
  extras, contas a pagar/receber e movimentações.

Uso 100% interno/back-office — não há portal para famílias/alunos.

## Product Purpose

Substituir o controle da escola Navegantes feito em planilhas Excel
separadas por um sistema único (SaaS de gestão escolar) que cobre
Cadastros, Comercial e Financeiro. Sucesso = cada proposta, negociação e
registro cadastral/financeiro vive num só lugar, com histórico confiável,
em vez de espalhado por arquivos `.xlsx` divergentes.

## Positioning

"Unifica todas as propostas (e os dados de alunos, negociações e
financeiro que as cercam) em um só lugar" — nas palavras do usuário. Uma
planilha Excel não consegue oferecer isso de forma confiável: cada
arquivo vive isolado, sem histórico travado e sem uma única fonte de
verdade entre quem cadastra, quem negocia e quem cobra.

## Operating Context

- Ferramenta interna de uma única escola (Navegantes) hoje — multi-tenant
  não é meta de negócio atual, é só uma possibilidade distante.
- Fluxo comercial típico: Secretaria cadastra o aluno → Comercial abre uma
  Negociação → gera uma Proposta → simula parcelas (motor de cálculo:
  proração por dia de entrada, descontos, material didático de inglês
  dividido em até 4 parcelas, forma de pagamento) → confirma (parcelas
  ficam congeladas, imutáveis) → Matrícula/Rematrícula.
- Projeto trabalhado em 2 computadores do usuário, sincronizados via Git
  (GitHub privado) e um banco Postgres gerenciado (Neon) compartilhado
  entre as máquinas.
- Sem autenticação real ainda — "usuário" é hoje um campo de texto livre
  usado só para auditoria (quem alterou o quê), sem controle de acesso.

## Capabilities and Constraints

- CRUD genérico orientado a catálogo (schema-driven) para todos os
  recursos de Cadastros/Comercial/Financeiro — telas de tabela/formulário
  se montam sozinhas a partir do schema, sem tela hardcoded por recurso.
- Fluxo dedicado "Fazer Proposta"/"Gerador de Proposta": resolve
  Proposta → Negociação → Série/Aluno, roda o motor de cálculo de
  parcelas, permite prévia (preview) antes de gravar.
- **Histórico financeiro imutável**: uma vez confirmada (parcelas
  geradas), uma Proposta nunca é editada — qualquer correção cria uma
  nova versão, preservando a antiga intacta.
- **Exclusão sempre lógica** (`ATIVO = false`) nas abas cadastrais; abas
  puramente transacionais (Negociações, Propostas, Itens de Proposta,
  Matrículas, Rematrículas, Follow-Ups, Parcelas de Proposta) não têm
  coluna `ATIVO` por design.
- Sugestão automática de Série por idade no cadastro de Aluno (corte
  31/03 do Ano Letivo ativo), regra confirmada e travada com o usuário.
- Dashboard hoje é básico (4 indicadores: alunos ativos, propostas
  criadas, matrículas no ano letivo, negociações em aberto) — gráficos,
  calendário acadêmico e quadro de avisos ainda não existem.
- **Ainda não implementado**: Planejamento, Orçamento, Dashboards
  completos, tela própria de Auditoria (hoje só grava em log, sem UI),
  autenticação/controle de acesso real, multi-tenant, importação das
  planilhas legadas.
- Regra geral de processo do projeto: nunca inventar valor, fórmula,
  regra de negócio, categoria ou percentual — parar e confirmar com o
  usuário antes de implementar qualquer coisa ambígua.

## Brand Commitments

- Nome do produto/marca: "Sas Navegantes" — identidade visual com logo do
  veleiro (`frontend/src/assets/logo-navegantes.webp`).
- Paleta de marca já estabelecida e em uso (`frontend/src/index.css`):
  `--color-brand-navy #12314c`, `--color-brand-blue #4f93c8`,
  `--color-brand-blue-dark #3f76a0`, `--color-brand-amber #f2a93c`. Âmbar
  é o acento de "selecionado/destaque" (item ativo da sidebar, toggle
  ligado); navy é o fundo da sidebar/identidade; azul é a ação primária.

## Evidence on Hand

- Dados reais da escola Navegantes já migrados e populando o banco
  (Postgres/Neon): alunos, responsáveis, séries, tabela de preços,
  propostas etc. — não fabricar dados de exemplo novos quando dados reais
  já existem e podem ser consultados.
- Nenhum depoimento, estudo de caso, menção de imprensa ou benchmark
  disponível — não inventar nenhum desses.

## Product Principles

- Nunca inventar valores/fórmulas/regras de negócio: parar e confirmar
  com o usuário diante de qualquer ambiguidade.
- Histórico financeiro é imutável — correção é sempre uma nova versão,
  nunca uma edição do que já foi congelado.
- Centralizar Cadastros/Comercial/Financeiro num único sistema de verdade
  é a razão de existir do produto — não é "mais uma tela", é o que
  substitui a dispersão em planilhas.
- Exclusão é sempre lógica nas abas cadastrais, nunca física.
- Ferramenta interna de uma escola só por enquanto — não projetar
  prematuramente para multi-tenant/múltiplos clientes.
