import { CADASTROS } from "../schema/files.js";
import type { ResourceDef } from "./resourceTypes.js";

export const CADASTROS_RESOURCES: ResourceDef[] = [
  { slug: "anos-letivos", file: CADASTROS, sheetName: "AnosLetivos", label: "Anos Letivos" },
  {
    slug: "series",
    file: CADASTROS,
    sheetName: "Series",
    label: "Séries",
    foreignKeys: [{ field: "ID_ANO_LETIVO", targetSheet: "AnosLetivos" }],
  },
  { slug: "turnos", file: CADASTROS, sheetName: "Turnos", label: "Turnos" },
  { slug: "modalidades", file: CADASTROS, sheetName: "Modalidades", label: "Modalidades" },
  { slug: "salas", file: CADASTROS, sheetName: "Salas", label: "Salas" },
  {
    slug: "turmas",
    file: CADASTROS,
    sheetName: "Turmas",
    label: "Turmas",
    foreignKeys: [
      { field: "ID_SERIE", targetSheet: "Series" },
      { field: "ID_TURNO", targetSheet: "Turnos" },
      { field: "ID_SALA", targetSheet: "Salas" },
    ],
  },
  { slug: "cargos", file: CADASTROS, sheetName: "Cargos", label: "Cargos" },
  { slug: "equipes", file: CADASTROS, sheetName: "Equipes", label: "Equipes" },
  {
    slug: "funcionarios",
    file: CADASTROS,
    sheetName: "Funcionarios",
    label: "Funcionários",
    foreignKeys: [
      { field: "ID_CARGO", targetSheet: "Cargos" },
      { field: "ID_EQUIPE", targetSheet: "Equipes" },
    ],
  },
  { slug: "centros-custo", file: CADASTROS, sheetName: "CentrosCusto", label: "Centros de Custo" },
  { slug: "responsaveis", file: CADASTROS, sheetName: "Responsaveis", label: "Responsáveis" },
  {
    slug: "alunos",
    file: CADASTROS,
    sheetName: "Alunos",
    label: "Alunos",
    foreignKeys: [
      { field: "ID_SERIE", targetSheet: "Series" },
      { field: "ID_TURMA", targetSheet: "Turmas" },
      { field: "ID_TURNO", targetSheet: "Turnos" },
    ],
  },
  {
    slug: "vinculos-responsavel",
    file: CADASTROS,
    sheetName: "ResponsaveisFinanceiros",
    label: "Vínculos Aluno × Responsável",
    foreignKeys: [
      { field: "ID_ALUNO", targetSheet: "Alunos" },
      { field: "ID_RESPONSAVEL", targetSheet: "Responsaveis" },
    ],
  },
];
