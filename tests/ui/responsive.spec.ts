import { expect, test, type Page } from '@playwright/test';
import { seedPlant } from './seed';

const PAGES = ['home', 'checklist', 'areas', 'panels', 'power', 'safety', 'networks', 'assets'] as const;

type Tier = 'mobile' | 'tablet' | 'desktop';

/** Expected layout tier for a viewport — mirrors LAYOUT_QUERY in js/utils.ts. */
function expectedTier(w: number, h: number): Tier {
  if (w >= 1200) return 'desktop';
  if (w >= 768 || (w > h && h <= 500)) return 'tablet';
  return 'mobile';
}

function shotPath(testInfo: { project: { name: string } }, name: string): string {
  return `test-results/ui/${testInfo.project.name}/${name}.png`;
}

/** Returns a list of human-readable layout violations (empty = OK). */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const tol = 1;
    const within = (sel: string, r: DOMRect) => {
      if (r.left < -tol || r.top < -tol || r.right > vw + tol || r.bottom > vh + tol)
        problems.push(`${sel} outside viewport: ${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)} (vp ${vw}×${vh})`);
    };
    if (document.documentElement.scrollWidth > vw + tol)
      problems.push(`horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);

    const app = document.getElementById('app')!.getBoundingClientRect();
    if (Math.abs(app.height - vh) > tol) problems.push(`#app height ${app.height} ≠ viewport ${vh}`);
    within('#app', app);

    for (const sel of ['#app-header', '#bottom-nav']) {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) problems.push(`${sel} not rendered`);
      else within(sel, r);
    }
    // Nav buttons must keep a usable touch target.
    for (const b of document.querySelectorAll<HTMLElement>('.nav-btn')) {
      const r = b.getBoundingClientRect();
      if (r.height < 40) problems.push(`.nav-btn[data-page=${b.dataset.page}] only ${Math.round(r.height)}px tall`);
      within(`.nav-btn[data-page=${b.dataset.page}]`, r);
    }
    for (const sel of ['.form-sheet.open', '.qa-modal.open', '.confirm-backdrop.open .confirm-box']) {
      const o = document.querySelector(sel);
      if (o) within(sel, o.getBoundingClientRect());
    }
    const detail = document.querySelector('#detail-panel.open, body[data-layout=desktop] #detail-panel');
    if (detail) within('#detail-panel', detail.getBoundingClientRect());
    return problems;
  });
}

/**
 * Waits for open/close transitions (sheet slide, detail slide-in) to finish.
 * Pass the selector the opener adds (via a double requestAnimationFrame) so the
 * wait can't start before the transition does.
 */
async function settle(page: Page, openedSelector?: string) {
  if (openedSelector) await page.waitForSelector(openedSelector);
  else await page.waitForTimeout(60);
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => undefined))));
}

async function goTo(page: Page, name: string) {
  await page.click(`.nav-btn[data-page="${name}"]`);
  await expect(page.locator(`.nav-btn[data-page="${name}"]`)).toHaveClass(/active/);
  await settle(page);
}

async function headerButtons(page: Page) {
  return page.evaluate(() => ({
    back: getComputedStyle(document.getElementById('back-btn')!).visibility === 'visible',
    add:  getComputedStyle(document.getElementById('add-btn')!).visibility === 'visible',
  }));
}

async function openFirstAsset(page: Page) {
  await goTo(page, 'assets');
  await page.locator('#app-main .card').first().click();
  await settle(page, 'body[data-layout=desktop] #detail-panel .det-name-row, #detail-panel.open');
}

test.beforeEach(async ({ page }) => {
  await seedPlant(page);
});

test('every page lays out within the viewport', async ({ page }, testInfo) => {
  const vp = page.viewportSize()!;
  await expect(page.locator('body')).toHaveAttribute('data-layout', expectedTier(vp.width, vp.height));

  const problems: string[] = [];
  for (const name of PAGES) {
    await goTo(page, name);
    await page.screenshot({ path: shotPath(testInfo, `page-${name}`) });
    problems.push(...(await layoutProblems(page)).map(p => `[${name}] ${p}`));
  }
  expect(problems).toEqual([]);
});

test('detail, form sheet, quick add and confirm dialog fit the viewport', async ({ page }, testInfo) => {
  const problems: string[] = [];
  const check = async (label: string) => {
    await page.screenshot({ path: shotPath(testInfo, label) });
    problems.push(...(await layoutProblems(page)).map(p => `[${label}] ${p}`));
  };

  await openFirstAsset(page);
  await check('detail-asset');

  // Header rule: overlay detail (mobile/tablet) → Back shown, Add hidden.
  const tier = await page.locator('body').getAttribute('data-layout');
  const hdr = await headerButtons(page);
  if (tier !== 'desktop') expect(hdr).toEqual({ back: true, add: false });
  else expect(hdr).toEqual({ back: false, add: true });

  await page.evaluate(async () => {
    const app = await import(/* @vite-ignore */ '/js/app.ts');
    await app.openSheet('panels', 'p1');
  });
  await settle(page, '#form-sheet.open');
  await check('form-sheet');
  await page.click('#form-cancel');
  await settle(page);

  await page.evaluate(async () => {
    const qa = await import(/* @vite-ignore */ '/js/renderers/quick-add.ts');
    qa.openQuickAdd('areas');
  });
  await settle(page, '#qa-modal.open');
  await check('quick-add');
  await page.click('#qa-cancel');
  await settle(page);

  await page.evaluate(async () => {
    const st = await import(/* @vite-ignore */ '/js/state.ts');
    void st.confirm('Delete this item?', 'This permanently removes “Line 1 PLC Rack” and cannot be undone.');
  });
  await settle(page, '#confirm-backdrop.open');
  await check('confirm');

  expect(problems).toEqual([]);
});

test('rotating with a detail open re-lays out consistently', async ({ page }, testInfo) => {
  const start = page.viewportSize()!;
  await openFirstAsset(page);

  const sizes = [
    { width: start.height, height: start.width, label: 'rotated' },
    { width: start.width,  height: start.height, label: 'restored' },
  ];
  for (const s of sizes) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await settle(page);
    const tier = expectedTier(s.width, s.height);
    await expect(page.locator('body')).toHaveAttribute('data-layout', tier);
    await page.screenshot({ path: shotPath(testInfo, `rotate-${s.label}`) });

    expect(await layoutProblems(page), `layout after ${s.label}`).toEqual([]);
    // The selected item must still be on screen after the tier change.
    await expect(page.locator('#detail-panel .det-name, #detail-panel .det-name-input').first()).toBeInViewport();
    const hdr = await headerButtons(page);
    if (tier !== 'desktop') expect(hdr, `header after ${s.label}`).toEqual({ back: true, add: false });
    else expect(hdr, `header after ${s.label}`).toEqual({ back: false, add: true });
  }

  // Closing from the restored layout returns to a clean list header.
  if (expectedTier(start.width, start.height) !== 'desktop') {
    await page.click('#back-btn');
    await settle(page);
    expect(await headerButtons(page)).toEqual({ back: false, add: true });
    await expect(page.locator('#detail-panel')).not.toBeInViewport();
  }
});

test('crossing the desktop breakpoint keeps the detail pane coherent', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'desktop resize only');
  // Nothing selected: shrink to tablet → no stray placeholder pane on screen.
  await goTo(page, 'areas');
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(page);
  await expect(page.getByText('Select an item')).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 800 });
  await settle(page);
  await expect(page.locator('#detail-panel')).not.toBeInViewport();
  await page.screenshot({ path: shotPath(testInfo, 'resize-tablet-empty') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(page);
  await expect(page.getByText('Select an item')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
});
