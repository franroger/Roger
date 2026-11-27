import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pagina = process.env.VITE_MODO === 'pagina';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 3000,
    // A versão em página única precisa de um só arquivo JavaScript.
    rollupOptions: pagina ? { output: { inlineDynamicImports: true } } : {},
  },
});
