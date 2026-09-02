# Sas Navegantes — Frontend de Cadastros

Primeira tela do SaaS (Seção 46 do prompt mestre): React + TypeScript + Vite + Tailwind, consumindo a API REST de Cadastros do backend.

## Como rodar

```bash
# 1. Backend (em outra aba)
cd ../backend
npm install
npm run seed
npm run dev        # API em http://localhost:3333

# 2. Frontend
cd frontend
npm install
cp .env.example .env   # ajuste VITE_API_URL se a API não estiver em localhost:3333
npm run dev             # tela em http://localhost:5173
```

## Como funciona

A tela **não tem os campos de cada cadastro hardcoded**. Ela busca o catálogo em `GET /api/cadastros/_catalogo` — que já vem com as colunas, tipos, obrigatoriedade, domínios (enum) e chaves estrangeiras de cada uma das 14 abas de `01_CADASTROS.xlsx` — e monta a interface a partir disso. Isso significa que qualquer coluna nova adicionada no schema do backend (`src/schema/files.ts`) aparece automaticamente na tela, sem precisar tocar no frontend.

- **`src/context/CatalogContext.tsx`** — carrega o catálogo uma vez, com cache simples para as listas usadas em dropdowns de chave estrangeira (ex.: selecionar a Unidade de uma Sala).
- **`src/components/Sidebar.tsx`** — navegação entre os 14 recursos.
- **`src/components/DataTable.tsx`** — tabela genérica; resolve IDs de FK para o nome amigável do registro referenciado (via `NOME`), mostra status Ativo/Inativo.
- **`src/components/RecordFormModal.tsx`** — formulário genérico (texto, número, data, booleano, enum, FK como `<select>`), mostra os erros de validação (`400`) e de regra de negócio (`422`, FK inválida/inativa) devolvidos pela API, campo a campo.
- **`src/components/ConfirmDialog.tsx`** — confirmação antes de inativar um registro (a API sempre faz exclusão lógica, nunca apaga a linha).
- **`src/hooks/useUsuario.ts`** — nome do "usuário atual" guardado no navegador e enviado no header `x-usuario`, só para a auditoria do backend saber quem fez o quê. **Não é autenticação** — isso é Fase 2. Fica um campo editável no topo da tela por enquanto.

## Testado

Fluxo completo validado com um teste automatizado de navegador (Playwright, headless) contra o backend real: carregar catálogo → criar Unidade → criar Sala vinculada a essa Unidade (dropdown de FK) → ver o nome da Unidade resolvido na tabela → inativar a Sala → conferir que ela some da lista de ativos e aparece com "mostrar inativos". Sem erros de console.

## O que ainda falta

- Autenticação real (Fase 2) — o campo "Usuário" no topo é só um placeholder.
- Paginação/busca na tabela — hoje lista tudo de uma vez (aceitável no volume atual, mas `Alunos` pode crescer).
- Telas dos outros módulos (Financeiro, Comercial, Planejamento, Orçamento) — só Cadastros está pronto.
