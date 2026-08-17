import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./ux-polish.css";
import App from "./App";

// O botão "Ver mapa" do Feed já navega para /mapa. Antes da navegação,
// guardamos qual card originou o clique para o mapa abrir exatamente naquele ponto.
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest("button");
  if (!button || button.textContent?.trim() !== "Ver mapa") return;

  const postCard = button.closest('[id^="post-"]') as HTMLElement | null;
  const postId = postCard?.id.replace(/^post-/, "");
  if (!postId) return;

  try {
    sessionStorage.setItem("anb-map-focus-post", postId);
  } catch {
    // Navegação continua funcionando mesmo se o storage estiver indisponível.
  }
}, true);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Não foi possível registrar o modo aplicativo:', error);
    });
  });
}
