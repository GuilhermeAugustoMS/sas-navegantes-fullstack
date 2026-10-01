import { useId } from "react";
import "./ToggleSwitch.css";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

/**
 * Toggle switch reutilizável (visual de interruptor) -- troca puramente
 * visual de <input type="checkbox">: o checkbox nativo continua existindo
 * por baixo (role="checkbox", navegável por teclado, com <label htmlFor>
 * associando o texto visível), nenhum comportamento muda. Ver
 * ToggleSwitch.css para o estilo (CSS dedicado, não Tailwind -- usa
 * calc()/transform/variáveis customizadas do switch original).
 */
export function ToggleSwitch({ checked, onChange, label, className }: ToggleSwitchProps) {
  const id = useId();
  return (
    <span className={`toggle-switch-row${className ? ` ${className}` : ""}`}>
      <label className="toggle-switch" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
        />
        <span className="toggle-switch-slider" />
      </label>
      <label htmlFor={id} className="toggle-switch-text">
        {label}
      </label>
    </span>
  );
}
