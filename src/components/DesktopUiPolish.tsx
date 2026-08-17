import { useEffect } from 'react';

export default function DesktopUiPolish() {
  useEffect(() => {
    let frame = 0;

    const syncMapHeatUi = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
          const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
          if (label !== 'Calor ativo' && label !== 'Mostrar calor') return;
          button.style.display = 'none';
          button.setAttribute('aria-hidden', 'true');
          button.tabIndex = -1;
        });

        document.querySelectorAll<HTMLSpanElement>('span').forEach((span) => {
          if ((span.textContent || '').trim() !== 'Intensidade') return;
          const legend = span.parentElement;
          if (!legend) return;
          legend.style.display = 'none';
          const divider = legend.previousElementSibling as HTMLElement | null;
          if (divider?.className.includes('w-px')) divider.style.display = 'none';
        });
      });
    };

    syncMapHeatUi();
    const observer = new MutationObserver(syncMapHeatUi);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', syncMapHeatUi);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('hashchange', syncMapHeatUi);
    };
  }, []);

  return (
    <style>{`
      @media (min-width: 768px) {
        .nmb-admin-mobile {
          display: none !important;
        }
      }

      @media (min-width: 1024px) {
        header[role="banner"] > div {
          max-width: 1680px !important;
          padding-left: 18px !important;
          padding-right: 18px !important;
        }

        header[role="banner"] > div > div {
          min-height: 68px;
          gap: 10px !important;
        }

        header[role="banner"] > div > div > div:first-child {
          min-width: 0;
          gap: 9px !important;
          align-items: center;
        }

        header[role="banner"] > div > div > div:first-child > button:last-child {
          min-width: 0;
          max-width: 136px;
          padding: 6px 8px !important;
          overflow: hidden;
        }

        header[role="banner"] > div > div > div:first-child > button:last-child > div {
          min-width: 0;
        }

        header[role="banner"] nav[aria-label="Navegação principal"] {
          min-width: 0;
          flex: 1 1 auto;
          justify-content: center;
          align-items: center;
          gap: 3px;
          padding: 4px;
          overflow: hidden;
          border: 1px solid rgb(226 232 240 / .82);
          border-radius: 16px;
          background: rgb(248 250 252 / .74);
        }

        .dark header[role="banner"] nav[aria-label="Navegação principal"] {
          border-color: rgb(51 65 85 / .72);
          background: rgb(15 23 42 / .38);
        }

        header[role="banner"] nav[aria-label="Navegação principal"] > button {
          min-height: 38px;
          min-width: 38px;
          border-radius: 12px;
          padding-left: 9px !important;
          padding-right: 9px !important;
          justify-content: center;
          align-items: center;
          line-height: 1;
        }

        header[role="banner"] nav[aria-label="Navegação principal"] > button svg,
        header[role="banner"] > div > div > div:last-child button svg {
          display: block;
          flex: 0 0 auto;
        }

        header[role="banner"] > div > div > div:last-child {
          position: relative;
          z-index: 3;
          gap: 5px !important;
          flex: 0 0 auto;
          align-items: center;
          min-height: 40px;
        }

        /* Apenas controles de ícone recebem caixa quadrada. Antes essa regra também
           pegava “Entrar”, comprimindo o texto e empurrando busca/download. */
        header[role="banner"] > div > div > div:last-child > button[aria-label]:not(.nmb-admin-mobile) {
          width: 38px;
          height: 38px;
          min-width: 38px;
          min-height: 38px;
          padding: 0 !important;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 0;
        }

        /* Botões com texto, como Entrar, preservam largura natural. */
        header[role="banner"] > div > div > div:last-child > button:not([aria-label]) {
          width: auto !important;
          min-width: max-content;
          height: 38px;
          min-height: 38px;
          padding-left: 12px !important;
          padding-right: 12px !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        header[role="banner"] .nmb-admin-mobile {
          display: none !important;
        }

        .leaflet-control-zoom a {
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-weight: 800 !important;
          text-align: center !important;
        }
      }

      /* Camadas e categorias do mapa usam a mesma linha-base visual. */
      [aria-label="Camadas do mapa"] > button,
      [aria-label="Categorias dos relatos"] > button {
        min-height: 44px;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        vertical-align: middle;
      }

      [aria-label="Camadas do mapa"] > button > span,
      [aria-label="Categorias dos relatos"] > button > span {
        line-height: 1 !important;
      }

      [aria-label="Camadas do mapa"] > button svg,
      [aria-label="Categorias dos relatos"] > button svg {
        display: block;
        flex: 0 0 auto;
      }

      /* Desktop compacto/notebook: preserva todos os destinos, mas usa ícones
         para impedir que o filtro ou as ações entrem por baixo da navegação. */
      @media (min-width: 1024px) and (max-width: 1439px) {
        header[role="banner"] nav[aria-label="Navegação principal"] > button > span,
        header[role="banner"] .nmb-admin-nav-label {
          display: none !important;
        }

        header[role="banner"] > div > div > div:first-child > button:first-child > div:last-child {
          display: none !important;
        }

        header[role="banner"] > div > div > div:first-child > button:last-child {
          max-width: 104px;
        }

        header[role="banner"] > div > div > div:first-child > button:last-child span:first-child {
          display: none;
        }
      }

      /* Em desktop amplo os nomes voltam, com espaço suficiente para Admin e ações. */
      @media (min-width: 1440px) {
        header[role="banner"] nav[aria-label="Navegação principal"] > button {
          padding-left: 11px !important;
          padding-right: 11px !important;
        }

        header[role="banner"] .nmb-admin-nav-label {
          display: inline !important;
        }
      }
    `}</style>
  );
}
