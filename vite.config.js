import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.vrm', '**/*.glb', '**/*.vrma'],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
