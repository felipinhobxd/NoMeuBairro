export default function DesktopUiPolish() {
  return (
    <style>{`
      @media (min-width: 1024px) {
        header[role="banner"] > div > div {
          min-height: 68px;
        }

        header[role="banner"] nav[aria-label="Navegação principal"] {
          gap: 3px;
          padding: 4px;
          border: 1px solid rgb(226 232 240 / .8);
          border-radius: 16px;
          background: rgb(248 250 252 / .72);
        }

        .dark header[role="banner"] nav[aria-label="Navegação principal"] {
          border-color: rgb(51 65 85 / .72);
          background: rgb(15 23 42 / .38);
        }

        header[role="banner"] nav[aria-label="Navegação principal"] > button {
          min-height: 38px;
          border-radius: 12px;
        }

        header[role="banner"] > div > div > div:last-child > button {
          width: 38px;
          height: 38px;
          padding: 0;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .leaflet-control-zoom a {
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-weight: 800 !important;
        }
      }
    `}</style>
  );
}
