import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

interface CalendarFieldProps {
  /** Data selecionada, em ISO "yyyy-mm-dd", ou "" se vazio -- mesmo formato que
   * o <input type="date"> nativo que este componente substitui. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Nome acessível do campo (ex. "Data de pagamento da Entrada"). */
  ariaLabel?: string;
  /** Limites opcionais, também em ISO "yyyy-mm-dd" -- nenhum dos campos que
   * usam este componente hoje define regra de limite de data, então ficam
   * sem uso por enquanto (mantidos só para um futuro reaproveitamento). */
  minDate?: string;
  maxDate?: string;
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatBR(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function formatFullDateAria(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(viewDate: Date): { date: Date; inMonth: boolean }[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

/**
 * Calendário customizado -- adaptado de um mockup aprovado pelo usuário
 * (Conceito 1: clean minimalista, 2026-10-12). Piloto: substitui só o campo
 * "Data de pagamento da Entrada" em PropostaSimulacaoPanel.tsx -- nenhum
 * outro campo de data do sistema foi trocado (mesmo critério já usado pro
 * CustomSelect, que também começou como piloto de um único campo).
 *
 * Decisões confirmadas com o usuário antes de implementar:
 * - Sem minDate/maxDate por enquanto -- não existe regra de negócio
 *   documentada limitando essa data (nem no schema, nem nos testes de
 *   backend), e o input nativo que este componente substitui também não
 *   tinha limite.
 * - Dias de outros meses (esmaecidos) são só visuais -- renderizados como
 *   `disabled`, não respondem a clique nem recebem foco por teclado.
 * - Teclado/ARIA: Esc fecha e devolve o foco ao botão. Setas movem o foco
 *   entre os dias do mês visível (paradas na borda da grade -- não navega
 *   pro mês adjacente sozinho, já que os dias fora do mês são inertes).
 *   Home/End vão pro primeiro/último dia do mês. Cada dia tem aria-label
 *   com a data por extenso. Não é o padrão APG completo de "date picker
 *   dialog" (não há anúncio de região viva nem grade com linhas/colunas
 *   reais), mas cobre o mesmo nível de esforço do CustomSelect.
 */
export function CalendarField({
  value,
  onChange,
  placeholder = "Selecione uma data",
  className = "",
  ariaLabel,
  minDate,
  maxDate,
}: CalendarFieldProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const selected = useMemo(() => parseISODate(value), [value]);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const minD = useMemo(() => parseISODate(minDate ?? null), [minDate]);
  const maxD = useMemo(() => parseISODate(maxDate ?? null), [maxDate]);
  const today = useMemo(() => new Date(), []);

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const monthYearLabel = useMemo(() => {
    const raw = `${MONTH_LABELS[viewDate.getMonth()]} de ${viewDate.getFullYear()}`;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [viewDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const selectedIdx = selected ? grid.findIndex((c) => c.inMonth && isSameDay(c.date, selected)) : -1;
    const todayIdx = grid.findIndex((c) => c.inMonth && isSameDay(c.date, today));
    const firstInMonthIdx = grid.findIndex((c) => c.inMonth);
    const initial = selectedIdx >= 0 ? selectedIdx : todayIdx >= 0 ? todayIdx : firstInMonthIdx;
    setFocusedIndex(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewDate]);

  useEffect(() => {
    if (open && focusedIndex !== null) {
      dayRefs.current[focusedIndex]?.focus();
    }
  }, [open, focusedIndex]);

  function isDisabled(d: Date) {
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  }

  function selectDay(d: Date) {
    if (isDisabled(d)) return;
    onChange(toISODate(d));
    setOpen(false);
    buttonRef.current?.focus();
  }

  function goToMonth(delta: number) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function moveFocus(delta: number) {
    setFocusedIndex((idx) => {
      if (idx === null) return idx;
      let next = idx;
      while (true) {
        next += delta;
        if (next < 0 || next >= grid.length) return idx;
        const cell = grid[next];
        if (cell.inMonth && !isDisabled(cell.date)) return next;
      }
    });
  }

  function handleGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(7);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-7);
        break;
      case "Home": {
        e.preventDefault();
        const first = grid.findIndex((c) => c.inMonth);
        if (first >= 0) setFocusedIndex(first);
        break;
      }
      case "End": {
        e.preventDefault();
        for (let i = grid.length - 1; i >= 0; i--) {
          if (grid[i].inMonth) {
            setFocusedIndex(i);
            break;
          }
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>{value ? formatBR(value) : placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-brand-amber">
          <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selecionar data"
          onKeyDown={handleGridKeyDown}
          className="absolute left-0 top-[calc(100%+8px)] z-20 w-[320px] rounded-[18px] bg-white p-5 shadow-[0_10px_30px_rgba(15,42,71,0.10)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Mês anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span aria-live="polite" className="text-sm font-bold text-brand-navy">
              {monthYearLabel}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Próximo mês"
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} aria-label={WEEKDAY_FULL[i]} className="text-[11px] font-bold text-slate-400">
                {label}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 justify-items-center gap-y-1">
            {grid.map(({ date, inMonth }, i) => {
              const isSelected = selected ? isSameDay(date, selected) : false;
              const isToday = isSameDay(date, today);
              const disabled = !inMonth || isDisabled(date);
              return (
                <button
                  key={i}
                  ref={(el) => {
                    dayRefs.current[i] = el;
                  }}
                  type="button"
                  disabled={disabled}
                  aria-label={formatFullDateAria(date)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  tabIndex={-1}
                  onFocus={() => setFocusedIndex(i)}
                  onClick={() => selectDay(date)}
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-colors",
                    !inMonth ? "text-slate-300" : "text-slate-800",
                    disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-slate-100",
                    disabled && inMonth ? "opacity-40" : "",
                    isSelected ? "bg-brand-amber font-bold text-brand-navy hover:bg-brand-amber" : "",
                    isToday && !isSelected ? "font-semibold shadow-[inset_0_0_0_1.5px_var(--color-brand-navy)]" : "",
                  ].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                buttonRef.current?.focus();
              }}
              className="text-[13px] text-slate-500 hover:text-slate-700"
            >
              Limpar
            </button>
            <button type="button" onClick={() => selectDay(new Date())} className="text-[13px] font-bold text-brand-amber hover:opacity-80">
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
