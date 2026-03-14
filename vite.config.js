import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.vrm', '**/*.glb', '**/*.vrma'],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) {
            return 'react-vendor'
          }

          if (
            id.includes('node_modules/three/examples')
            || id.includes('node_modules/three/addons')
          ) {
            return 'three-addons'
          }

          if (id.includes('node_modules/three')) {
            return 'three-core'
          }

          if (
            id.includes('node_modules/@pixiv/three-vrm')
            || id.includes('node_modules/@pixiv/three-vrm-animation')
          ) {
            return 'vrm-vendor'
          }

          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['tests/browser/**'],
  },
})
