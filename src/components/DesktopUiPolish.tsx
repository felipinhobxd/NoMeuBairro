export default function DesktopUiPolish() {
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
        }

        header[role="banner"] > div > div > div:last-child {
          position: relative;
          z-index: 3;
          gap: 4px !important;
          flex: 0 0 auto;
        }

        /* Importante: não definir display aqui. Isso quebrava md:hidden e criava
           um segundo botão Admin no desktop, por cima do controle de tema. */
        header[role="banner"] > div > div > div:last-child > button {
          width: 38px;
          height: 38px;
          padding: 0;
          border-radius: 12px;
          align-items: center;
          justify-content: center;
        }

        header[role="banner"] .nmb-admin-mobile {
          display: none !important;
        }

        .leaflet-control-zoom a {
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-weight: 800 !important;
        }
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
