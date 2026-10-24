import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    // Allow sharing the dev server through a Cloudflare quick tunnel (*.trycloudflare.com)
    // or VS Code port forwarding (*.devtunnels.ms).
    allowedHosts: ['.trycloudflare.com', '.devtunnels.ms'],
    fs: {
      // Vite's defaults plus local credential files, so a shared dev server never serves them.
      deny: [
        '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
        '**/logins.txt', '**/scripts/data/**', '**/.wrangler/**', '**/.dev.vars*',
      ],
    },
  },
})
