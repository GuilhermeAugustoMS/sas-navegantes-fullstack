type WizardStepStatus = "done" | "current" | "pending";

export interface WizardStep {
  label: string;
  status: WizardStepStatus;
}

interface WizardProgressTrailProps {
  steps: WizardStep[];
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
      <path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Trilha horizontal de progresso de um wizard (concluído/atual/pendente) --
 * puramente informativa, não clicável (não pula etapas nem altera estado,
 * só mostra em qual passo o usuário está e quantos faltam). Usada hoje em
 * FazerPropostaPage.tsx no lugar dos numerozinhos soltos (①②③④) que cada
 * seção tinha, sem nenhuma indicação de quantos passos faltavam (achado do
 * diagnóstico de design de 2026-10-01).
 */
export function WizardProgressTrail({ steps }: WizardProgressTrailProps) {
  return (
    <ol className="flex mb-6">
      {steps.map((step, i) => {
        const anterior = steps[i - 1];
        const primeiro = i === 0;
        const ultimo = i === steps.length - 1;
        const linhaAntesPreenchida = !primeiro && anterior.status === "done";
        const linhaDepoisPreenchida = !ultimo && step.status === "done";
        return (
          <li key={step.label} className="flex-1 flex flex-col items-center min-w-0">
            <div className="flex items-center w-full">
              <div className={`h-0.5 flex-1 ${primeiro ? "invisible" : linhaAntesPreenchida ? "bg-brand-blue" : "bg-slate-200"}`} />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  step.status === "done"
                    ? "bg-brand-blue text-white"
                    : step.status === "current"
                      ? "border-2 border-brand-blue text-brand-blue-dark"
                      : "border-2 border-slate-200 text-slate-400"
                }`}
              >
                {step.status === "done" ? <CheckIcon /> : i + 1}
              </span>
              <div className={`h-0.5 flex-1 ${ultimo ? "invisible" : linhaDepoisPreenchida ? "bg-brand-blue" : "bg-slate-200"}`} />
            </div>
            <span
              className={`mt-1.5 text-[11px] font-medium text-center truncate max-w-full ${
                step.status === "pending" ? "text-slate-400" : "text-slate-700"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
