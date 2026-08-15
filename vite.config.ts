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

// https://vite.dev/config/
export default defineConfig({
  plugins: [fixFeedCommentDelete, react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
