import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// DEMO_SINGLEFILE=1 gera um único .html autocontido (modo demonstração).
const single = process.env.DEMO_SINGLEFILE === '1';

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  esbuild: {
    // O que ajuda a depurar não precisa viajar até o navegador de quem joga.
    drop: ['debugger'],
    legalComments: 'none',
  },
  build: {
    outDir: single ? 'dist-demo' : 'dist',
    emptyOutDir: true,
    // A demonstração é um arquivo só por desenho — dividir em pedaços não
    // faria sentido aqui, então o aviso de "pacote grande" não se aplica.
    chunkSizeWarningLimit: single ? 2000 : 700,
    ...(single
      ? { cssCodeSplit: false, assetsInlineLimit: 100000000 }
      : {
        rollupOptions: {
          output: {
            // No build normal, o React vai num pedaço à parte: ele quase
            // nunca muda, e assim o navegador reaproveita o cache dele.
            manualChunks: { react: ['react', 'react-dom'] },
          },
        },
      }),
  },
});
