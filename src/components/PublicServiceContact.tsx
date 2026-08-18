import { ExternalLink, Info, PhoneCall } from 'lucide-react';
import type { PostCategory } from '../types';
import { cn } from '../utils/cn';
import { getPublicServiceContact } from '../utils/publicServices';

export default function PublicServiceContact({
  category,
  compact = false,
}: {
  category: PostCategory;
  compact?: boolean;
}) {
  const contact = getPublicServiceContact(category);

  return (
    <aside
      className={cn(
        'rounded-2xl border border-sky-200 bg-sky-50/80 text-slate-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-slate-100',
        compact ? 'mt-3 p-3' : 'mt-4 p-4',
      )}
      aria-label={`Canal oficial indicado: ${contact.authority}`}
    >
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-100 dark:bg-slate-900 dark:text-sky-300 dark:ring-sky-500/20', compact ? 'p-2' : 'p-2.5')}>
          <PhoneCall className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">
            Canal oficial indicado: {contact.authority}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {contact.purpose}
          </p>
          <div className={cn('mt-3 flex gap-2', compact ? 'flex-wrap' : 'flex-col sm:flex-row')}>
            <a
              href={`tel:${contact.tel}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-800"
              aria-label={`Ligar para ${contact.authority} no número ${contact.phone}`}
            >
              <PhoneCall className="h-4 w-4" />
              Ligar {contact.phone}
            </a>
            <a
              href={contact.channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-sky-800 ring-1 ring-sky-200 transition-colors hover:bg-sky-100 dark:bg-slate-900 dark:text-sky-300 dark:ring-sky-500/30 dark:hover:bg-slate-800"
            >
              <ExternalLink className="h-4 w-4" />
              {contact.channelLabel}
            </a>
          </div>
          {contact.note && (
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
              {contact.note}
            </p>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Publicar no No Meu Bairro não abre um protocolo oficial automaticamente.
          </p>
        </div>
      </div>
    </aside>
  );
}
