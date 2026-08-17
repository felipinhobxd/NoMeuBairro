import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { useData } from '../contexts/DataContext';

type TargetMap = Record<string, HTMLElement>;

export default function MuralMapEnhancer() {
  const { events } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [targets, setTargets] = useState<TargetMap>({});

  const eventById = useMemo(() => new Map(events.map(event => [event.id, event])), [events]);

  useEffect(() => {
    if (!location.pathname.startsWith('/mural')) {
      setTargets({});
      return;
    }

    const sync = () => {
      const next: TargetMap = {};
      for (const event of events) {
        const card = document.getElementById(`ev-${event.id}`);
        if (!card) continue;

        // O link antigo ia apenas para a visão geral. Escondemos para deixar uma única ação correta.
        for (const button of Array.from(card.querySelectorAll<HTMLButtonElement>('button'))) {
          if ((button.textContent || '').replace(/\s+/g, ' ').trim() === 'Ver no mapa') button.style.display = 'none';
        }
        next[event.id] = card;
      }

      setTargets(previous => {
        const previousKeys = Object.keys(previous);
        const nextKeys = Object.keys(next);
        const same = previousKeys.length === nextKeys.length && nextKeys.every(key => previous[key] === next[key]);
        return same ? previous : next;
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [events, location.pathname]);

  const openExactMap = (eventId: string) => {
    try {
      sessionStorage.removeItem('anb-map-focus-post');
      sessionStorage.setItem('anb-map-focus-event', eventId);
    } catch {}
    navigate('/mapa');
  };

  if (!location.pathname.startsWith('/mural')) return null;

  return (
    <>
      {Object.entries(targets).map(([eventId, target]) => {
        const event = eventById.get(eventId);
        if (!event || !event.location?.trim()) return null;
        const area = event.locality && event.neighborhood
          ? `${event.locality} · ${event.neighborhood}`
          : event.locality || event.neighborhood;

        return createPortal(
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3" data-nmb-mural-address>
            <div className="flex items-start gap-3 min-w-0 flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Endereço informado</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words mt-0.5">{event.location}</p>
                {area && <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{area}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => openExactMap(eventId)}
              className="min-h-11 shrink-0 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-black shadow-sm transition-all active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              Ver no mapa
            </button>
          </div>,
          target,
          `mural-map-${eventId}`,
        );
      })}
    </>
  );
}
