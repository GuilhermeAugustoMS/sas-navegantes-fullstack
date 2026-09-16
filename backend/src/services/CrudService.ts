import type { Repository, RepoContext } from "../repository/Repository.js";
import type { Record_ } from "../types/schema.js";
import type { ResourceDef } from "../api/resourceTypes.js";

export class BusinessRuleError extends Error {
  constructor(public errors: { field: string; problem: string }[]) {
    super(errors.map((e) => `${e.field}: ${e.problem}`).join("; "));
  }
}

/**
 * Camada de regras de negócio (Seção 47/48): valida integridade referencial
 * antes de delegar ao Repository (Seção 57: Excel ou Postgres, indiferente
 * aqui). O Controller nunca chama o Repository diretamente. Generalizado
 * para qualquer módulo — cada ResourceDef já carrega o FileDef de onde vêm
 * seus próprios dados (resource.file), e cada ForeignKey pode apontar para
 * uma aba em OUTRO arquivo (fk.targetFile).
 */
export class CrudService {
  constructor(private repo: Repository) {}

  async list(resource: ResourceDef, filters: Record<string, string>): Promise<Record_[]> {
    const all = await this.repo.readAll(resource.file, resource.sheetName);
    return all.filter((rec) => {
      for (const [key, value] of Object.entries(filters)) {
        if (key === "ativo") {
          const wantActive = value === "true";
          if (Boolean(rec.ATIVO) !== wantActive) return false;
          continue;
        }
        // filtro genérico por igualdade em qualquer outra coluna do schema
        if (key.toUpperCase() in rec && String(rec[key.toUpperCase()] ?? "") !== value) return false;
      }
      return true;
    });
  }

  async get(resource: ResourceDef, id: string): Promise<Record_ | undefined> {
    return this.repo.findById(resource.file, resource.sheetName, id);
  }

  async create(resource: ResourceDef, data: Record_, ctx: RepoContext): Promise<Record_> {
    await this.checkForeignKeys(resource, data);
    return this.repo.insert(resource.file, resource.sheetName, data, ctx);
  }

  async update(resource: ResourceDef, id: string, changes: Record_, ctx: RepoContext): Promise<Record_> {
    await this.checkForeignKeys(resource, changes);
    return this.repo.update(resource.file, resource.sheetName, id, changes, ctx);
  }

  async softDelete(resource: ResourceDef, id: string, ctx: RepoContext): Promise<void> {
    await this.repo.softDelete(resource.file, resource.sheetName, id, ctx);
  }

  /**
   * Regra de negócio (não é validação de tipo, é integridade entre cadastros):
   * toda chave estrangeira presente no payload precisa apontar para um
   * registro ATIVO existente na aba de destino — que pode estar em outro
   * arquivo .xlsx (ex.: Negociacoes.ID_ALUNO, em 04_COMERCIAL.xlsx, aponta
   * para Alunos em 01_CADASTROS.xlsx).
   */
  private async checkForeignKeys(resource: ResourceDef, data: Record_): Promise<void> {
    if (!resource.foreignKeys?.length) return;
    const errors: { field: string; problem: string }[] = [];

    for (const fk of resource.foreignKeys) {
      const value = data[fk.field];
      if (value === undefined || value === null || value === "") continue; // FK opcional não informada

      const targetFile = fk.targetFile ?? resource.file;
      const target = await this.repo.findById(targetFile, fk.targetSheet, String(value));
      if (!target) {
        errors.push({ field: fk.field, problem: `Registro "${value}" não existe em ${fk.targetSheet}` });
      } else if (target.ATIVO === false) {
        errors.push({ field: fk.field, problem: `Registro "${value}" existe em ${fk.targetSheet} mas está inativo` });
      }
    }

    if (errors.length > 0) throw new BusinessRuleError(errors);
  }
}
