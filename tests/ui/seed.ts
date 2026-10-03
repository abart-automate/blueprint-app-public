import type { Page } from '@playwright/test';

/**
 * Seeds IndexedDB with a small, fully-linked plant so list pages and detail
 * panes render real content. Writes through the dev server's own db module
 * (same module instance the running app uses), then reloads the page.
 */
export async function seedPlant(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('.nav-btn.active');
  await page.evaluate(async () => {
    const db = await import(/* @vite-ignore */ '/js/db.ts');
    const longText = 'Main production line serving packaging, palletising and outbound conveyors — includes a deliberately long description to exercise wrapping.';
    const put = (store: string, item: Record<string, unknown>) => db.upsert(store, item);
    await put('areas',    { id: 'a1', name: 'Packaging Hall North', description: longText });
    await put('areas',    { id: 'a2', name: 'Boiler House' });
    await put('panels',   { id: 'p1', name: 'MCC-101 Motor Control Centre', areaId: 'a1', description: longText });
    await put('power',    { id: 'w1', name: '480V Feeder 3', panelId: 'p1' });
    await put('safety',   { id: 's1', name: 'E-Stop Circuit Line 1', panelId: 'p1', powerId: 'w1' });
    await put('networks', { id: 'n1', name: 'Control LAN 10.10.0.0/24' });
    await put('assets',   { id: 'x1', name: 'Line 1 PLC Rack', assetClass: 'PLC', areaId: 'a1', panelId: 'p1', powerId: 'w1',
      slots: [
        { slotNumber: 0, cardType: 'Controller', partNumber: '1756-L83E' },
        { slotNumber: 1, cardType: 'Communication', partNumber: '1756-EN2T' },
      ] });
    await put('assets',   { id: 'x2', name: 'Core Switch Stratix 5700 with a very long asset name', assetClass: 'Network Switch', areaId: 'a1', panelId: 'p1', ipAddress: '10.10.0.2' });
    await put('assets',   { id: 'x3', name: 'Operator HMI PanelView', assetClass: 'HMI', areaId: 'a1', panelId: 'p1' });
  });
  await page.reload();
  await page.waitForSelector('.nav-btn.active');
}
