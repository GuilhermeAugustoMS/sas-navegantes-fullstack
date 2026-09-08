# Sas Navegantes — Excel Storage (Fase 1)

Camada de armazenamento do SaaS, implementada conforme as Seções 36–50 e 66 do prompt mestre do projeto. É a única parte do sistema autorizada a abrir arquivos `.xlsx` diretamente (`ExcelRepository` — Seção 48).

## Comandos

```bash
npm install
npm run seed   # cria os 7 arquivos .xlsx em data/, com todas as abas e cabeçalhos
npm test       # roda a suíte de testes (CRUD, IDs, lock, backup/restore, falha de gravação, API)
npm run build  # compila para dist/
npm run dev    # sobe a API REST em http://localhost:3333 (recarrega ao salvar)
npm start      # sobe a API a partir de dist/ (após npm run build)
```

## O que já está pronto

- **`src/schema/files.ts`** — definição das abas e colunas dos 7 arquivos (`01_CADASTROS.xlsx` … `07_AUDITORIA.xlsx`), seguindo literalmente as Seções 8–15 do prompt mestre.
- **`src/excel/ExcelRepository.ts`** — `insert`, `update`, `softDelete` (exclusão lógica, nunca física — Seção 62), `readAll`, `query`, `findById`, `restoreLatestBackup`. Todo `insert`/`update` passa por: lock do arquivo → backup automático → validação de tipos/obrigatoriedade → escrita em arquivo temporário → reabertura para validar integridade → substituição atômica (`rename`) → linha em auditoria.
- **`src/util/ids.ts`** — geração de IDs estáveis (`ALU_000001`, `RES_000001`...), nunca reaproveitados, conforme Seção 9.
- **`src/excel/lock.ts`** — trava por arquivo via `proper-lockfile`, evitando escrita concorrente (Seção 36).
- **`src/excel/backup.ts`** — backup antes de cada escrita, em `data/BACKUPS/AAAA-MM-DD/HH-mm-ss/`, com listagem e restauração (Seção 38/39).
- **`src/excel/audit.ts`** — toda criação/alteração grava uma linha em `07_AUDITORIA.xlsx / LogsAlteracoes` com usuário, data, hora, ação, arquivo, aba, ID, campo, valor anterior e valor novo (Seção 44).
## API REST de Cadastros (Controller → Service → Business Rules → ExcelRepository — Seção 47)

Uma API fina em Express, cobrindo as abas de `01_CADASTROS.xlsx`. Nada de regra de negócio no Controller — ele só traduz HTTP; quem valida integridade referencial (ex.: `Aluno.ID_SERIE` precisa existir e estar ativo em `Series`) é o `CadastrosService`, antes de chamar o `ExcelRepository`.

- **`src/api/resources.ts`** — catálogo de recursos (slug da rota → aba do Excel → chaves estrangeiras a validar).
- **`src/services/CadastrosService.ts`** — regra de negócio: toda FK informada precisa apontar para um registro existente e ativo (senão, `422 REGRA_DE_NEGOCIO`).
- **`src/api/controllers/cadastrosController.ts`** + **`src/api/routes/cadastros.routes.ts`** — CRUD genérico por recurso.
- **`src/api/middleware/requestContext.ts`** — usuário vem do header `x-usuario` (placeholder até a Fase 2 de autenticação existir; hoje é só para a auditoria saber quem fez o quê).
- **`src/api/middleware/errorHandler.ts`** — `400` erro de validação de campo, `422` regra de negócio (FK), `404` não encontrado, `500` erro interno.

### Rotas (uma por recurso, em `/api/cadastros/<slug>`)

`anos-letivos`, `series`, `turnos`, `modalidades`, `salas`, `turmas`, `cargos`, `equipes`, `funcionarios`, `centros-custo`, `responsaveis`, `alunos`, `vinculos-responsavel`

Cada um expõe `GET /` (lista, aceita `?ativo=true` e filtros por campo), `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (exclusão lógica). `GET /api/cadastros/_catalogo` lista os recursos disponíveis, para a tela de Cadastros não precisar hardcodar rotas.

Exemplo:
```bash
curl -X POST http://localhost:3333/api/cadastros/anos-letivos \
  -H "Content-Type: application/json" -H "x-usuario: guilherme" \
  -d '{"ANO":2026,"ATIVO":true}'
```

## Testes (`tests/`)

23 casos: CRUD e estabilidade de ID no `ExcelRepository`, exclusão lógica, trilha de auditoria, backup automático, restauração, simulação de falha na etapa final de gravação (o `rename` atômico — confirma que o arquivo original nunca é corrompido, Seções 58/59), e a API REST ponta a ponta (criação com FK válida/inválida, 400/404/422, exclusão lógica refletindo na listagem, auditoria registrando o usuário do header).

## O que ainda falta (fora do escopo desta etapa)

- Multi-tenant (Seção 41): a arquitetura já suporta trocar `SAS_DATA_ROOT` por tenant, mas o roteamento por tenant/usuário autenticado ainda não existe — isso é Fase 2.
- Autenticação de verdade (Fase 2): o header `x-usuario` é só um placeholder para a auditoria; não é controle de acesso.
- Importação dos dados reais das duas planilhas legadas (Fase 9) — depende das respostas às dúvidas do Mapa Funcional (IDs de aluno/responsável, `Fontes de Receitas`, `Controle-Negociação`), que ficaram em aberto e não foram resolvidas nesta etapa por decisão do usuário.
- Tela (frontend React) de Cadastros ainda não construída — a API já está pronta para ser consumida por ela.
