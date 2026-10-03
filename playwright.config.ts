import { defineConfig, devices } from '@playwright/test';

/**
 * Responsive UI suite (tests/ui): renders every page in portrait and landscape
 * on iOS (WebKit), Android (Chromium) and desktop viewports, asserting layout
 * invariants and saving a screenshot set to test-results/ui/<project>/ for review.
 *
 * Limits: Playwright cannot emulate iOS safe-area insets or the installed-PWA
 * (standalone) viewport, so those still need a check on a real device.
 */
const PORT = 5199;

export default defineConfig({
  testDir: 'tests/ui',
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // vite dev registers a dev-mode service worker; keep it out of the way.
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'iphone-15-portrait',  use: { ...devices['iPhone 15'] } },
    { name: 'iphone-15-landscape', use: { ...devices['iPhone 15 landscape'] } },
    { name: 'iphone-se-landscape', use: { ...devices['iPhone SE landscape'] } },
    { name: 'pixel-7-portrait',    use: { ...devices['Pixel 7'] } },
    { name: 'pixel-7-landscape',   use: { ...devices['Pixel 7 landscape'] } },
    { name: 'ipad-pro-portrait',   use: { ...devices['iPad Pro 11'] } },
    { name: 'ipad-pro-landscape',  use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'desktop-1440',        use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-1024',        use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
  ],
});
