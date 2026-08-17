import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixFeedCommentDelete = {
  name: 'fix-feed-comment-delete',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/');
    if (!normalizedId.endsWith('/src/pages/Feed.tsx')) return null;

    const broken = '{showDelete && (';
    if (!code.includes(broken)) return null;

    return {
      code: code.replace(broken, '{(isAuthor || isPostOwner) && ('),
      map: null,
    };
  },
};

const addMapClustering = {
  name: 'add-map-clustering',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/');
    if (!normalizedId.endsWith('/src/pages/Mapa.tsx')) return null;
    if (code.includes('<MapClusterController />')) return null;

    const tileLayer = "          <TileLayer attribution='&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'";
    if (!code.includes(tileLayer)) return null;

    return {
      code: `import MapClusterController from '../components/MapClusterController';\n${code.replace(tileLayer, `          <MapClusterController />\n${tileLayer}`)}`,
      map: null,
    };
  },
};

const allowPublicLegalPages = {
  name: 'allow-public-legal-pages',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/');
    if (!normalizedId.endsWith('/src/components/Layout.tsx')) return null;
    const current = 'if (!isNeighborhoodSelected) {';
    if (!code.includes(current)) return null;
    return {
      code: code.replace(current, "if (!isNeighborhoodSelected && !['/privacidade', '/termos'].includes(location.pathname)) {"),
      map: null,
    };
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [fixFeedCommentDelete, addMapClustering, allowPublicLegalPages, react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
