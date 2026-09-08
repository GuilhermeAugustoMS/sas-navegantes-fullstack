import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useCatalog } from "../context/CatalogContext";

interface Indicadores {
  alunosAtivos: number;
  propostasCriadas: number;
  matriculasAnoAtual: number | null;
  negociacoesAbertas: number;
  anoLetivoAtivo: number | null;
}

/**
 * Regra confirmada com o usuário em 2026-09-07: dentre os status reais de
 * Negociação cadastrados (Matriculado, Rematriculado, Negociação Potencial,
 * Negociação Sensível, Oportunidade perdida, Sem Retorno, Questões $), só
 * "Matriculado" e "Rematriculado" contam como negociação fechada -- os
 * demais entram na contagem de "em aberto". Não alterar sem nova
 * confirmação explícita -- ver CLAUDE.md.
 */
const STATUS_FECHADOS = ["Matriculado", "Rematriculado"];

function IconAlunos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconProposta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M6 3h9l3 3v15H6V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 10h6M9 14h6M9 18h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconMatricula() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 6.5A2.5 2.5 0 016.5 4H16v16H6.5A2.5 2.5 0 014 17.5v-11z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M16 4h3v16h-3M9 9.5l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconNegociacao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 5h16v10H8l-4 4V5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardIndicador({
  titulo,
  valor,
  detalhe,
  icone,
  corIcone,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
  corIcone: "blue" | "amber" | "navy";
}) {
  const corClasses = {
    blue: "bg-brand-blue/10 text-brand-blue-dark",
    amber: "bg-brand-amber/15 text-brand-amber",
    navy: "bg-brand-navy/15 text-brand-navy",
  }[corIcone];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${corClasses}`}>{icone}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{titulo}</p>
        <p className="text-2xl font-semibold text-slate-900 mt-0.5">{valor}</p>
        {detalhe && <p className="text-xs text-slate-400 mt-0.5">{detalhe}</p>}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { resourceBySlug } = useCatalog();
  const [dados, setDados] = useState<Indicadores | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const alunosRes = resourceBySlug.get("alunos");
      const propostasRes = resourceBySlug.get("propostas");
      const matriculasRes = resourceBySlug.get("matriculas");
      const negociacoesRes = resourceBySlug.get("negociacoes");
      const statusRes = resourceBySlug.get("status-negociacao");
      const anosRes = resourceBySlug.get("anos-letivos");
      if (!alunosRes || !propostasRes || !matriculasRes || !negociacoesRes || !statusRes || !anosRes) return;

      try {
        const [alunos, propostas, matriculas, negociacoes, statusList, anos] = await Promise.all([
          api.list(alunosRes, { ativo: "true" }),
          api.list(propostasRes),
          api.list(matriculasRes),
          api.list(negociacoesRes),
          api.list(statusRes),
          api.list(anosRes),
        ]);
        if (cancelado) return;

        const anoLetivoAtivo = anos.find((a) => a.ATIVO === true) ?? null;
        const matriculasAnoAtual = anoLetivoAtivo
          ? matriculas.filter((m) => m.ID_ANO_LETIVO === anoLetivoAtivo.ID_ANO_LETIVO).length
          : null;

        const idsFechados = new Set(
          statusList.filter((s) => typeof s.NOME === "string" && STATUS_FECHADOS.includes(s.NOME)).map((s) => s.ID_STATUS_NEGOCIACAO),
        );
        const negociacoesAbertas = negociacoes.filter((n) => !idsFechados.has(n.ID_STATUS_NEGOCIACAO)).length;

        setDados({
          alunosAtivos: alunos.length,
          propostasCriadas: propostas.length,
          matriculasAnoAtual,
          negociacoesAbertas,
          anoLetivoAtivo: anoLetivoAtivo ? Number(anoLetivoAtivo.ANO) : null,
        });
      } catch (err) {
        if (!cancelado) setErro(err instanceof Error ? err.message : "Não foi possível carregar os indicadores.");
      }
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [resourceBySlug]);

  if (erro) {
    return (
      <div className="max-w-md">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return <p className="text-sm text-slate-500">Carregando indicadores...</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardIndicador titulo="Alunos ativos" valor={String(dados.alunosAtivos)} icone={<IconAlunos />} corIcone="blue" />
        <CardIndicador titulo="Propostas criadas" valor={String(dados.propostasCriadas)} icone={<IconProposta />} corIcone="navy" />
        <CardIndicador
          titulo="Matrículas no ano letivo"
          valor={dados.matriculasAnoAtual === null ? "—" : String(dados.matriculasAnoAtual)}
          detalhe={dados.anoLetivoAtivo ? `Ano letivo ${dados.anoLetivoAtivo}` : "Nenhum Ano Letivo ativo cadastrado"}
          icone={<IconMatricula />}
          corIcone="amber"
        />
        <CardIndicador
          titulo="Negociações em aberto"
          valor={String(dados.negociacoesAbertas)}
          icone={<IconNegociacao />}
          corIcone="blue"
        />
      </div>

      <div className="mt-4 border border-dashed border-slate-300 rounded-xl px-5 py-4 text-sm text-slate-500 bg-slate-50">
        Gráficos, calendário acadêmico e quadro de avisos chegam na Fase 8 (Dashboards completos) — ainda não implementados.
      </div>
    </div>
  );
}
