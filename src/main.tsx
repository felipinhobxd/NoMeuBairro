import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./ux-polish.css";
import "./feed-profile.css";
import App from "./App";
import { reportProductionEvent, startProductionMonitoring } from "./utils/productionMonitoring";
import { startVLibrasAccessibility } from "./utils/vlibrasAccessibility";
import { initPwaInstall } from "./utils/pwaInstall";

initPwaInstall();
startProductionMonitoring();
const stopVLibrasAccessibility = startVLibrasAccessibility();
if (import.meta.hot) import.meta.hot.dispose(stopVLibrasAccessibility);

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
  let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
  let lastUpdateCheckAt = 0;
  const updateCheckIntervalMs = 15 * 60 * 1000;

  const ensurePwaServiceWorker = async () => {
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .catch((error) => {
          registrationPromise = null;
          throw error;
        });
    }

    const registration = await registrationPromise;
    const now = Date.now();
    if (now - lastUpdateCheckAt >= updateCheckIntervalMs) {
      lastUpdateCheckAt = now;
      await registration.update();
    }
    return registration;
  };

  const refreshPwaServiceWorker = () => {
    void ensurePwaServiceWorker().catch((error) => {
      console.warn('Não foi possível atualizar o modo aplicativo:', error);
      void reportProductionEvent({
        eventType: 'resource_error',
        code: 'resource.service_worker',
        target: 'service-worker',
      });
    });
  };

  window.addEventListener('load', refreshPwaServiceWorker, { once: true });
  window.addEventListener('pageshow', refreshPwaServiceWorker);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshPwaServiceWorker();
  });
}
