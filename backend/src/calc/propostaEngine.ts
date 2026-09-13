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
 * - Entrada (confirmado com o usuário em 2026-09-13): sempre existe, é a
 *   parcela "1ª" (as demais mensalidades passam a ser 2ª em diante, igual ao
 *   layout real da escola -- ver "Requerimento 2026" do arquivo de
 *   referência). Vale o valor cheio de MENSALIDADE da Série, SEM rateio por
 *   dia/mês de entrada e SEM o multiplicador da forma de pagamento -- só com
 *   seu próprio desconto (percentualDescontoEntrada), independente do
 *   desconto da mensalidade. Não soma material didático, alimentação nem
 *   extras (ficam zerados nessa parcela, igual ao documento real).
 * - Material Didático de Inglês (confirmado com o usuário em 2026-09-13, com
 *   evidência da planilha "Requerimento 2026" -- lá as formas de pagamento do
 *   M.D. de Inglês só vão até "4 vezes", diferente da Mensalidade que vai até
 *   12x): ao contrário do Material Didático comum (que continua cobrado todo
 *   mês, com rateio, igual sempre foi), o M.D. de Inglês passa a ser um valor
 *   FIXO total (MATERIAL_DIDATICO_INGLES da Tabela de Preços) dividido em até
 *   4 parcelas IGUAIS (quantidadeParcelasMaterialIngles, escolhida pelo
 *   usuário, 1 a 4), sem rateio por dia e sem multiplicador de forma de
 *   pagamento -- e sem nenhum desconto (nem o da mensalidade, nem o da
 *   entrada). Começa a ser cobrado a partir da 2ª parcela (1ª mensalidade,
 *   nunca na Entrada) e some (fica R$0) depois de esgotadas as parcelas. Se o
 *   aluno tiver menos meses letivos restantes do que a quantidade escolhida,
 *   reduz automaticamente para o número de meses realmente disponíveis. A
 *   última parcela absorve a diferença de arredondamento, para a soma bater
 *   exatamente com o valor total da Tabela de Preços.
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
  percentualDescontoEntrada?: number; // 0-25, incide só sobre a parcela de Entrada; default 0
  quantidadeParcelasMaterialIngles?: number; // 1-4, quantas mensalidades recebem o M.D. de Inglês; default 4
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
    percentualDescontoEntrada,
    quantidadeParcelasMaterialIngles,
  } = input;

  if (mesEntrada < 1 || mesEntrada > 12) {
    throw new Error(`Mês de entrada inválido: ${mesEntrada} (esperado 1-12)`);
  }

  const fatorDesconto = 1 - (percentualDesconto ?? 0) / 100;
  const fatorDescontoEntrada = 1 - (percentualDescontoEntrada ?? 0) / 100;

  // M.D. de Inglês: valor fixo total dividido em até 4 parcelas iguais,
  // nunca mais que os meses letivos realmente disponíveis (mesEntrada..dez).
  const mesesDisponiveis = 12 - mesEntrada + 1;
  const qtdParcelasMaterialIngles = Math.min(
    Math.max(1, Math.min(4, Math.round(quantidadeParcelasMaterialIngles ?? 4))),
    mesesDisponiveis,
  );
  const valorParcelaMaterialInglesBase = round2(precoSerie.MATERIAL_DIDATICO_INGLES / qtdParcelasMaterialIngles);
  const valorUltimaParcelaMaterialIngles = round2(
    precoSerie.MATERIAL_DIDATICO_INGLES - valorParcelaMaterialInglesBase * (qtdParcelasMaterialIngles - 1),
  );

  const extraPor = (nome: ProgramaExtraValor["nome"]) => extrasContratados.find((e) => e.nome === nome)?.valorMes ?? 0;
  const integralMes = extraPor("Integral");
  const semiIntegralMes = extraPor("Semi-Integral");
  const estendidoMes = extraPor("Estendido");

  const parcelas: ParcelaCalculada[] = [];

  const valorEntrada = round2(precoSerie.MENSALIDADE * fatorDescontoEntrada);
  parcelas.push({
    numeroParcela: 1,
    mesReferencia: mesEntrada,
    anoReferencia: ano,
    valorMensalidade: valorEntrada,
    valorMaterialDidatico: 0,
    valorMaterialDidaticoIngles: 0,
    valorAlimentacao: 0,
    valorIntegral: 0,
    valorSemiIntegral: 0,
    valorEstendido: 0,
    valorTotal: valorEntrada,
  });

  let numero = 2;
  let indiceMes = 0;
  for (let mes = mesEntrada; mes <= 12; mes++) {
    const fracao = fracaoDoMes(mes, mesEntrada, diaEntrada, ano);

    const mensalidade = round2(precoSerie.MENSALIDADE * fracao * mult * fatorDesconto);
    const material = round2(precoSerie.MATERIAL_DIDATICO * fracao * mult);
    const materialIngles =
      indiceMes >= qtdParcelasMaterialIngles
        ? 0
        : indiceMes === qtdParcelasMaterialIngles - 1
          ? valorUltimaParcelaMaterialIngles
          : valorParcelaMaterialInglesBase;
    indiceMes++;
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
