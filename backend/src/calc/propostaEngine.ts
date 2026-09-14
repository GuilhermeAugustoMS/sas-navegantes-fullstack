/**
 * Motor de Cálculo (CalculationEngine, Seção 17) para o Gerador de Proposta
 * (Seção 22). Função pura, sem I/O — recebe os dados já resolvidos (preço da
 * série, forma de pagamento, extras contratados) e devolve o cronograma de
 * parcelas. O backend calcula; o Excel só armazena o resultado (Seção 16).
 *
 * Regras implementadas (confirmadas com o usuário antes de codar, Regra 52):
 * - Uma parcela por mês do ano letivo, de MES_ENTRADA até dezembro (não
 *   sempre 12 parcelas: quem entra em março paga de março a dezembro).
 * - Mês de entrada é rateado por DIAS CORRIDOS do mês (não dias letivos —
 *   simplificação explicitamente escolhida pelo usuário na ausência de um
 *   calendário letivo dia-a-dia no sistema). Meses seguintes são cobrados
 *   integrais.
 * - O multiplicador de ajuste da forma de pagamento (FormasPagamento.
 *   MULTIPLICADOR_AJUSTE) se aplica sobre cada componente, em todo mês.
 * - Alimentação só entra se NECESSIDADE_ALIMENTACAO for true.
 * - Integral/Semi-Integral/Estendido só entram se contratados, usando o
 *   VALOR_MES do ProgramasExtras correspondente.
 * - Desconto percentual (opcional) incide só sobre a Mensalidade, igualmente
 *   em todas as parcelas (regra confirmada com o usuário ao adicionar o
 *   wizard "Fazer Proposta").
 *
 * Entrada (Regra confirmada com o usuário em 2026-09-11, ao adicionar o
 * layout parecido com o Excel real da escola): é uma cobrança à parte,
 * somada às mensalidades (não substitui a do mês de entrada), sempre no
 * valor cheio de TabelaPrecos.ENTRADA -- não sofre a proração por dia/mês
 * que a mensalidade do mês de entrada sofre, nem o multiplicador da Forma
 * de Pagamento. Só o desconto próprio dela (percentualDescontoEntrada,
 * independente do percentualDesconto da mensalidade) altera o valor.
 * Calculada por `calcularEntrada`, uma função separada de `gerarParcelas`
 * (que continua só sobre as mensalidades, sem nenhuma alteração) -- quem
 * monta o cronograma completo combinando as duas é a rota
 * (propostaGenerator.routes.ts).
 */

export interface PrecoSerie {
  MENSALIDADE: number;
  MATERIAL_DIDATICO: number;
  MATERIAL_DIDATICO_INGLES: number;
  ALIMENTACAO: number;
}

export interface ProgramaExtraValor {
  nome: "Integral" | "Semi-Integral" | "Estendido";
  valorMes: number;
}

export interface GerarParcelasInput {
  precoSerie: PrecoSerie;
  multiplicadorFormaPagamento: number;
  anoReferencia: number;
  mesEntrada: number; // 1-12
  diaEntrada: number; // 1-31
  necessidadeAlimentacao: boolean;
  extrasContratados: ProgramaExtraValor[]; // já filtrados para os que o aluno contratou
  percentualDesconto?: number; // 0-100, incide só sobre a Mensalidade; default 0
}

