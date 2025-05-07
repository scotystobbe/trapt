import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    https: true,
    proxy: {
      '/api': 'http://localhost:3001', // or whatever port Vercel dev uses
    },
  }
});
