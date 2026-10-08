import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Nome acessível do campo (ex. "Forma de Pagamento") -- o <select> nativo que
   * este componente substitui também não tinha label associado via htmlFor/id,
   * então isto já é uma melhoria, não só paridade. */
  ariaLabel?: string;
}

/**
 * Select customizado -- base: uiverse.io/3bdel3ziz-T/gentle-vampirebat-46
 * (CSS puro, licença MIT). Piloto confirmado com o usuário em 2026-10-08:
 * substitui só o campo "Forma de Pagamento" em PropostaSimulacaoPanel.tsx --
 * nenhum outro <select> do sistema foi trocado.
 *
 * Diferenças em relação ao componente original do uiverse (todas confirmadas
 * com o usuário antes de implementar):
 * - Cores trocadas para a paleta clara da marca (âmbar = selecionado, navy =
 *   foco/contorno -- mesmo precedente de ToggleSwitch.css) em vez do painel
 *   escuro (bg-slate-800) original, que destoaria dos outros campos claros
 *   deste formulário.
 * - Abre só por clique, não por hover -- consistente com o <select> nativo
 *   substituído e com o resto do formulário.
 * - Suporte a teclado (setas/Home/End/Enter/Esc) e ARIA de listbox
 *   (role="combobox"/"listbox"/"option", aria-expanded, aria-activedescendant)
 *   foram adicionados -- o original não tinha nenhum dos dois, e esse campo é
 *   usado todo dia pela Secretaria/Comercial/Financeiro.
 */
export function CustomSelect({ options, value, onChange, placeholder = "Selecione...", className = "", ariaLabel }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const baseOptionId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openList(initialIndex: number) {
    setOpen(true);
    setActiveIndex(initialIndex >= 0 ? initialIndex : 0);
  }

  function closeList() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closeList();
    buttonRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList(selectedIndex);
        else setActiveIndex((i) => Math.min(options.length - 1, (i < 0 ? -1 : i) + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList(selectedIndex >= 0 ? selectedIndex : options.length - 1);
        else setActiveIndex((i) => Math.max(0, (i < 0 ? options.length : i) - 1));
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) openList(selectedIndex);
        else selectOption(activeIndex);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          closeList();
        }
        break;
      case "Tab":
        if (open) closeList();
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full select-none ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${baseOptionId}-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? closeList() : openList(selectedIndex))}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
      >
        <span className={selected ? "" : "text-slate-400"}>{selected ? selected.label : placeholder}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          className={`h-2.5 w-3 shrink-0 fill-slate-500 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
        >
          <path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z" />
        </svg>
      </button>

      <ul
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        className={`absolute left-0 top-full z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-slate-200 bg-white py-1 shadow-lg transition-all duration-150 ${
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return (
            <li
              key={option.value}
              id={`${baseOptionId}-${index}`}
              role="option"
              aria-selected={isSelected}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(index)}
              className={`cursor-pointer px-3 py-1.5 text-sm text-slate-700 ${isSelected ? "bg-brand-amber/15 font-medium text-brand-navy" : ""} ${
                isActive && !isSelected ? "bg-slate-100" : ""
              } ${isActive && isSelected ? "ring-1 ring-inset ring-brand-navy/30" : ""}`}
            >
              {option.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
