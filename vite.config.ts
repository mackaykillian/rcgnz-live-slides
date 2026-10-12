import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// The Cloudflare plugin runs the Worker (worker/index.ts) inside workerd during
// `npm run dev`, with local R2 + .dev.vars, so dev matches production.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});
