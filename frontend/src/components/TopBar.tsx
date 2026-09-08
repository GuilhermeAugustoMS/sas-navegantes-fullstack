import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  usuario: string;
  onUsuarioChange: (v: string) => void;
  /** Controles específicos da tela (ex.: "mostrar inativos", botão "+ Novo"), renderizados antes do usuário. */
  children?: ReactNode;
}

/**
 * Cabeçalho compartilhado das telas de CRUD genérico e do Dashboard.
 * A busca é só visual por enquanto -- não existe uma busca global
 * implementada no sistema ainda, então o campo fica desabilitado.
 */
export function TopBar({ title, subtitle, usuario, onUsuarioChange, children }: Props) {
  return (
    <header className="border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-white sticky top-0 z-10">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 font-mono">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
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
            className="border border-slate-300 rounded px-2 py-1 text-xs w-28"
            title="Usuário (registrado na auditoria de cada alteração)"
          />
        </div>
      </div>
    </header>
  );
}
