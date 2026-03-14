import { defineConfig } from '@playwright/test'

const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND
  || 'python3 -m http.server 4173 --directory dist --bind 127.0.0.1'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command: webServerCommand,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
