/** Formata uma data (ISO ou qualquer valor aceito por `Date`) como dd/mm/aaaa em pt-BR. */
export function fmtData(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
