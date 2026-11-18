import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Le build est déposé dans le backend, qui le sert en production.
    // emptyOutDir est requis : Vite refuse de vider un dossier hors de son root.
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Le front appelle toujours /api en relatif : en dev ce proxy renvoie vers
    // Express, en prod les deux sont sur la même origine.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
