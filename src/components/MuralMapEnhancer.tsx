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

        // Oculta somente a ação antiga do card. O botão novo fica dentro de
        // [data-nmb-mural-address] e não pode ser ocultado pelo observer.
        for (const button of Array.from(card.querySelectorAll<HTMLButtonElement>('button'))) {
          const isEnhancedButton = Boolean(button.closest('[data-nmb-mural-address]'));
          const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
          if (!isEnhancedButton && text === 'Ver no mapa') button.style.display = 'none';
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
        const hasCoordinates = event.latitude != null && event.longitude != null;

        return createPortal(
          <div className="nmb-mural-map-row mt-4 pt-3 border-t border-slate-100 dark:border-slate-800" data-nmb-mural-address>
            <div className="nmb-mural-address-card">
              <div className="nmb-mural-address-icon">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="nmb-mural-address-kicker">Endereço informado</p>
                <p className="nmb-mural-address-text">{event.location}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {area && <p className="nmb-mural-address-area">{area}</p>}
                  <span className={`nmb-location-precision ${hasCoordinates ? 'is-exact' : 'is-approximate'}`}>
                    {hasCoordinates ? 'Localizado no mapa' : 'Posição aproximada'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openExactMap(eventId)}
              className="nmb-mural-map-button"
              data-nmb-exact-map
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
