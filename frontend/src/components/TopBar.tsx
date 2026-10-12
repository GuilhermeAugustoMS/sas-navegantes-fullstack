import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  usuario: string;
  onUsuarioChange: (v: string) => void;
  /** Controles específicos da tela (ex.: "mostrar inativos", botão "+ Novo"), renderizados antes do usuário. */
  children?: ReactNode;
  /** Abre o drawer da sidebar em telas estreitas (< md) -- ver Sidebar.tsx. */
  onAbrirMenu?: () => void;
}

/**
 * Cabeçalho compartilhado das telas de CRUD genérico e do Dashboard.
 * A busca é só visual por enquanto -- não existe uma busca global
 * implementada no sistema ainda, então o campo fica desabilitado.
 */
export function TopBar({ title, subtitle, usuario, onUsuarioChange, children, onAbrirMenu }: Props) {
  return (
    <header className="border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between bg-white sticky top-0 z-10 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {onAbrirMenu && (
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menu"
            className="md:hidden h-8 w-8 shrink-0 flex items-center justify-center rounded-md text-slate-500 hover:text-brand-blue-dark hover:bg-slate-100"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-brand-navy truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative hidden sm:block">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar... (em breve)"
            disabled
            title="Busca global ainda não implementada -- só visual por enquanto"
            className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-slate-300 bg-slate-50 text-slate-400 placeholder:text-slate-400 w-44 cursor-not-allowed"
          />
        </div>

        {children}

        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="h-7 w-7 rounded-full bg-brand-blue/15 text-brand-blue-dark flex items-center justify-center text-xs font-semibold shrink-0">
            {(usuario.trim().slice(0, 2) || "??").toUpperCase()}
          </div>
          <input
            value={usuario}
            onChange={(e) => onUsuarioChange(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-xs w-20 sm:w-28"
            title="Usuário (registrado na auditoria de cada alteração)"
          />
        </div>
      </div>
    </header>
  );
}
