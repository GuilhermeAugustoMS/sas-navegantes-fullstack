import { Router, type Request, type Response, type NextFunction } from "express";
import { ExcelRepository } from "../../excel/ExcelRepository.js";
import { CADASTROS, COMERCIAL, FINANCEIRO } from "../../schema/files.js";
import { gerarParcelas, calcularEntrada, type ProgramaExtraValor, type ParcelaCalculada, type EntradaCalculada } from "../../calc/propostaEngine.js";
import { BusinessRuleError } from "../../services/CrudService.js";

/**
 * Gerador de Proposta (Seção 22): rota dedicada (não é CRUD genérico) que
 * resolve o preço da série + forma de pagamento + extras contratados,
 * chama o CalculationEngine (src/calc/propostaEngine.ts) e persiste o
 * cronograma em ParcelasProposta. Uma vez geradas, as parcelas ficam
 * congeladas (Seção 22: "se o preço da série mudar depois, a proposta
 * histórica não pode ser alterada") -- gerar de novo para a mesma proposta
 * é recusado; o fluxo para simular outro cenário é criar uma nova Proposta.
 */
function paramId(req: Request): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

export function propostaGeneratorRouter(repo: ExcelRepository): Router {
  const router = Router();

  router.post("/propostas/:id/parcelas", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propostaId = paramId(req);
      const preview = req.query.preview === "true";
      const body = req.body ?? {};

      const proposta = await repo.findById(COMERCIAL, "Propostas", propostaId);
      if (!proposta) {
        res.status(404).json({ error: "NAO_ENCONTRADO", mensagem: `Proposta ${propostaId} não existe.` });
        return;
      }

      const jaTemParcelas = (await repo.query(COMERCIAL, "ParcelasProposta", (r) => r.ID_PROPOSTA === propostaId)).length > 0;
      if (jaTemParcelas && !preview) {
        res.status(409).json({
          error: "PARCELAS_JA_GERADAS",
          mensagem: "Esta proposta já tem parcelas geradas (congeladas). Para simular outro cenário, crie uma nova proposta.",
        });
        return;
      }

      const negociacao = await repo.findById(COMERCIAL, "Negociacoes", String(proposta.ID_NEGOCIACAO));
      if (!negociacao || !negociacao.ID_SERIE) {
        throw new BusinessRuleError([
          { field: "ID_NEGOCIACAO", problem: "Negociação vinculada não existe ou não tem Série definida." },
        ]);
      }
      const idSerie = String(negociacao.ID_SERIE);

      const errors: { field: string; problem: string }[] = [];

      const serie = await repo.findById(CADASTROS, "Series", idSerie);
      if (!serie) errors.push({ field: "ID_SERIE", problem: `Série ${idSerie} (da Negociação) não existe em Cadastros.` });

      const tabelaPrecos = (await repo.query(FINANCEIRO, "TabelaPrecos", (r) => r.ID_SERIE === idSerie && r.ATIVO === true))[0];
      if (!tabelaPrecos) errors.push({ field: "ID_SERIE", problem: `Não há Tabela de Preços ativa para a série ${idSerie}.` });
      else if (tabelaPrecos.ENTRADA === null || tabelaPrecos.ENTRADA === undefined) {
        errors.push({ field: "ENTRADA", problem: `A Tabela de Preços ativa para a série ${idSerie} não tem valor de Entrada configurado.` });
      }

      const idFormaPagamento = String(body.ID_FORMA_PAGAMENTO ?? "");
      const formaPagamento = idFormaPagamento
        ? await repo.findById(FINANCEIRO, "FormasPagamento", idFormaPagamento)
        : undefined;
      if (!idFormaPagamento) errors.push({ field: "ID_FORMA_PAGAMENTO", problem: "Obrigatório." });
      else if (!formaPagamento) errors.push({ field: "ID_FORMA_PAGAMENTO", problem: `Forma de pagamento ${idFormaPagamento} não existe.` });
      else if (formaPagamento.ATIVO === false) errors.push({ field: "ID_FORMA_PAGAMENTO", problem: "Forma de pagamento inativa." });

      const mesEntrada = Number(body.MES_ENTRADA);
      if (!Number.isInteger(mesEntrada) || mesEntrada < 1 || mesEntrada > 12) {
        errors.push({ field: "MES_ENTRADA", problem: "Deve ser um número inteiro de 1 a 12." });
      }
      const diaEntrada = Number(body.DIA_ENTRADA);
      if (!Number.isInteger(diaEntrada) || diaEntrada < 1 || diaEntrada > 31) {
        errors.push({ field: "DIA_ENTRADA", problem: "Deve ser um número inteiro de 1 a 31." });
      }

      const percentualDescontoRaw = body.PERCENTUAL_DESCONTO;
      const percentualDesconto =
        percentualDescontoRaw === undefined || percentualDescontoRaw === null || percentualDescontoRaw === ""
          ? 0
          : Number(percentualDescontoRaw);
      if (Number.isNaN(percentualDesconto) || percentualDesconto < 0 || percentualDesconto > 100) {
        errors.push({ field: "PERCENTUAL_DESCONTO", problem: "Deve ser um número de 0 a 100." });
      }

      const percentualDescontoEntradaRaw = body.PERCENTUAL_DESCONTO_ENTRADA;
      const percentualDescontoEntrada =
        percentualDescontoEntradaRaw === undefined || percentualDescontoEntradaRaw === null || percentualDescontoEntradaRaw === ""
          ? 0
          : Number(percentualDescontoEntradaRaw);
      if (Number.isNaN(percentualDescontoEntrada) || percentualDescontoEntrada < 0 || percentualDescontoEntrada > 100) {
        errors.push({ field: "PERCENTUAL_DESCONTO_ENTRADA", problem: "Deve ser um número de 0 a 100." });
      }

      let anoReferencia: number | undefined;
      if (serie) {
        const anoLetivo = await repo.findById(CADASTROS, "AnosLetivos", String(serie.ID_ANO_LETIVO));
        if (!anoLetivo) errors.push({ field: "ID_SERIE", problem: `Ano Letivo da série ${idSerie} não existe.` });
        else anoReferencia = Number(anoLetivo.ANO);
      }

      if (errors.length > 0) throw new BusinessRuleError(errors);

      const extrasContratados: ProgramaExtraValor[] = [];
      const mapaExtras: Array<[string, "Integral" | "Semi-Integral" | "Estendido"]> = [
        ["CONTRATOU_INTEGRAL", "Integral"],
        ["CONTRATOU_SEMI_INTEGRAL", "Semi-Integral"],
        ["CONTRATOU_ESTENDIDO", "Estendido"],
      ];
      for (const [campo, nome] of mapaExtras) {
        if (!body[campo]) continue;
        const programa = (await repo.query(FINANCEIRO, "ProgramasExtras", (r) => r.NOME === nome && r.ATIVO === true))[0];
        if (!programa) {
          throw new BusinessRuleError([{ field: campo, problem: `Não há Programa Extra "${nome}" ativo configurado.` }]);
        }
        extrasContratados.push({ nome, valorMes: Number(programa.VALOR_MES) });
      }

      const parcelasMensais = gerarParcelas({
        precoSerie: {
          MENSALIDADE: Number(tabelaPrecos!.MENSALIDADE),
          MATERIAL_DIDATICO: Number(tabelaPrecos!.MATERIAL_DIDATICO),
          MATERIAL_DIDATICO_INGLES: Number(tabelaPrecos!.MATERIAL_DIDATICO_INGLES),
          ALIMENTACAO: Number(tabelaPrecos!.ALIMENTACAO),
        },
        multiplicadorFormaPagamento: Number(formaPagamento!.MULTIPLICADOR_AJUSTE ?? 1),
        anoReferencia: anoReferencia!,
        mesEntrada,
        diaEntrada,
        necessidadeAlimentacao: Boolean(body.NECESSIDADE_ALIMENTACAO),
        extrasContratados,
        percentualDesconto,
      });

      const entrada = calcularEntrada({
        valorEntrada: Number(tabelaPrecos!.ENTRADA),
        mesReferencia: mesEntrada,
        anoReferencia: anoReferencia!,
        percentualDescontoEntrada,
      });

      // Cronograma completo (o que sai pro frontend e o que é persistido):
      // Entrada primeiro (NUMERO_PARCELA=0), depois as mensalidades, sem
      // alterar a ordem/numeração que gerarParcelas já produz.
      const cronograma = [entradaParaLinha(entrada), ...parcelasMensais.map(mensalParaLinha)];
      const valorTotalMes = parcelasMensais.at(-1)?.valorTotal ?? 0; // não inclui a Entrada -- é o custo mensal recorrente

      if (preview) {
        res.json({ parcelas: cronograma, valorTotalMes });
        return;
      }

      const persistidas = [];
      for (const linha of cronograma) {
        const rec = await repo.insert(
          COMERCIAL,
          "ParcelasProposta",
          {
            ID_PROPOSTA: propostaId,
            NUMERO_PARCELA: linha.numeroParcela,
            MES_REFERENCIA: linha.mesReferencia,
            ANO_REFERENCIA: linha.anoReferencia,
            VALOR_ENTRADA: linha.valorEntrada,
            VALOR_MENSALIDADE: linha.valorMensalidade,
            VALOR_MATERIAL_DIDATICO: linha.valorMaterialDidatico,
            VALOR_MATERIAL_DIDATICO_INGLES: linha.valorMaterialDidaticoIngles,
            VALOR_ALIMENTACAO: linha.valorAlimentacao,
            VALOR_INTEGRAL: linha.valorIntegral,
            VALOR_SEMI_INTEGRAL: linha.valorSemiIntegral,
            VALOR_ESTENDIDO: linha.valorEstendido,
            VALOR_TOTAL: linha.valorTotal,
          },
          { usuario: req.usuario },
        );
        persistidas.push(rec);
      }

      await repo.update(
        COMERCIAL,
        "Propostas",
        propostaId,
        { VALOR_TOTAL_MES: valorTotalMes, PERCENTUAL_DESCONTO: percentualDesconto, PERCENTUAL_DESCONTO_ENTRADA: percentualDescontoEntrada },
        { usuario: req.usuario, motivo: "Gerador de Proposta: parcelas calculadas" },
      );

      res.status(201).json({ parcelas: persistidas.map(toParcelaProposta), valorTotalMes });
    } catch (err) {
      next(err);
    }
  });

  router.get("/propostas/:id/parcelas", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await repo.query(COMERCIAL, "ParcelasProposta", (r) => r.ID_PROPOSTA === paramId(req));
      res.json(
        rows
          .sort((a: any, b: any) => a.NUMERO_PARCELA - b.NUMERO_PARCELA)
          .map(toParcelaProposta),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/**
 * Converte um registro cru do Excel (colunas MAIUSCULO_COM_UNDERSCORE, ver
 * schema/files.ts) para o formato camelCase que o frontend espera
 * (ParcelaProposta em frontend/src/api/types.ts). Sem isso, a resposta de
 * confirmação/listagem ficaria com um formato diferente da resposta de
 * preview (que já sai camelCase direto do propostaEngine.ts) -- foi
 * exatamente esse descompasso que quebrava a tela após "Confirmar Proposta".
 */
function toParcelaProposta(rec: Record<string, unknown>) {
  return {
    numeroParcela: Number(rec.NUMERO_PARCELA),
    mesReferencia: Number(rec.MES_REFERENCIA),
    anoReferencia: Number(rec.ANO_REFERENCIA),
    valorEntrada: Number(rec.VALOR_ENTRADA ?? 0),
    valorMensalidade: Number(rec.VALOR_MENSALIDADE),
    valorMaterialDidatico: Number(rec.VALOR_MATERIAL_DIDATICO),
    valorMaterialDidaticoIngles: Number(rec.VALOR_MATERIAL_DIDATICO_INGLES),
    valorAlimentacao: Number(rec.VALOR_ALIMENTACAO),
    valorIntegral: Number(rec.VALOR_INTEGRAL),
    valorSemiIntegral: Number(rec.VALOR_SEMI_INTEGRAL),
    valorEstendido: Number(rec.VALOR_ESTENDIDO),
    valorTotal: Number(rec.VALOR_TOTAL),
  };
}

/** Cronograma completo (Entrada + mensalidades) num formato único, o que
 * simplifica tanto a resposta JSON quanto o loop de persistência abaixo. */
interface LinhaCronograma {
  numeroParcela: number;
  mesReferencia: number;
  anoReferencia: number;
  valorEntrada: number;
  valorMensalidade: number;
  valorMaterialDidatico: number;
  valorMaterialDidaticoIngles: number;
  valorAlimentacao: number;
  valorIntegral: number;
  valorSemiIntegral: number;
  valorEstendido: number;
  valorTotal: number;
}

function entradaParaLinha(e: EntradaCalculada): LinhaCronograma {
  return {
    numeroParcela: e.numeroParcela,
    mesReferencia: e.mesReferencia,
    anoReferencia: e.anoReferencia,
    valorEntrada: e.valorEntrada,
    valorMensalidade: 0,
    valorMaterialDidatico: 0,
    valorMaterialDidaticoIngles: 0,
    valorAlimentacao: 0,
    valorIntegral: 0,
    valorSemiIntegral: 0,
    valorEstendido: 0,
    valorTotal: e.valorTotal,
  };
}

function mensalParaLinha(p: ParcelaCalculada): LinhaCronograma {
  return { ...p, valorEntrada: 0 };
}
