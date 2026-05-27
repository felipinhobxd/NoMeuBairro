import { useState, useEffect } from 'react';
import { usePanicButton, executePanic } from '../hooks/usePanicButton';
import { Shield, X, Phone, ExternalLink } from 'lucide-react';
import { cn } from '../utils/cn';

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
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('anb-cookie-consent');
      if (!consent) {
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('anb-cookie-consent', Date.now().toString());
    } catch {}
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  return (
    <div
      className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-slide-up"
      role="dialog"
      aria-label="Aviso de cookies"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 ring-1 ring-slate-200 dark:ring-slate-700 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
            <span className="text-lg" role="img" aria-hidden="true">🍪</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Privacidade e Cookies
              </h4>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Utilizamos cookies para melhorar sua experiência. Em conformidade com a{' '}
              <strong className="text-slate-600 dark:text-slate-300">LGPD</strong>, seus dados são protegidos
              e nunca compartilhados com terceiros.{' '}
              <a
                href="#"
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
                onClick={(e) => e.preventDefault()}
              >
                Política de privacidade
              </a>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className={cn(
                  'flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors',
                )}
              >
                Aceitar todos
              </button>
              <button
                onClick={handleDismiss}
                className={cn(
                  'flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors',
                )}
              >
                Apenas essenciais
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
        href="https://www.google.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Mais canais de atendimento
      </a>
    </div>
  );
}
