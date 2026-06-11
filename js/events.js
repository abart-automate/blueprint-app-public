/* ============================================================
   EVENT WIRING
   Depends on: state.js, app.js (navigate, openSheet, closeDetail,
   closeSheet, saveForm), operations.js (processImportFile)
   ============================================================ */

function wireEvents() {
  // Bottom nav
  el.nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn) navigate(btn.dataset.page);
  });

  // Back button
  el.backBtn.addEventListener('click', () => {
    if (state.detailType) {
      closeDetail();
    }
  });

  // Add button — hidden on home and checklist pages (those have no add-entity action)
  el.addBtn.addEventListener('click', () => {
    if (state.page !== 'home' && state.page !== 'checklist') {
      openSheet(state.page);
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
    if (ENTITY[hash] || hash === 'home' || hash === 'checklist') {
      if (hash !== state.page) navigate(hash);
    }
  });

  // Import file input
  $('import-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) {
      await processImportFile(file);
      e.target.value = '';
    }
  });
}
