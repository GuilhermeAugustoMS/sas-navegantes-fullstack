import { Router, type Request, type Response, type NextFunction } from "express";
import type { Repository } from "../../repository/Repository.js";
import { CADASTROS } from "../../schema/files.js";
import { BusinessRuleError } from "../../services/CrudService.js";

function paramId(req: Request): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Regra de negócio (confirmada com o usuário em 2026-09-15): editar um Aluno
 * exige que ele já tenha pelo menos um Responsável Financeiro (TIPO
 * "Financeiro" ou "Legal e Financeiro") ativo vinculado em
 * ResponsaveisFinanceiros. Só vale para edição (PUT) -- a criação (POST) fica
 * de fora de propósito: o vínculo só pode existir depois que o Aluno já tem
 * ID_ALUNO, então a tela guia o fluxo sequencial (cria o Aluno, depois
 * vincula o Responsável), sem garantia atômica entre os passos -- mesmo
 * padrão já usado no wizard "Fazer Proposta".
 *
 * Rota dedicada, montada ANTES do crudRouter genérico de Cadastros (mesmo
 * padrão do propostaGeneratorRouter): intercepta só PUT /alunos/:id e deixa
 * passar pro CRUD genérico (via next()) quando a regra já está satisfeita.
 */
export function alunoResponsavelGuardRouter(repo: Repository): Router {
  const router = Router();

  router.put("/alunos/:id", async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const id = paramId(req);
      const vinculos = await repo.query(
        CADASTROS,
        "ResponsaveisFinanceiros",
        (r) => r.ID_ALUNO === id && r.ATIVO === true && (r.TIPO === "Financeiro" || r.TIPO === "Legal e Financeiro"),
      );
      if (vinculos.length === 0) {
        throw new BusinessRuleError([
          {
            field: "ID_ALUNO",
            problem: "Aluno precisa ter um Responsável Financeiro (ou Legal e Financeiro) ativo vinculado antes de ser editado.",
          },
        ]);
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
