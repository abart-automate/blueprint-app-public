import type { EntityConfig, EntityType } from './entity-config.js';

import { ENTITY } from './entity-config.js';
import { $, el, state } from './state.js';
import { processImportFile, saveForm } from './operations.js';
import { closeDetail, closeSheet, initDetailResizeHandle, navigate, openSheet } from './app.js';
/* ============================================================
   EVENT WIRING
   Depends on: state.js, app.js (navigate, openSheet, closeDetail,
   closeSheet, saveForm), operations.js (processImportFile)
   ============================================================ */

export function wireEvents(): void {
  // Bottom nav — navigate is async; fire-and-forget is intentional here
  el.nav.addEventListener('click', e => {
    const btn = (e.target as Element | null)?.closest('.nav-btn');
    if (btn) navigate((btn as HTMLElement).dataset.page as string);
  });

  // Back button — closeDetail is async; must await so the confirm dialog
  // blocks any further action until the user responds
  el.backBtn.addEventListener('click', async () => {
    if (state.detailType) {
      await closeDetail();
    }
  });

  // Add button — hidden on home and checklist pages (those have no add-entity action)
  el.addBtn.addEventListener('click', () => {
    if (state.page !== 'home' && state.page !== 'checklist') {
      openSheet(state.page as EntityType);
    }
  });

  // Form save / cancel
  el.formSave.addEventListener('click', saveForm);
  el.formCancel.addEventListener('click', closeSheet);

  // Backdrop tap closes sheet
  el.backdrop.addEventListener('click', closeSheet);

  // Hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    if ((ENTITY as Record<string, EntityConfig>)[hash] || hash === 'home' || hash === 'checklist') {
      if (hash !== state.page) navigate(hash);
    }
  });

  // Import file input
  ($('import-file-input') as HTMLElement).addEventListener('change', async e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await processImportFile(file);
      (e.target as HTMLInputElement).value = '';
    }
  });

  // Detail-pane drag-to-resize (desktop only — no-ops on mobile/tablet)
  initDetailResizeHandle();
}
