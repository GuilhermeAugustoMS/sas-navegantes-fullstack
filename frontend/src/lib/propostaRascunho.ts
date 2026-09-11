import type { ParcelaProposta, RecordRow } from "../api/types";

/**
 * Uma Proposta "em rascunho" (reaproveitável) é uma que já existe para a
 * Negociação mas ainda não tem nenhuma parcela gerada/congelada (Seção 54).
 * Reabrir o wizard "Fazer Proposta" na mesma Negociação deve reaproveitar
 * esse rascunho em vez de criar uma Proposta nova a cada vez — ver
 * FazerPropostaPage.tsx.
 *
 * Se houver mais de um rascunho para a mesma Negociação (não deveria
 * acontecer depois desta correção, mas pode já existir nos dados por causa
 * do bug anterior), reaproveita o mais recente (maior DATA_PROPOSTA, com
 * maior ID_PROPOSTA como desempate) e ignora os demais.
 *
 * `listarParcelas` é injetado (em vez de chamar api.listarParcelas direto)
 * pra essa função ficar pura e testável sem precisar de rede/DOM.
 */
export async function encontrarPropostaRascunho(
  candidatas: RecordRow[],
  listarParcelas: (propostaId: string) => Promise<ParcelaProposta[]>,
): Promise<string | null> {
  if (candidatas.length === 0) return null;

  const ordenadas = [...candidatas].sort((a, b) => {
    const dataA = new Date(String(a.DATA_PROPOSTA ?? "")).getTime();
    const dataB = new Date(String(b.DATA_PROPOSTA ?? "")).getTime();
    if (dataB !== dataA) return dataB - dataA;
    return String(b.ID_PROPOSTA).localeCompare(String(a.ID_PROPOSTA));
  });

  for (const candidata of ordenadas) {
    const id = String(candidata.ID_PROPOSTA);
    try {
      const parcelas = await listarParcelas(id);
      if (parcelas.length === 0) return id;
    } catch {
      // Não foi possível checar essa candidata -- não reaproveita, tenta a próxima.
    }
  }
  return null;
}
