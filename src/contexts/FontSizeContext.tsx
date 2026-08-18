import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { ALargeSmall, Check, Eye, X } from 'lucide-react';
import { cn } from '../utils/cn';

export type FontSizePreference = 'small' | 'medium' | 'large' | 'giant';

const FONT_SIZE_STORAGE_KEY = 'nmb-font-size-v1';

const fontSizeOptions: Array<{
  value: FontSizePreference;
  label: string;
  description: string;
  sampleSize: number;
}> = [
  { value: 'small', label: 'Pequena', description: 'Mais conteúdo na tela', sampleSize: 16 },
  { value: 'medium', label: 'Média', description: 'Padrão recomendado', sampleSize: 19 },
  { value: 'large', label: 'Grande', description: 'Leitura ampliada', sampleSize: 23 },
  { value: 'giant', label: 'Gigante', description: 'Máxima legibilidade', sampleSize: 28 },
];

export const fontSizeLabels: Record<FontSizePreference, string> = {
  small: 'Pequena',
  medium: 'Média',
  large: 'Grande',
  giant: 'Gigante',
};

function isFontSizePreference(value: string | null): value is FontSizePreference {
  return value === 'small' || value === 'medium' || value === 'large' || value === 'giant';
}

function readStoredFontSize() {
  try {
    const stored = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return isFontSizePreference(stored) ? stored : null;
  } catch {
    return null;
  }
}

type FontSizeContextValue = {
  fontSize: FontSizePreference;
  openFontSizePicker: () => void;
};

const FontSizeContext = createContext<FontSizeContextValue>({
  fontSize: 'medium',
  openFontSizePicker: () => {},
});

function FontSizePicker({
  selected,
  initial,
  onSelect,
  onConfirm,
  onCancel,
}: {
  selected: FontSizePreference;
  initial: boolean;
  onSelect: (size: FontSizePreference) => void;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancel) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[300] overflow-y-auto bg-slate-100/95 px-4 py-5 backdrop-blur-md dark:bg-slate-950/95 sm:px-6 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="font-size-picker-title"
      aria-describedby="font-size-picker-description"
    >
      <div className="flex min-h-full items-center justify-center">
        <section className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Fechar escolha de tamanho da fonte"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="flex items-start gap-4 pr-10 sm:pr-12">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">
              <ALargeSmall className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-700 dark:text-orange-300">
                Acessibilidade
              </p>
              <h1
                id="font-size-picker-title"
                ref={titleRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-black tracking-tight text-slate-950 outline-none dark:text-white"
              >
                {initial ? 'Como você prefere ler o site?' : 'Alterar tamanho da fonte'}
              </h1>
            </div>
          </div>

          <p id="font-size-picker-description" className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Escolha o tamanho mais confortável. A opção <strong>Média</strong> é o padrão e já vem selecionada.
            Você poderá mudar novamente pelo botão de fonte no topo ou no menu “Mais”.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tamanho da fonte">
            {fontSizeOptions.map((option) => {
              const active = selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(option.value)}
                  className={cn(
                    'relative min-h-24 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 dark:focus-visible:ring-orange-500/25',
                    active
                      ? 'border-orange-600 bg-orange-50 text-orange-950 ring-2 ring-orange-600 dark:border-orange-400 dark:bg-orange-500/10 dark:text-orange-100 dark:ring-orange-400'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-orange-300 hover:bg-orange-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-orange-500/50',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-black" style={{ fontSize: `${option.sampleSize}px`, lineHeight: 1.1 }}>
                      Aa
                    </span>
                    {active && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-700 text-white dark:bg-orange-500"><Check className="h-4 w-4" /></span>}
                  </span>
                  <span className="mt-2 block text-base font-extrabold">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{option.description}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-100 p-4 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-orange-700 dark:text-orange-300" />
            <p className="text-sm leading-relaxed">
              Prévia: este texto muda na hora para você comparar antes de continuar.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-12 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className="min-h-12 rounded-xl bg-orange-700 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-700/20 transition-colors hover:bg-orange-800"
            >
              {initial ? `Continuar com fonte ${fontSizeLabels[selected].toLowerCase()}` : `Salvar fonte ${fontSizeLabels[selected].toLowerCase()}`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [initialState] = useState(() => {
    const stored = readStoredFontSize();
    return { stored, fontSize: stored ?? 'medium' as FontSizePreference };
  });
  const [fontSize, setFontSize] = useState<FontSizePreference>(initialState.fontSize);
  const [committedFontSize, setCommittedFontSize] = useState<FontSizePreference>(initialState.fontSize);
  const [hasChosen, setHasChosen] = useState(initialState.stored !== null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = fontSize;
    if (hasChosen) root.dataset.fontChoice = 'done';
    else delete root.dataset.fontChoice;
  }, [fontSize, hasChosen]);

  const confirmFontSize = useCallback(() => {
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
    } catch {}
    setCommittedFontSize(fontSize);
    setHasChosen(true);
    setPickerOpen(false);
  }, [fontSize]);

  const openFontSizePicker = useCallback(() => {
    setFontSize(committedFontSize);
    setPickerOpen(true);
  }, [committedFontSize]);

  const cancelFontSizePicker = useCallback(() => {
    setFontSize(committedFontSize);
    setPickerOpen(false);
  }, [committedFontSize]);

  const contextValue = useMemo(() => ({ fontSize, openFontSizePicker }), [fontSize, openFontSizePicker]);

  return (
    <FontSizeContext.Provider value={contextValue}>
      {hasChosen ? children : null}
      {!hasChosen && (
        <FontSizePicker
          selected={fontSize}
          initial
          onSelect={setFontSize}
          onConfirm={confirmFontSize}
        />
      )}
      {hasChosen && pickerOpen && (
        <FontSizePicker
          selected={fontSize}
          initial={false}
          onSelect={setFontSize}
          onConfirm={confirmFontSize}
          onCancel={cancelFontSizePicker}
        />
      )}
    </FontSizeContext.Provider>
  );
}

export const useFontSize = () => useContext(FontSizeContext);
