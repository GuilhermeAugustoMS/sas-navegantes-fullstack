import { Router, type Request, type Response, type NextFunction } from "express";
import type { Repository } from "../../repository/Repository.js";
import { CADASTROS, COMERCIAL } from "../../schema/files.js";
import { BusinessRuleError } from "../../services/CrudService.js";

function paramId(req: Request): string {
  const v = req.params.idProposta;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Pendentes de Matrícula (módulo Planejamento, 2026-11-02): fecha o ciclo
 * entre "Proposta confirmada" (parcelas geradas via Gerador de Proposta/
 * Fazer Proposta) e "Matrícula registrada" -- hoje a Matrícula só existia
 * como CRUD manual, nunca disparado por nenhum fluxo (achado do
 * diagnóstico que levou à Gestão de Vagas). Rota dedicada, não é CRUD
 * genérico: GET lista o que falta confirmar, POST confirma.
 *
 * "Pendente" = Proposta com parcelas geradas (ParcelasProposta não vazia)
 * e cujo Aluno ainda não tem Matrícula/Rematrícula no Ano Letivo ativo --
 * calculado ao vivo, sem campo de status novo (decisão com o usuário:
 * não criar um passo extra de "aceitar" proposta).
 *
 * Confirmar decide Matrícula vs Rematrícula automaticamente (Aluno já tem
 * Matrícula/Rematrícula em QUALQUER ano anterior => Rematrícula, senão
 * Matrícula -- regra confirmada com o usuário), grava o registro
 * correspondente, define Aluno.ID_TURMA (pré-requisito pra Gestão de
 * Vagas contar o aluno) e atualiza Negociacao.ID_STATUS_NEGOCIACAO para
 * "Matriculado"/"Rematriculado" (valores que já existem em
 * StatusNegociacao, vindos da planilha real).
 */
export function pendentesMatriculaRouter(repo: Repository): Router {
  const router = Router();

  router.get("/pendentes-matricula", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const anoLetivoIdParam = typeof req.query.anoLetivo === "string" ? req.query.anoLetivo : undefined;
      const anosLetivos = await repo.readAll(CADASTROS, "AnosLetivos");
      const anoLetivo = anoLetivoIdParam
        ? anosLetivos.find((a) => a.ID_ANO_LETIVO === anoLetivoIdParam)
        : anosLetivos.find((a) => a.ATIVO === true);

      if (!anoLetivo) {
        res.status(404).json({ error: "NAO_ENCONTRADO", mensagem: "Nenhum Ano Letivo ativo encontrado." });
        return;
      }

      const [propostas, parcelas, negociacoes, alunos, series, matriculas, rematriculas] = await Promise.all([
        repo.readAll(COMERCIAL, "Propostas"),
        repo.readAll(COMERCIAL, "ParcelasProposta"),
        repo.readAll(COMERCIAL, "Negociacoes"),
        repo.readAll(CADASTROS, "Alunos"),
        repo.readAll(CADASTROS, "Series"),
        repo.query(COMERCIAL, "Matriculas", (r) => r.ID_ANO_LETIVO === anoLetivo!.ID_ANO_LETIVO),
        repo.query(COMERCIAL, "Rematriculas", (r) => r.ID_ANO_LETIVO === anoLetivo!.ID_ANO_LETIVO),
      ]);

      const propostaIdsComParcelas = new Set(parcelas.map((p) => String(p.ID_PROPOSTA)));
      const negociacaoPorId = new Map(negociacoes.map((n) => [String(n.ID_NEGOCIACAO), n]));
      const alunoPorId = new Map(alunos.map((a) => [String(a.ID_ALUNO), a]));
      const seriePorId = new Map(series.map((s) => [String(s.ID_SERIE), s]));
      const alunosComMatriculaOuRematriculaNoAno = new Set([
        ...matriculas.map((m) => String(m.ID_ALUNO)),
        ...rematriculas.map((r) => String(r.ID_ALUNO)),
      ]);

      const pendentes = propostas
        .filter((p) => propostaIdsComParcelas.has(String(p.ID_PROPOSTA)) && p.STATUS !== "Cancelada")
        .map((p) => {
          const negociacao = negociacaoPorId.get(String(p.ID_NEGOCIACAO));
          if (!negociacao) return null;
          const aluno = alunoPorId.get(String(negociacao.ID_ALUNO));
          if (!aluno) return null;
          if (alunosComMatriculaOuRematriculaNoAno.has(String(aluno.ID_ALUNO))) return null;

          const serie = seriePorId.get(String(negociacao.ID_SERIE));
          return {
            idProposta: String(p.ID_PROPOSTA),
            dataProposta: String(p.DATA_PROPOSTA),
            valorTotalMes: p.VALOR_TOTAL_MES != null ? Number(p.VALOR_TOTAL_MES) : null,
            idAluno: String(aluno.ID_ALUNO),
            nomeAluno: String(aluno.NOME),
            idNegociacao: String(negociacao.ID_NEGOCIACAO),
            idSerie: String(negociacao.ID_SERIE),
            nomeSerie: serie ? String(serie.NOME) : "(série não encontrada)",
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => a.dataProposta.localeCompare(b.dataProposta));

      res.json({ anoLetivo: { id: String(anoLetivo.ID_ANO_LETIVO), ano: Number(anoLetivo.ANO) }, pendentes });
    } catch (err) {
      next(err);
    }
  });

  router.post("/pendentes-matricula/:idProposta/confirmar", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idProposta = paramId(req);
      const idTurma = typeof req.body?.ID_TURMA === "string" ? req.body.ID_TURMA : undefined;
      if (!idTurma) {
        throw new BusinessRuleError([{ field: "ID_TURMA", problem: "Escolha uma Turma para confirmar a matrícula." }]);
      }

      const proposta = await repo.findById(COMERCIAL, "Propostas", idProposta);
      if (!proposta) {
        res.status(404).json({ error: "NAO_ENCONTRADO", mensagem: `Proposta ${idProposta} não existe.` });
        return;
      }

      const temParcelas = (await repo.query(COMERCIAL, "ParcelasProposta", (r) => r.ID_PROPOSTA === idProposta)).length > 0;
      if (!temParcelas) {
        throw new BusinessRuleError([
          { field: "ID_PROPOSTA", problem: "Esta Proposta ainda não teve as parcelas geradas (não está pendente de matrícula)." },
        ]);
      }

      const negociacao = await repo.findById(COMERCIAL, "Negociacoes", String(proposta.ID_NEGOCIACAO));
      if (!negociacao) {
        throw new BusinessRuleError([{ field: "ID_NEGOCIACAO", problem: "Negociação vinculada não existe." }]);
      }

      const turma = await repo.findById(CADASTROS, "Turmas", idTurma);
      if (!turma) {
        throw new BusinessRuleError([{ field: "ID_TURMA", problem: `Turma ${idTurma} não existe.` }]);
      }
      if (String(turma.ID_SERIE) !== String(negociacao.ID_SERIE)) {
        throw new BusinessRuleError([{ field: "ID_TURMA", problem: "Esta Turma não pertence à Série da Negociação." }]);
      }

      const anosLetivos = await repo.readAll(CADASTROS, "AnosLetivos");
      const anoLetivo = anosLetivos.find((a) => a.ATIVO === true);
      if (!anoLetivo) {
        throw new BusinessRuleError([{ field: "ID_ANO_LETIVO", problem: "Nenhum Ano Letivo ativo encontrado." }]);
      }

      const idAluno = String(negociacao.ID_ALUNO);

      const [matriculasDoAno, rematriculasDoAno, matriculasAnteriores, rematriculasAnteriores] = await Promise.all([
        repo.query(COMERCIAL, "Matriculas", (r) => r.ID_ALUNO === idAluno && r.ID_ANO_LETIVO === anoLetivo.ID_ANO_LETIVO),
        repo.query(COMERCIAL, "Rematriculas", (r) => r.ID_ALUNO === idAluno && r.ID_ANO_LETIVO === anoLetivo.ID_ANO_LETIVO),
        repo.query(COMERCIAL, "Matriculas", (r) => r.ID_ALUNO === idAluno),
        repo.query(COMERCIAL, "Rematriculas", (r) => r.ID_ALUNO === idAluno),
      ]);

      if (matriculasDoAno.length > 0 || rematriculasDoAno.length > 0) {
        res.status(409).json({
          error: "JA_MATRICULADO",
          mensagem: "Este Aluno já tem Matrícula ou Rematrícula registrada para o Ano Letivo ativo.",
        });
        return;
      }

      const ehRematricula = matriculasAnteriores.length > 0 || rematriculasAnteriores.length > 0;
      const nomeStatus = ehRematricula ? "Rematriculado" : "Matriculado";
      const hoje = new Date().toISOString().slice(0, 10);
      const usuario = req.usuario;

      let registroCriado;
      if (ehRematricula) {
        registroCriado = await repo.insert(
          COMERCIAL,
          "Rematriculas",
          { ID_ALUNO: idAluno, ID_ANO_LETIVO: anoLetivo.ID_ANO_LETIVO, STATUS: nomeStatus },
          { usuario },
        );
      } else {
        registroCriado = await repo.insert(
          COMERCIAL,
          "Matriculas",
          { ID_ALUNO: idAluno, ID_PROPOSTA: idProposta, ID_ANO_LETIVO: anoLetivo.ID_ANO_LETIVO, DATA_MATRICULA: hoje, STATUS: nomeStatus },
          { usuario },
        );
      }

      await repo.update(CADASTROS, "Alunos", idAluno, { ID_TURMA: idTurma }, { usuario });

      const statusNegociacaoAlvo = (await repo.query(COMERCIAL, "StatusNegociacao", (r) => r.NOME === nomeStatus && r.ATIVO === true))[0];
      if (statusNegociacaoAlvo) {
        await repo.update(COMERCIAL, "Negociacoes", String(negociacao.ID_NEGOCIACAO), { ID_STATUS_NEGOCIACAO: statusNegociacaoAlvo.ID_STATUS_NEGOCIACAO }, { usuario });
      }

      res.status(201).json({ tipo: ehRematricula ? "Rematricula" : "Matricula", registro: registroCriado });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
