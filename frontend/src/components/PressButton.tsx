import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PressButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  children: ReactNode;
  className?: string;
}

/**
 * Botão com efeito "3D de pressionar" -- base: uiverse.io/Voxybuns/lucky-fireant-71
 * (CSS puro, licença MIT). Piloto confirmado com o usuário em 2026-10-15:
 * substitui só os botões "+ Novo Aluno" e "+ Nova Negociação" em
 * FazerPropostaPage.tsx -- nenhum outro botão do sistema foi trocado.
 *
 * Cores confirmadas: sombra/base em navy, rosto em âmbar com texto navy em
 * negrito -- mesmo par já usado no dia selecionado do CalendarField.tsx
 * ("bg-brand-amber font-bold text-brand-navy"), não uma cor nova escolhida
 * sem precedente.
 *
 * Tamanho confirmado: padding igual ao botão que substitui (px-3 py-1.5
 * text-sm), não o padding maior (px-6 py-3) do componente original do
 * uiverse -- para não destoar da altura do <select> ao lado na mesma linha.
 */
export function PressButton({ children, className = "", ...rest }: PressButtonProps) {
  return (
    <button
      {...rest}
      className={`group relative inline-block cursor-pointer rounded-md border-none bg-brand-navy p-0 ${className}`}
    >
      <span className="block -translate-y-[0.2em] whitespace-nowrap rounded-md border-2 border-brand-navy bg-brand-amber px-3 py-1.5 text-sm font-bold text-brand-navy transition-transform duration-100 ease-out group-hover:-translate-y-[0.33em] group-active:translate-y-0">
        {children}
      </span>
    </button>
  );
}
