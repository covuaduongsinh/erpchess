import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Engine Arasan (WASM + pthreads) cần SharedArrayBuffer → trang phải cross-origin isolated.
// Production đặt cùng header trong vercel.json; desktop đặt trong tauri.conf.json.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Tauri (apps/desktop) dùng chính bản build này; giữ cổng cố định để `tauri dev` trỏ tới.
export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  clearScreen: false,
  server: { port: 5173, strictPort: true, headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'es2023', sourcemap: true },
  test: {
    environment: 'jsdom',
  },
});
