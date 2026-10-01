import { useId } from "react";
import "./HamburgerToggleIcon.css";

interface HamburgerToggleIconProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Ícone animado de 3 linhas que vira um X, controlado por `checked`/`onChange`
 * -- troca puramente visual do antigo "⋮" estático (ver PropostaSimulacaoPanel.tsx).
 *
 * <label>+<input type="checkbox"> em vez de <button>: um <input> não pode
 * ficar dentro de um <button> (conteúdo interativo aninhado é inválido em
 * HTML), e o checkbox nativo já é focável/operável por teclado (Tab +
 * Espaço) como o botão antigo era, com a vantagem de anunciar
 * marcado/desmarcado automaticamente pro leitor de tela -- o <button>
 * antigo dependia só do texto do aria-label mudar a cada clique.
 */
export function HamburgerToggleIcon({ checked, onChange, ariaLabel, className }: HamburgerToggleIconProps) {
  const id = useId();
  return (
    <label htmlFor={id} title={ariaLabel} className={`hamburger-toggle${className ? ` ${className}` : ""}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="hamburger-toggle-lines">
        <span />
        <span />
        <span />
      </span>
    </label>
  );
}
