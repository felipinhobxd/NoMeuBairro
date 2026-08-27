export default function DesktopUiPolish() {
  return (
    <style>{`

      @media (max-width: 1023px) {
        header[role="banner"] > div {
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        header[role="banner"] > div > div {
          min-height: 62px !important;
          height: 62px !important;
          gap: 6px !important;
        }

        header[role="banner"] > div > div > div:first-child {
          min-width: 0;
          flex: 1 1 auto;
          gap: 4px !important;
        }

        header[role="banner"] button[aria-label="Ir para a página inicial"] {
          flex: 0 0 auto;
        }

        header[role="banner"] button[aria-label="Ir para a página inicial"] > div:first-child {
          width: 38px !important;
          height: 38px !important;
        }

        header[role="banner"] .nmb-neighborhood-filter {
          min-width: 0;
          max-width: min(43vw, 190px);
          padding: 5px 6px !important;
        }

        header[role="banner"] .nmb-neighborhood-filter > div {
          min-width: 0;
        }

        header[role="banner"] .nmb-neighborhood-filter span:last-child {
          max-width: 100% !important;
        }

        header[role="banner"] .nmb-header-actions {
          flex: 0 0 auto;
          gap: 2px !important;
        }

        /* No celular/tablet, ações secundárias ficam no menu Mais. */
        header[role="banner"] .nmb-header-theme,
        header[role="banner"] button[aria-label="Buscar no site"],
        header[role="banner"] button[aria-label="Instalar aplicativo"] {
          display: none !important;
        }

        header[role="banner"] .nmb-header-actions button[aria-label="Notificações"],
        header[role="banner"] .nmb-header-actions button[aria-label^="Perfil de"] {
          width: 40px !important;
          height: 40px !important;
          min-width: 40px !important;
          min-height: 40px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        main[role="main"] {
          overflow-x: clip;
        }

        main[role="main"] > div:first-child {
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        nav[aria-label="Navegação mobile"] button {
          min-height: 54px;
          touch-action: manipulation;
        }

        [aria-label="Camadas do mapa"],
        [aria-label="Categorias dos relatos"] {
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
        }

        [aria-label="Camadas do mapa"] > button,
        [aria-label="Categorias dos relatos"] > button {
          scroll-snap-align: start;
        }
      }

      @media (max-width: 380px) {
        header[role="banner"] > div {
          padding-left: 7px !important;
          padding-right: 7px !important;
        }

        header[role="banner"] button[aria-label="Ir para a página inicial"] > div:first-child {
          width: 34px !important;
          height: 34px !important;
        }

        header[role="banner"] .nmb-neighborhood-filter {
          max-width: 38vw;
        }

        header[role="banner"] .nmb-neighborhood-filter span:first-child {
          display: none;
        }

        header[role="banner"] .nmb-header-actions button[aria-label="Notificações"],
        header[role="banner"] .nmb-header-actions button[aria-label^="Perfil de"] {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          min-height: 36px !important;
        }
      }

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
          flex: 0 1 auto;
          width: max-content;
          max-width: 100%;
          justify-content: flex-start;
          align-items: center;
          gap: 3px;
          padding: 4px;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-inline: contain;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          border: 1px solid rgb(226 232 240 / .82);
          border-radius: 16px;
          background: rgb(248 250 252 / .74);
          box-shadow: 0 4px 14px rgb(15 23 42 / .05);
        }

        header[role="banner"] nav[aria-label="Navegação principal"]::-webkit-scrollbar {
          display: none;
        }

        .dark header[role="banner"] nav[aria-label="Navegação principal"] {
          border-color: rgb(51 65 85 / .72);
          background: rgb(15 23 42 / .38);
          box-shadow: 0 4px 18px rgb(0 0 0 / .16);
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

      /* Notebook: o cabeçalho ganha uma segunda linha só para a navegação.
         Assim nenhum controle é esmagado em 1024–1366 px, inclusive com fonte grande. */
      @media (min-width: 1024px) and (max-width: 1439px) {
        header[role="banner"] .nmb-header-row {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-rows: 48px 44px;
          height: auto !important;
          min-height: 102px !important;
          column-gap: 12px !important;
          row-gap: 4px !important;
          padding-top: 3px;
          padding-bottom: 3px;
          align-items: center;
        }

        header[role="banner"] .nmb-header-identity {
          grid-column: 1;
          grid-row: 1;
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        header[role="banner"] .nmb-header-home > div:last-child {
          display: flex !important;
        }

        header[role="banner"] .nmb-neighborhood-filter {
          max-width: min(48vw, 320px) !important;
        }

        header[role="banner"] .nmb-desktop-nav {
          grid-column: 1 / -1;
          grid-row: 2;
          width: max-content;
          max-width: 100%;
          min-width: 0;
          justify-self: center;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x proximity;
          padding: 3px !important;
          gap: 3px !important;
        }

        header[role="banner"] .nmb-desktop-nav > button {
          flex: 0 0 auto;
          width: auto !important;
          min-width: max-content !important;
          max-width: max-content;
          height: 38px;
          min-height: 38px;
          padding-left: 7px !important;
          padding-right: 7px !important;
          gap: 6px;
          scroll-snap-align: center;
        }

        header[role="banner"] .nmb-desktop-nav > button > span,
        header[role="banner"] .nmb-admin-nav-label {
          display: inline !important;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        header[role="banner"] .nmb-header-actions {
          grid-column: 2;
          grid-row: 1;
          align-self: center;
        }

        main[role="main"] > .nmb-page-shell {
          padding-top: 1.25rem !important;
          padding-bottom: 1.5rem !important;
        }

        main section + section {
          scroll-margin-top: 124px;
        }
      }

      /* Em notebooks baixos, recupera alguns pixels sem esconder controles. */
      @media (min-width: 1024px) and (max-width: 1439px) and (max-height: 760px) {
        header[role="banner"] .nmb-header-row {
          grid-template-rows: 44px 40px;
          min-height: 92px !important;
          row-gap: 2px !important;
          padding-top: 2px;
          padding-bottom: 2px;
        }

        header[role="banner"] .nmb-desktop-nav > button {
          height: 36px;
          min-height: 36px;
        }

        main[role="main"] > .nmb-page-shell {
          padding-top: 0.875rem !important;
        }
      }

      /* Entre 1440 e 1649 px a barra volta a uma linha e usa ícones compactos. */
      @media (min-width: 1440px) and (max-width: 1649px) {
        header[role="banner"] nav[aria-label="Navegação principal"] > button > span,
        header[role="banner"] .nmb-admin-nav-label {
          display: none !important;
        }
      }

      /* Em desktop amplo os nomes voltam, com espaço suficiente para Admin e ações. */
      @media (min-width: 1650px) {
        header[role="banner"] nav[aria-label="Navegação principal"] > button {
          padding-left: 11px !important;
          padding-right: 11px !important;
        }

        header[role="banner"] nav[aria-label="Navegação principal"] > button > span,
        header[role="banner"] .nmb-admin-nav-label {
          display: inline !important;
        }
      }
    `}</style>
  );
}
