import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/the-empyrean-book-tracker/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