export interface ParcelaCalculada {
  numeroParcela: number;
  mesReferencia: number;
  anoReferencia: number;
  valorMensalidade: number;
  valorMaterialDidatico: number;
  valorMaterialDidaticoIngles: number;
  valorAlimentacao: number;
  valorIntegral: number;
  valorSemiIntegral: number;
  valorEstendido: number;
  valorTotal: number;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Fração do mês a cobrar: 1 (integral) fora do mês de entrada; proporcional aos dias corridos restantes no mês de entrada. */
function fracaoDoMes(mes: number, mesEntrada: number, diaEntrada: number, ano: number): number {
  if (mes !== mesEntrada) return 1;
  const total = diasNoMes(ano, mes);
  const restantes = total - diaEntrada + 1;
  return Math.max(0, Math.min(1, restantes / total));
}

export function gerarParcelas(input: GerarParcelasInput): ParcelaCalculada[] {
  const {
    precoSerie,
    multiplicadorFormaPagamento: mult,
    anoReferencia: ano,
    mesEntrada,
    diaEntrada,
    necessidadeAlimentacao,
    extrasContratados,
    percentualDesconto,
  } = input;

  if (mesEntrada < 1 || mesEntrada > 12) {
    throw new Error(`Mês de entrada inválido: ${mesEntrada} (esperado 1-12)`);
  }

  const fatorDesconto = 1 - (percentualDesconto ?? 0) / 100;

  const extraPor = (nome: ProgramaExtraValor["nome"]) => extrasContratados.find((e) => e.nome === nome)?.valorMes ?? 0;
  const integralMes = extraPor("Integral");
  const semiIntegralMes = extraPor("Semi-Integral");
  const estendidoMes = extraPor("Estendido");

  const parcelas: ParcelaCalculada[] = [];
  let numero = 1;
  for (let mes = mesEntrada; mes <= 12; mes++) {
    const fracao = fracaoDoMes(mes, mesEntrada, diaEntrada, ano);

    const mensalidade = round2(precoSerie.MENSALIDADE * fracao * mult * fatorDesconto);
    const material = round2(precoSerie.MATERIAL_DIDATICO * fracao * mult);
    const materialIngles = round2(precoSerie.MATERIAL_DIDATICO_INGLES * fracao * mult);
    const alimentacao = necessidadeAlimentacao ? round2(precoSerie.ALIMENTACAO * fracao * mult) : 0;
    const integral = round2(integralMes * fracao * mult);
    const semiIntegral = round2(semiIntegralMes * fracao * mult);
    const estendido = round2(estendidoMes * fracao * mult);

    const total = round2(mensalidade + material + materialIngles + alimentacao + integral + semiIntegral + estendido);

    parcelas.push({
      numeroParcela: numero++,
      mesReferencia: mes,
      anoReferencia: ano,
      valorMensalidade: mensalidade,
      valorMaterialDidatico: material,
      valorMaterialDidaticoIngles: materialIngles,
      valorAlimentacao: alimentacao,
      valorIntegral: integral,
      valorSemiIntegral: semiIntegral,
      valorEstendido: estendido,
      valorTotal: total,
    });
  }

  return parcelas;
}

export interface EntradaCalculada {
  numeroParcela: 0;
  mesReferencia: number;
  anoReferencia: number;
  valorEntrada: number;
  valorTotal: number;
}

export interface CalcularEntradaInput {
  valorEntrada: number; // TabelaPrecos.ENTRADA da Série
  mesReferencia: number; // mês de entrada do aluno, só pra registro no cronograma -- não afeta o valor
  anoReferencia: number;
  percentualDescontoEntrada?: number; // 0-100, independente do percentualDesconto da mensalidade; default 0
}

/**
 * Calcula a linha de Entrada do cronograma (NUMERO_PARCELA=0). Função
 * separada de gerarParcelas de propósito: a Entrada não é prorateada por
 * dia/mês nem multiplicada pela Forma de Pagamento, só sofre o desconto
 * próprio dela -- ver comentário no topo do arquivo.
 */
export function calcularEntrada(input: CalcularEntradaInput): EntradaCalculada {
  const fatorDesconto = 1 - (input.percentualDescontoEntrada ?? 0) / 100;
  const valor = round2(input.valorEntrada * fatorDesconto);
  return {
    numeroParcela: 0,
    mesReferencia: input.mesReferencia,
    anoReferencia: input.anoReferencia,
    valorEntrada: valor,
    valorTotal: valor,
  };
}
