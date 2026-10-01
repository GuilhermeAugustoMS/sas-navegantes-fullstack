import type { ReactNode } from "react";

/** Ícones dos módulos (Cadastros/Comercial/Financeiro) e do Dashboard --
 * compartilhados entre a Sidebar e a tela de opções de cada módulo
 * (ModuleMenuPage.tsx), pra não duplicar os SVGs em dois lugares. */

export function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconCadastros() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 9h4M16 12.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconComercial() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <rect x="3.5" y="8" width="17" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8V6.5A1.5 1.5 0 019.5 5h5A1.5 1.5 0 0116 6.5V8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 13h17" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconFinanceiro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.2 9.8c-.3-.7-1.1-1.2-2.2-1.2-1.4 0-2.4.8-2.4 1.8 0 2.4 4.6 1 4.6 3.4 0 1-1 1.8-2.4 1.8-1.1 0-1.9-.5-2.2-1.2M12 7.5v1M12 15.5v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const MODULE_ICONS: Record<string, () => ReactNode> = {
  cadastros: IconCadastros,
  comercial: IconComercial,
  financeiro: IconFinanceiro,
};

/** Ícone da ação "Fazer Proposta" (criar do zero) -- ver ModuleMenuPage.tsx:
 * as duas ações do Comercial (criar vs. gerenciar existente) precisam de
 * ícone próprio, em vez de repetir o ícone do módulo em todo card da grade. */
export function IconFazerProposta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <path d="M6 3.5h8l4 4v13H6v-17z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3.5v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Ícone da ação "Gerador de Proposta" (gerenciar/simular uma proposta já existente). */
export function IconGeradorProposta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0">
      <path d="M5 3.5h9l5 5v12H5v-17z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3.5v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 13h8M8 16.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
