
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 'base' impostato a './' permette all'app di funzionare in qualsiasi sottocartella (come su GitHub Pages)
  base: './',
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  server: {
    port: 3000,
    open: true
  }
});
