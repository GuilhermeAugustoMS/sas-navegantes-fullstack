import { Router, type Request, type Response, type NextFunction } from "express";
import type { Repository } from "../../repository/Repository.js";
import { CADASTROS, COMERCIAL } from "../../schema/files.js";

/**
 * Gestão de Vagas (módulo Planejamento, núcleo inicial -- 2026-11-02):
 * rota dedicada e somente-leitura (não é CRUD genérico, não grava nada) que
 * calcula ao vivo, por Turma, quantas vagas estão preenchidas no Ano
 * Letivo ativo -- cruzando Alunos.ID_TURMA com Matriculas/Rematriculas
 * desse ano. Cada Turma também traz a lista de Alunos vinculados a ela
 * (nome + status Matriculado/Rematriculado/Pendente), para a tela permitir
 * selecionar uma Turma e ver quem está nela (2026-11-02).
 *
 * Escopo combinado com o usuário: por enquanto só Capacidade/Matrículas/
 * Rematrículas/Vagas Disponíveis/Status. Gênero, Programas (Integral/Semi/
 * Estendido) e Taxa de Rematrícula ficaram de fora desta passada -- exigem
 * joins mais complexos (via Proposta/ParcelasProposta) que não valem a pena
 * validar agora, já que Matriculas/Rematriculas estão vazias na base real.
 *
 * Faixas de status são só categorização visual (não é regra financeira/
 * contratual) -- ajustável se o usuário pedir outros cortes.
 */
export function gestaoVagasRouter(repo: Repository): Router {
  const router = Router();

  router.get("/gestao-vagas", async (req: Request, res: Response, next: NextFunction) => {
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

      const [turmas, alunos, matriculas, rematriculas] = await Promise.all([
        repo.query(CADASTROS, "Turmas", (r) => r.ATIVO === true),
        repo.query(CADASTROS, "Alunos", (r) => r.ATIVO === true),
        repo.query(COMERCIAL, "Matriculas", (r) => r.ID_ANO_LETIVO === anoLetivo!.ID_ANO_LETIVO),
        repo.query(COMERCIAL, "Rematriculas", (r) => r.ID_ANO_LETIVO === anoLetivo!.ID_ANO_LETIVO),
      ]);

      const turmaPorAluno = new Map<string, string>();
      for (const a of alunos) {
        if (a.ID_TURMA) turmaPorAluno.set(String(a.ID_ALUNO), String(a.ID_TURMA));
      }

      const alunosComMatricula = new Set<string>();
      for (const m of matriculas) alunosComMatricula.add(String(m.ID_ALUNO));

      const alunosComRematricula = new Set<string>();
      for (const r of rematriculas) alunosComRematricula.add(String(r.ID_ALUNO));

      const matriculasPorTurma = new Map<string, number>();
      for (const m of matriculas) {
        const turmaId = turmaPorAluno.get(String(m.ID_ALUNO));
        if (!turmaId) continue;
        matriculasPorTurma.set(turmaId, (matriculasPorTurma.get(turmaId) ?? 0) + 1);
      }

      const rematriculasPorTurma = new Map<string, number>();
      for (const r of rematriculas) {
        const turmaId = turmaPorAluno.get(String(r.ID_ALUNO));
        if (!turmaId) continue;
        rematriculasPorTurma.set(turmaId, (rematriculasPorTurma.get(turmaId) ?? 0) + 1);
      }

      const alunosPorTurma = new Map<
        string,
        { idAluno: string; nome: string; status: "Matriculado" | "Rematriculado" | "Pendente" }[]
      >();
      for (const a of alunos) {
        if (!a.ID_TURMA) continue;
        const turmaId = String(a.ID_TURMA);
        const idAluno = String(a.ID_ALUNO);
        const status: "Matriculado" | "Rematriculado" | "Pendente" = alunosComRematricula.has(idAluno)
          ? "Rematriculado"
          : alunosComMatricula.has(idAluno)
            ? "Matriculado"
            : "Pendente";
        const lista = alunosPorTurma.get(turmaId) ?? [];
        lista.push({ idAluno, nome: String(a.NOME), status });
        alunosPorTurma.set(turmaId, lista);
      }
      for (const lista of alunosPorTurma.values()) {
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
      }

      const linhas = turmas
        .map((t) => {
          const idTurma = String(t.ID_TURMA);
          const capacidadeMaxima = Number(t.CAPACIDADE_MAXIMA) || 0;
          const qtdMatriculas = matriculasPorTurma.get(idTurma) ?? 0;
          const qtdRematriculas = rematriculasPorTurma.get(idTurma) ?? 0;
          const totalPreenchido = qtdMatriculas + qtdRematriculas;
          const vagasDisponiveis = capacidadeMaxima - totalPreenchido;
          const percentualOcupacao = capacidadeMaxima > 0 ? totalPreenchido / capacidadeMaxima : 0;

          let status: "Vazia" | "Com vagas" | "Quase lotada" | "Lotada";
          if (totalPreenchido === 0) status = "Vazia";
          else if (percentualOcupacao >= 1) status = "Lotada";
          else if (percentualOcupacao >= 0.8) status = "Quase lotada";
          else status = "Com vagas";

          return {
            idTurma,
            nome: String(t.NOME),
            idSerie: String(t.ID_SERIE),
            capacidadeMaxima,
            matriculas: qtdMatriculas,
            rematriculas: qtdRematriculas,
            totalPreenchido,
            vagasDisponiveis,
            percentualOcupacao,
            status,
            alunos: alunosPorTurma.get(idTurma) ?? [],
          };
        })
        .sort((a, b) => a.idTurma.localeCompare(b.idTurma));

      res.json({
        anoLetivo: { id: String(anoLetivo.ID_ANO_LETIVO), ano: Number(anoLetivo.ANO) },
        turmas: linhas,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
