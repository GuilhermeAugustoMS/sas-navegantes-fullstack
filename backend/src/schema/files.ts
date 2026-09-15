import type { FileDef } from "../types/schema.js";

const AUDIT_COMMON = ["ATIVO"]; // toda entidade cadastral usa exclusão lógica (Seção 62)

export const CADASTROS: FileDef = {
  fileName: "01_CADASTROS.xlsx",
  sheets: [
    {
      name: "Alunos",
      idPrefix: "ALU",
      columns: [
        { name: "ID_ALUNO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "DATA_NASCIMENTO", type: "date", required: true },
        { name: "GENERO", type: "text" },
        { name: "ID_SERIE", type: "text" },
        { name: "ID_TURMA", type: "text" },
        { name: "ID_TURNO", type: "text" },
        { name: "NECESSIDADE_ALIMENTACAO", type: "boolean" },
        { name: "HORARIO_ESPECIAL", type: "text" },
        { name: "DATA_CADASTRO", type: "date", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Responsaveis",
      idPrefix: "RES",
      columns: [
        { name: "ID_RESPONSAVEL", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "CPF", type: "text" },
        // Continuam opcionais (regra confirmada com o usuário em 2026-09-15) --
        // mas quando preenchidos, precisam ter formato válido. Ver "Responsável
        // Financeiro obrigatório" no cadastro de Aluno (RecordFormModal.tsx).
        { name: "EMAIL", type: "text", format: "email" },
        { name: "TELEFONE", type: "text", format: "telefone" },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "ResponsaveisFinanceiros",
      // Tabela de relacionamento Aluno x Responsável (N:N) com o papel do responsável.
      idPrefix: "AR",
      columns: [
        { name: "ID_ALUNO_RESPONSAVEL", type: "text", required: true, isId: true },
        { name: "ID_ALUNO", type: "text", required: true },
        { name: "ID_RESPONSAVEL", type: "text", required: true },
        { name: "TIPO", type: "enum", enumValues: ["Legal", "Financeiro", "Legal e Financeiro"], required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "AnosLetivos",
      idPrefix: "ANL",
      columns: [
        { name: "ID_ANO_LETIVO", type: "text", required: true, isId: true },
        { name: "ANO", type: "number", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Series",
      idPrefix: "SER",
      columns: [
        { name: "ID_SERIE", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "NIVEL_ENSINO", type: "text" },
        { name: "ID_ANO_LETIVO", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Turmas",
      idPrefix: "TUR",
      columns: [
        { name: "ID_TURMA", type: "text", required: true, isId: true },
        { name: "ID_SERIE", type: "text", required: true },
        { name: "NOME", type: "text", required: true },
        { name: "ID_TURNO", type: "text" },
        { name: "ID_SALA", type: "text" },
        { name: "CAPACIDADE_MAXIMA", type: "number", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Salas",
      idPrefix: "SAL",
      columns: [
        { name: "ID_SALA", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "CAPACIDADE", type: "number", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Turnos",
      idPrefix: "TUN",
      columns: [
        { name: "ID_TURNO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Modalidades",
      idPrefix: "MOD",
      columns: [
        { name: "ID_MODALIDADE", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Funcionarios",
      idPrefix: "FUN",
      columns: [
        { name: "ID_FUNCIONARIO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ID_CARGO", type: "text", required: true },
        { name: "ID_EQUIPE", type: "text" },
        { name: "SALARIO_BRUTO", type: "number" },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Cargos",
      idPrefix: "CAR",
      columns: [
        { name: "ID_CARGO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Equipes",
      idPrefix: "EQP",
      columns: [
        { name: "ID_EQUIPE", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "CentrosCusto",
      idPrefix: "CC",
      columns: [
        { name: "ID_CENTRO_CUSTO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
  ],
};

export const FINANCEIRO: FileDef = {
  fileName: "02_FINANCEIRO.xlsx",
  sheets: [
    {
      name: "Receitas",
      idPrefix: "REC",
      columns: [
        { name: "ID_LANCAMENTO", type: "text", required: true, isId: true },
        { name: "ID_ALUNO", type: "text" },
        { name: "ID_RESPONSAVEL", type: "text" },
        { name: "TIPO", type: "text", required: true },
        { name: "CATEGORIA", type: "text" },
        { name: "COMPETENCIA", type: "text", required: true },
        { name: "VENCIMENTO", type: "date" },
        { name: "VALOR", type: "number", required: true },
        { name: "STATUS", type: "text", required: true },
        { name: "FORMA_PAGAMENTO", type: "text" },
        { name: "OBSERVACAO", type: "text" },
      ],
    },
    {
      name: "Despesas",
      idPrefix: "DES",
      columns: [
        { name: "ID_LANCAMENTO", type: "text", required: true, isId: true },
        { name: "ID_CENTRO_CUSTO", type: "text" },
        { name: "TIPO", type: "text", required: true },
        { name: "CATEGORIA", type: "text" },
        { name: "COMPETENCIA", type: "text", required: true },
        { name: "VENCIMENTO", type: "date" },
        { name: "VALOR", type: "number", required: true },
        { name: "STATUS", type: "text", required: true },
        { name: "FORMA_PAGAMENTO", type: "text" },
        { name: "OBSERVACAO", type: "text" },
      ],
    },
    {
      name: "ContasPagar",
      idPrefix: "CPG",
      columns: [
        { name: "ID_CONTA_PAGAR", type: "text", required: true, isId: true },
        { name: "ID_LANCAMENTO", type: "text", required: true },
        { name: "VENCIMENTO", type: "date", required: true },
        { name: "VALOR", type: "number", required: true },
        { name: "STATUS", type: "text", required: true },
      ],
    },
    {
      name: "ContasReceber",
      idPrefix: "CRB",
      columns: [
        { name: "ID_CONTA_RECEBER", type: "text", required: true, isId: true },
        { name: "ID_LANCAMENTO", type: "text", required: true },
        { name: "VENCIMENTO", type: "date", required: true },
        { name: "VALOR", type: "number", required: true },
        { name: "STATUS", type: "text", required: true },
      ],
    },
    {
      name: "FormasPagamento",
      idPrefix: "FPG",
      columns: [
        { name: "ID_FORMA_PAGAMENTO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "QTD_PARCELAS", type: "number" },
        { name: "MULTIPLICADOR_AJUSTE", type: "number" },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "TiposReceita",
      idPrefix: "TRE",
      columns: [
        { name: "ID_TIPO_RECEITA", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "TiposDespesa",
      idPrefix: "TDE",
      columns: [
        { name: "ID_TIPO_DESPESA", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Movimentacoes",
      idPrefix: "MOV",
      columns: [
        { name: "ID_MOVIMENTACAO", type: "text", required: true, isId: true },
        { name: "ID_LANCAMENTO", type: "text", required: true },
        { name: "DATA", type: "date", required: true },
        { name: "VALOR", type: "number", required: true },
        { name: "TIPO", type: "enum", enumValues: ["Entrada", "Saida"], required: true },
      ],
    },
    {
      // Preço-base por série (Seção 8 do Mapa Funcional: entidade "TabelaPreco"),
      // com vigência para nunca sobrescrever histórico de preço (Seção 54/23).
      name: "TabelaPrecos",
      idPrefix: "TPR",
      columns: [
        { name: "ID_TABELA_PRECO", type: "text", required: true, isId: true },
        { name: "ID_SERIE", type: "text", required: true },
        { name: "MENSALIDADE", type: "number", required: true },
        { name: "MATERIAL_DIDATICO", type: "number", required: true },
        { name: "MATERIAL_DIDATICO_INGLES", type: "number", required: true },
        { name: "ALIMENTACAO", type: "number", required: true },
        { name: "DATA_VIGENCIA", type: "date", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      // Seção 27 do prompt mestre: Integral/Semi-Integral/Estendido não variam por série,
      // são parâmetros únicos da escola, com valor por dia (cobrança avulsa) e por mês (contratação mensal).
      name: "ProgramasExtras",
      idPrefix: "PEX",
      columns: [
        { name: "ID_PROGRAMA_EXTRA", type: "text", required: true, isId: true },
        { name: "NOME", type: "enum", enumValues: ["Integral", "Semi-Integral", "Estendido"], required: true },
        { name: "VALOR_DIA", type: "number" },
        { name: "VALOR_MES", type: "number", required: true },
        { name: "DATA_VIGENCIA", type: "date", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
  ],
};

export const ORCAMENTO: FileDef = {
  fileName: "03_ORCAMENTO.xlsx",
  sheets: [
    {
      name: "Orcamentos",
      idPrefix: "ORC",
      columns: [
        { name: "ID_ORCAMENTO", type: "text", required: true, isId: true },
        { name: "ID_ANO_LETIVO", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "ItensOrcamento",
      idPrefix: "ITO",
      columns: [
        { name: "ID_ITEM_ORCAMENTO", type: "text", required: true, isId: true },
        { name: "ID_ORCAMENTO", type: "text", required: true },
        { name: "ID_CENTRO_CUSTO", type: "text" },
        { name: "CATEGORIA", type: "text", required: true },
        { name: "MES", type: "number", required: true },
        { name: "VALOR_ORCADO", type: "number", required: true },
      ],
    },
    {
      name: "Orcado",
      idPrefix: "ORD",
      columns: [
        { name: "ID_ORCADO", type: "text", required: true, isId: true },
        { name: "ID_ITEM_ORCAMENTO", type: "text", required: true },
        { name: "VALOR", type: "number", required: true },
      ],
    },
    {
      name: "Realizado",
      idPrefix: "REA",
      columns: [
        { name: "ID_REALIZADO", type: "text", required: true, isId: true },
        { name: "ID_ITEM_ORCAMENTO", type: "text", required: true },
        { name: "VALOR", type: "number", required: true },
      ],
    },
    {
      name: "Projecoes",
      idPrefix: "PRJ",
      columns: [
        { name: "ID_PROJECAO", type: "text", required: true, isId: true },
        { name: "ID_ANO_LETIVO", type: "text", required: true },
        { name: "DESCRICAO", type: "text" },
      ],
    },
    {
      name: "Cenarios",
      idPrefix: "CEN",
      columns: [
        { name: "ID_CENARIO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "TIPO", type: "enum", enumValues: ["Base", "Otimista", "Pessimista", "Personalizado"], required: true },
      ],
    },
    {
      name: "ItensCenario",
      idPrefix: "ITC",
      columns: [
        { name: "ID_ITEM_CENARIO", type: "text", required: true, isId: true },
        { name: "ID_CENARIO", type: "text", required: true },
        { name: "VARIAVEL", type: "text", required: true },
        { name: "VALOR", type: "number", required: true },
      ],
    },
  ],
};

export const COMERCIAL: FileDef = {
  fileName: "04_COMERCIAL.xlsx",
  sheets: [
    {
      name: "Leads",
      idPrefix: "LEA",
      columns: [
        { name: "ID_LEAD", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ID_ORIGEM", type: "text" },
        { name: "DATA_ENTRADA", type: "date", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Negociacoes",
      idPrefix: "NEG",
      columns: [
        { name: "ID_NEGOCIACAO", type: "text", required: true, isId: true },
        { name: "ID_LEAD", type: "text" },
        { name: "ID_ALUNO", type: "text" },
        { name: "ID_SERIE", type: "text", required: true },
        { name: "ID_STATUS_NEGOCIACAO", type: "text", required: true },
        { name: "ID_EQUIPE", type: "text" },
        { name: "DATA_ULTIMA_ATUALIZACAO", type: "date" },
      ],
    },
    {
      name: "Propostas",
      idPrefix: "PRO",
      columns: [
        { name: "ID_PROPOSTA", type: "text", required: true, isId: true },
        { name: "ID_NEGOCIACAO", type: "text", required: true },
        { name: "DATA_PROPOSTA", type: "date", required: true },
        { name: "STATUS", type: "enum", enumValues: ["Criada", "Aprovada", "Recusada", "Cancelada", "Aceita"], required: true },
        { name: "VALOR_TOTAL_MES", type: "number" },
        { name: "PERCENTUAL_DESCONTO", type: "number" },
        // Entrada (Seção 22-bis, confirmada com o usuário em 2026-09-13): parcela
        // sempre cobrada, valor = TabelaPrecos.MENSALIDADE da Série (sem rateio por
        // dia/mês, sem multiplicador de forma de pagamento), com desconto próprio
        // e independente do PERCENTUAL_DESCONTO da mensalidade -- validado 0-25%
        // (margem real usada pela escola), não 0-100% como o outro.
        { name: "PERCENTUAL_DESCONTO_ENTRADA", type: "number" },
        { name: "DATA_PAGAMENTO_ENTRADA", type: "date" },
        // M.D. de Inglês (confirmado com o usuário em 2026-09-13, evidência na
        // planilha "Requerimento 2026": formas de pagamento do M.D. de Inglês só
        // vão até "4 vezes"): quantidade de parcelas (1-4) escolhida para dividir
        // o valor fixo total de MATERIAL_DIDATICO_INGLES -- ver propostaEngine.ts.
        { name: "QUANTIDADE_PARCELAS_MATERIAL_INGLES", type: "number" },
      ],
    },
    {
      name: "ItensProposta",
      idPrefix: "ITP",
      columns: [
        { name: "ID_ITEM_PROPOSTA", type: "text", required: true, isId: true },
        { name: "ID_PROPOSTA", type: "text", required: true },
        { name: "DESCRICAO", type: "text", required: true },
        { name: "VALOR", type: "number", required: true },
        { name: "PERCENTUAL_DESCONTO", type: "number" },
      ],
    },
    {
      name: "Matriculas",
      idPrefix: "MAT",
      columns: [
        { name: "ID_MATRICULA", type: "text", required: true, isId: true },
        { name: "ID_ALUNO", type: "text", required: true },
        { name: "ID_PROPOSTA", type: "text" },
        { name: "ID_ANO_LETIVO", type: "text", required: true },
        { name: "DATA_MATRICULA", type: "date", required: true },
        { name: "STATUS", type: "text", required: true },
      ],
    },
    {
      name: "Rematriculas",
      idPrefix: "REM",
      columns: [
        { name: "ID_REMATRICULA", type: "text", required: true, isId: true },
        { name: "ID_ALUNO", type: "text", required: true },
        { name: "ID_ANO_LETIVO", type: "text", required: true },
        { name: "STATUS", type: "text", required: true },
      ],
    },
    {
      name: "FollowUps",
      idPrefix: "FUP",
      columns: [
        { name: "ID_FOLLOWUP", type: "text", required: true, isId: true },
        { name: "ID_NEGOCIACAO", type: "text", required: true },
        { name: "DATA", type: "date", required: true },
        { name: "OBSERVACAO", type: "text" },
      ],
    },
    {
      // Cronograma de parcelas gerado pelo CalculationEngine (Seção 17/22) para uma Proposta.
      // Congelado no momento da geração (Seção 22: "Se o preço da série mudar depois, a
      // proposta histórica NÃO pode ser alterada") — por isso não tem ATIVO/exclusão lógica,
      // igual às demais abas transacionais do Comercial.
      name: "ParcelasProposta",
      idPrefix: "PPR",
      columns: [
        { name: "ID_PARCELA_PROPOSTA", type: "text", required: true, isId: true },
        { name: "ID_PROPOSTA", type: "text", required: true },
        { name: "NUMERO_PARCELA", type: "number", required: true },
        { name: "MES_REFERENCIA", type: "number", required: true },
        { name: "ANO_REFERENCIA", type: "number", required: true },
        { name: "VALOR_MENSALIDADE", type: "number", required: true },
        { name: "VALOR_MATERIAL_DIDATICO", type: "number", required: true },
        { name: "VALOR_MATERIAL_DIDATICO_INGLES", type: "number", required: true },
        { name: "VALOR_ALIMENTACAO", type: "number", required: true },
        { name: "VALOR_INTEGRAL", type: "number", required: true },
        { name: "VALOR_SEMI_INTEGRAL", type: "number", required: true },
        { name: "VALOR_ESTENDIDO", type: "number", required: true },
        { name: "VALOR_TOTAL", type: "number", required: true },
      ],
    },
    {
      name: "Origens",
      idPrefix: "ORI",
      columns: [
        { name: "ID_ORIGEM", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "StatusNegociacao",
      idPrefix: "SNG",
      columns: [
        { name: "ID_STATUS_NEGOCIACAO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ORDEM_FUNIL", type: "number" },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
  ],
};

export const PLANEJAMENTO: FileDef = {
  fileName: "05_PLANEJAMENTO.xlsx",
  sheets: [
    {
      name: "ProjecaoAlunos",
      idPrefix: "PAL",
      columns: [
        { name: "ID_PROJECAO_ALUNOS", type: "text", required: true, isId: true },
        { name: "ID_SERIE", type: "text", required: true },
        { name: "ID_ANO_LETIVO", type: "text", required: true },
        { name: "ALUNOS_ATUAIS", type: "number" },
        { name: "ALUNOS_PROJETADOS", type: "number" },
      ],
    },
    {
      name: "Ensalamento",
      idPrefix: "ENS",
      columns: [
        { name: "ID_ENSALAMENTO", type: "text", required: true, isId: true },
        { name: "ID_TURMA", type: "text", required: true },
        { name: "ID_SALA", type: "text", required: true },
        { name: "ALUNOS", type: "number" },
        { name: "OCUPACAO_PERCENTUAL", type: "number" },
        { name: "STATUS", type: "enum", enumValues: ["Livre", "Disponível", "Atenção", "Lotada", "Necessita nova sala"] },
      ],
    },
    {
      name: "CapacidadeSalas",
      idPrefix: "CAP",
      columns: [
        { name: "ID_CAPACIDADE", type: "text", required: true, isId: true },
        { name: "ID_SALA", type: "text", required: true },
        { name: "CAPACIDADE_MAXIMA", type: "number", required: true },
        { name: "MARGEM_OCUPACAO", type: "number" },
      ],
    },
    {
      name: "NecessidadeSalas",
      idPrefix: "NSA",
      columns: [
        { name: "ID_NECESSIDADE", type: "text", required: true, isId: true },
        { name: "ID_SERIE", type: "text", required: true },
        { name: "SALAS_NECESSARIAS", type: "number", required: true },
      ],
    },
    {
      name: "PlanejamentoEquipe",
      idPrefix: "PEQ",
      columns: [
        { name: "ID_PLANEJAMENTO_EQUIPE", type: "text", required: true, isId: true },
        { name: "ID_TURMA", type: "text", required: true },
        { name: "ID_CARGO", type: "text", required: true },
        { name: "QUANTIDADE", type: "number", required: true },
      ],
    },
    {
      name: "HorasTrabalhadas",
      idPrefix: "HTR",
      columns: [
        { name: "ID_HORAS_TRABALHADAS", type: "text", required: true, isId: true },
        { name: "NIVEL_ENSINO", type: "text", required: true },
        { name: "HORAS_SEMANA", type: "number", required: true },
      ],
    },
    {
      name: "CustosPessoal",
      idPrefix: "CPS",
      columns: [
        { name: "ID_CUSTO_PESSOAL", type: "text", required: true, isId: true },
        { name: "ID_TURMA", type: "text", required: true },
        { name: "ID_CARGO", type: "text", required: true },
        { name: "VALOR", type: "number", required: true },
      ],
    },
  ],
};

export const CONFIGURACOES: FileDef = {
  fileName: "06_CONFIGURACOES.xlsx",
  sheets: [
    {
      name: "Parametros",
      idPrefix: "PAR",
      columns: [
        { name: "ID_PARAMETRO", type: "text", required: true, isId: true },
        { name: "CHAVE", type: "text", required: true },
        { name: "VALOR", type: "text", required: true },
        { name: "DESCRICAO", type: "text" },
      ],
    },
    {
      name: "Reajustes",
      idPrefix: "RJT",
      columns: [
        { name: "ID_REAJUSTE", type: "text", required: true, isId: true },
        { name: "ID_SERIE", type: "text" },
        { name: "ID_MODALIDADE", type: "text" },
        { name: "ID_TURNO", type: "text" },
        { name: "TIPO_COBRANCA", type: "text" },
        { name: "PERCENTUAL", type: "number" },
        { name: "VALOR", type: "number" },
        { name: "DATA_VIGENCIA", type: "date", required: true },
      ],
    },
    {
      name: "TiposReceita",
      idPrefix: "TRE",
      columns: [
        { name: "ID_TIPO_RECEITA", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "TiposDespesa",
      idPrefix: "TDE",
      columns: [
        { name: "ID_TIPO_DESPESA", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "FormasPagamento",
      idPrefix: "FPG",
      columns: [
        { name: "ID_FORMA_PAGAMENTO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Categorias",
      idPrefix: "CAT",
      columns: [
        { name: "ID_CATEGORIA", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "CentrosCusto",
      idPrefix: "CC",
      columns: [
        { name: "ID_CENTRO_CUSTO", type: "text", required: true, isId: true },
        { name: "NOME", type: "text", required: true },
        { name: "ATIVO", type: "boolean", required: true },
      ],
    },
    {
      name: "Status",
      idPrefix: "STA",
      columns: [
        { name: "ID_STATUS", type: "text", required: true, isId: true },
        { name: "CONTEXTO", type: "text", required: true },
        { name: "NOME", type: "text", required: true },
      ],
    },
    {
      name: "Permissoes",
      idPrefix: "PER",
      columns: [
        { name: "ID_PERMISSAO", type: "text", required: true, isId: true },
        { name: "PERFIL", type: "enum", enumValues: ["Administrador", "Diretor", "Financeiro", "Comercial", "Secretaria", "Gestor"], required: true },
        { name: "MODULO", type: "text", required: true },
        { name: "PODE_LER", type: "boolean" },
        { name: "PODE_EDITAR", type: "boolean" },
      ],
    },
    {
      name: "ConfiguracoesDashboard",
      idPrefix: "CFD",
      columns: [
        { name: "ID_CONFIG_DASHBOARD", type: "text", required: true, isId: true },
        { name: "CHAVE", type: "text", required: true },
        { name: "VALOR", type: "text", required: true },
      ],
    },
  ],
};

export const AUDITORIA: FileDef = {
  fileName: "07_AUDITORIA.xlsx",
  sheets: [
    {
      name: "LogsAlteracoes",
      idPrefix: "LOG",
      columns: [
        { name: "ID_LOG", type: "text", required: true, isId: true },
        { name: "DATA", type: "date", required: true },
        { name: "HORA", type: "text", required: true },
        { name: "USUARIO", type: "text", required: true },
        { name: "ACAO", type: "text", required: true },
        { name: "ARQUIVO", type: "text", required: true },
        { name: "ABA", type: "text", required: true },
        { name: "ID_REGISTRO", type: "text" },
        { name: "CAMPO", type: "text" },
        { name: "VALOR_ANTERIOR", type: "text" },
        { name: "VALOR_NOVO", type: "text" },
        { name: "MOTIVO", type: "text" },
      ],
    },
    {
      name: "LogsAcesso",
      idPrefix: "LAC",
      columns: [
        { name: "ID_LOG_ACESSO", type: "text", required: true, isId: true },
        { name: "DATA", type: "date", required: true },
        { name: "HORA", type: "text", required: true },
        { name: "USUARIO", type: "text", required: true },
        { name: "ACAO", type: "enum", enumValues: ["Login", "Logout", "Falha de login"], required: true },
      ],
    },
    {
      name: "LogsImportacao",
      idPrefix: "LIM",
      columns: [
        { name: "ID_LOG_IMPORTACAO", type: "text", required: true, isId: true },
        { name: "DATA", type: "date", required: true },
        { name: "USUARIO", type: "text", required: true },
        { name: "ARQUIVO_ORIGEM", type: "text", required: true },
        { name: "REGISTROS_IMPORTADOS", type: "number" },
        { name: "REGISTROS_COM_ERRO", type: "number" },
      ],
    },
    {
      name: "LogsExportacao",
      idPrefix: "LEX",
      columns: [
        { name: "ID_LOG_EXPORTACAO", type: "text", required: true, isId: true },
        { name: "DATA", type: "date", required: true },
        { name: "USUARIO", type: "text", required: true },
        { name: "FORMATO", type: "text", required: true },
      ],
    },
    {
      name: "LogsSistema",
      idPrefix: "LSI",
      columns: [
        { name: "ID_LOG_SISTEMA", type: "text", required: true, isId: true },
        { name: "DATA", type: "date", required: true },
        { name: "HORA", type: "text", required: true },
        { name: "NIVEL", type: "enum", enumValues: ["Info", "Aviso", "Erro"], required: true },
        { name: "MENSAGEM", type: "text", required: true },
      ],
    },
  ],
};

export const ALL_FILES: FileDef[] = [
  CADASTROS,
  FINANCEIRO,
  ORCAMENTO,
  COMERCIAL,
  PLANEJAMENTO,
  CONFIGURACOES,
  AUDITORIA,
];

export function findSheetDef(fileName: string, sheetName: string) {
  const file = ALL_FILES.find((f) => f.fileName === fileName);
  if (!file) return undefined;
  return file.sheets.find((s) => s.name === sheetName);
}
