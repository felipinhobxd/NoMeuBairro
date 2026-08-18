import { useState } from 'react';
import { usePanicButton, executePanic } from '../hooks/usePanicButton';
import { Shield, Phone, ExternalLink } from 'lucide-react';
import { cn } from '../utils/cn';
import { hasCookieConsentChoice, saveCookieConsentChoice, type CookieConsentChoice } from '../utils/cookieConsent';

// ─── Panic Button ──────────────────────────────────────────
export function PanicButton() {
  usePanicButton(executePanic);

  return (
    <button
      onClick={executePanic}
      className="fixed top-20 right-16 z-50 w-11 h-11 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg shadow-red-500/30 hover:shadow-red-500/50 flex items-center justify-center transition-all duration-200 active:scale-90 group"
      aria-label="Botão de saída rápida — pressione para sair imediatamente (ou pressione Esc duas vezes)"
      title="Saída rápida (Esc×2)"
    >
      <Shield className="w-5 h-5 group-hover:scale-110 transition-transform" />
    </button>
  );
}

// ─── Cookie Consent (LGPD) ─────────────────────────────────
export function CookieConsent() {
  const [visible, setVisible] = useState(() => !hasCookieConsentChoice());

  const handleChoice = (choice: CookieConsentChoice) => {
    saveCookieConsentChoice(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-4 right-4 top-20 z-[200] max-h-[calc(100dvh-16rem)] overflow-y-auto rounded-2xl animate-slide-down md:bottom-6 md:left-6 md:right-auto md:top-auto md:max-h-none md:max-w-lg md:overflow-visible md:animate-slide-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-black/15 ring-1 ring-slate-200 dark:bg-slate-800 dark:shadow-black/30 dark:ring-slate-700 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <span className="text-lg" role="img" aria-hidden="true">🍪</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="cookie-consent-title" className="text-base font-extrabold text-slate-900 dark:text-white">
              Antes do guia: escolha os cookies
            </h2>
            <p id="cookie-consent-description" className="mb-4 mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Para continuar e iniciar o guia do site, escolha uma opção abaixo. Se estiver de acordo,
              aperte em <strong>“Concordo com cookies”</strong>. Você também pode manter somente os cookies essenciais.{' '}
              <a
                href="#/privacidade"
                className="font-bold text-emerald-700 underline decoration-2 underline-offset-2 dark:text-emerald-400"
              >
                Ver política de privacidade
              </a>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleChoice('all')}
                className={cn(
                  'min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700',
                )}
              >
                Concordo com cookies
              </button>
              <button
                type="button"
                onClick={() => handleChoice('essential')}
                className={cn(
                  'min-h-11 flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
                )}
              >
                Somente essenciais
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Emergency Contacts ────────────────────────────────────
const emergencyContacts = [
  { number: '190', label: 'Polícia Militar', color: 'text-blue-600 dark:text-blue-400' },
  { number: '180', label: 'Mulher (violência)', color: 'text-purple-600 dark:text-purple-400' },
  { number: '192', label: 'SAMU', color: 'text-red-600 dark:text-red-400' },
  { number: '193', label: 'Bombeiros', color: 'text-orange-600 dark:text-orange-400' },
  { number: '100', label: 'Direitos Humanos', color: 'text-emerald-600 dark:text-emerald-400' },
];

export function EmergencyContacts({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Phone className="w-4 h-4 text-red-500" />
        Emergências
      </h3>
      <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
        {emergencyContacts.map((contact) => (
          <a
            key={contact.number}
            href={`tel:${contact.number}`}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-2 hover:ring-emerald-500 transition-all duration-200 group',
            )}
            aria-label={`Ligar para ${contact.label}: ${contact.number}`}
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-100 dark:group-hover:bg-red-500/20 transition-colors">
              <Phone className="w-4 h-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className={cn('text-lg font-bold leading-tight', contact.color)}>
                {contact.number}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {contact.label}
              </p>
            </div>
          </a>
        ))}
      </div>
      <a
        href="https://turismo.curitiba.pr.gov.br/conteudo/telefones-uteis/92"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Telefones úteis de Curitiba
      </a>
    </div>
  );
}
