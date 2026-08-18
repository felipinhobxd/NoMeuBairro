import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    // Mantém o PWA utilizável também em navegadores móveis menos recentes.
    target: 'es2019',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) return undefined;
          if (normalized.includes('/leaflet/') || normalized.includes('/react-leaflet/')) return 'vendor-maps';
          if (normalized.includes('/@supabase/')) return 'vendor-supabase';
          if (normalized.includes('/lucide-react/')) return 'vendor-icons';
          if (normalized.includes('/react/') || normalized.includes('/react-dom/') || normalized.includes('/react-router') || normalized.includes('/@remix-run/')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
