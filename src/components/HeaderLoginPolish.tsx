export default function HeaderLoginPolish() {
  return (
    <style>{`
      /* “Entrar” tem ícone + texto e não pode herdar a caixa quadrada dos
         controles somente de ícone do cabeçalho desktop. */
      @media (min-width: 1024px) {
        header[role="banner"] > div > div > div:last-child > button[aria-label="Entrar"] {
          width: auto !important;
          min-width: max-content !important;
          height: 38px !important;
          min-height: 38px !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          line-height: 1 !important;
          overflow: hidden;
          white-space: nowrap;
        }
      }
    `}</style>
  );
}
