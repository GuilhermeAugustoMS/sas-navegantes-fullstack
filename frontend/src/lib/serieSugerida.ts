import type { RecordRow } from "../api/types";

/**
 * Regra de corte etário confirmada explicitamente pelo usuário em 2026-09-07:
 * idade completada até 31/03 do ano letivo. A tabela idade→nível também foi
 * confirmada explicitamente (G1 a 2º Período em sequência regressiva a
 * partir do 1º Ano = 6 anos; Fundamental/Médio seguem a referência nacional
 * BNCC/LDB). Não alterar sem nova confirmação do usuário — ver CLAUDE.md.
 */
const IDADE_POR_NIVEL: [nivel: string, idade: number][] = [
  ["G1", 1],
  ["Maternal 1", 2],
  ["Maternal 2", 3],
  ["1º Período", 4],
  ["2º Período", 5],
  ["1º Ano", 6],
  ["2º Ano", 7],
  ["3º Ano", 8],
  ["4º Ano", 9],
  ["5º Ano", 10],
  ["6º Ano", 11],
  ["7º Ano", 12],
  ["8º Ano", 13],
  ["9º Ano", 14],
  ["EM-1º Ano", 15],
  ["EM-2º Ano", 16],
  ["EM-3º Ano", 17],
];

function normalizar(texto: string): string {
  return texto.replace(/°/g, "º").trim().toLowerCase();
}

/** Remove a letra de turma embutida no nome da Série (ex.: "1º Ano A" -> "1º Ano"). */
function nivelBase(nomeSerie: string): string {
  return normalizar(nomeSerie).replace(/\s+[a-z]$/i, "");
}

/** Idade completada até 31/03 do ano informado, a partir de uma data de nascimento (YYYY-MM-DD ou Date). */
export function idadeEm31Marco(dataNascimento: string | Date, anoLetivo: number): number | null {
  const nasc = new Date(dataNascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  const corte = new Date(anoLetivo, 2, 31); // mês 2 = março (0-indexado)
  let idade = corte.getFullYear() - nasc.getUTCFullYear();
  const aniversarioNoAnoCorte = new Date(corte.getFullYear(), nasc.getUTCMonth(), nasc.getUTCDate());
  if (aniversarioNoAnoCorte > corte) idade--;
  return idade;
}

export function nivelParaIdade(idade: number): string | null {
  const encontrado = IDADE_POR_NIVEL.find(([, i]) => i === idade);
  return encontrado ? encontrado[0] : null;
}

/** Entre as Séries informadas, retorna só as que batem com o nível calculado pela idade. */
export function seriesSugeridas(series: RecordRow[], idade: number): RecordRow[] {
  const nivel = nivelParaIdade(idade);
  if (!nivel) return [];
  const nivelNorm = normalizar(nivel);
  return series.filter((s) => typeof s.NOME === "string" && nivelBase(s.NOME) === nivelNorm);
}
