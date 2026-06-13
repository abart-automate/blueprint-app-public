/* ============================================================
   APPLICATION STATE & DOM REFERENCES
   Central state object, DOM element cache, toast/confirm UI,
   and cache/refs helpers. Loaded before app.js.
   ============================================================ */

const state = {
  // --- Navigation ---
  page: 'home',

  // --- Detail panel ---
  detailType:       null,
  detailId:         null,
  detailStack:      [],
  detailSlotNumber: null,
  detailChanges:    {},        // pending field-level edits (key → value)
  // Editable media and table state for the detail panel, mirroring the form state pattern.
  // Initialized from the current item when the detail opens; cleared on save/discard/close.
  detailImages:          [],   // Array<{blob, mimeType}> for the "Other Media" gallery
  detailNamedPhotos:     {},   // { [slotName]: Array<{blob, mimeType}> } for required photo slots
  detailMediaDirty:      false, // true after any add/remove so navigation guard fires
  detailItemTables:      {},   // { [tableKey]: Array<{terminal, label}> } for wiring tables
  detailSwitchNetworks:  [],   // Array of switch network rows (managed switch assets only)
  detailSwitchPorts:     [],   // Array of switch port rows (managed switch assets only)
  detailSlotIoPoints:    [],   // Array of IO point rows for an in-edit PLC slot card
  detailSlotPowerBus:    [],   // Array of power-bus entries for an in-edit PLC slot card

  // --- Active form ---
  formType:            null,
  formId:              null,
  formPreset:          null,
  formImages:          [],
  formNamedPhotos:     {},
  formItemTables:      {},
  formSwitchNetworks:  [],
  formSwitchPorts:     [],
  formIoPoints:        [],
  formPowerBus:        [],
  formDuplicateSource: null,

  // --- Data cache (populated by refreshAll / loadCache) ---
  cache: { partsLibrary: [] },
  refs:  {},

  // --- Picker ---
  pickerMeta: null,
};

/* ---- DOM REFERENCES ---- */

const $ = id => document.getElementById(id);
const el = {
  header:    $('app-header'),
  main:      $('app-main'),
  backBtn:   $('back-btn'),
  addBtn:    $('add-btn'),
  pageTitle: $('page-title'),
  detail:    $('detail-panel'),
  backdrop:  $('sheet-backdrop'),
  sheet:     $('form-sheet'),
  formTitle: $('form-title'),
  formBody:  $('form-body'),
  formSave:  $('form-save'),
  formCancel:$('form-cancel'),
  confirmBD:   $('confirm-backdrop'),
  confirmT:    $('confirm-title'),
  confirmM:    $('confirm-msg'),
  confirmNo:   $('confirm-no'),
  confirmSave: $('confirm-save'),   // 3rd button used only by confirmUnsaved()
  confirmYes:  $('confirm-yes'),
  toast:     $('toast'),
  nav:       $('bottom-nav'),
};

/* ---- TOAST ---- */

let toastTimer = null;
function showToast(msg, type = '') {
  el.toast.textContent = msg;
  el.toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.className = 'toast'; }, 2800);
}

/* ---- CONFIRM DIALOG ---- */

function confirm(title, msg) {
  return new Promise(resolve => {
    el.confirmT.textContent = title;
    el.confirmM.textContent = msg;
    el.confirmBD.classList.add('open');
    const yes = () => { cleanup(); resolve(true); };
    const no  = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      el.confirmBD.classList.remove('open');
      el.confirmYes.removeEventListener('click', yes);
      el.confirmNo.removeEventListener('click', no);
    };
    el.confirmYes.addEventListener('click', yes);
    el.confirmNo.addEventListener('click', no);
  });
}

/**
 * Shows a 3-button "unsaved changes" dialog.
 * Resolves with: 'save' — user wants to save then proceed
 *                'discard' — user wants to discard and proceed
 *                null — user cancelled (stay on page)
 */
function confirmUnsaved(title, msg) {
  return new Promise(resolve => {
    el.confirmT.textContent     = title;
    el.confirmM.textContent     = msg;
    el.confirmNo.textContent    = 'Cancel';
    el.confirmSave.textContent  = 'Save Changes';
    el.confirmYes.textContent   = 'Discard';
    el.confirmSave.style.display = '';
    el.confirmBD.querySelector('.confirm-actions').classList.add('confirm-stacked');
    el.confirmBD.classList.add('open');

    const onSave    = () => { cleanup(); resolve('save');    };
    const onDiscard = () => { cleanup(); resolve('discard'); };
    const onCancel  = () => { cleanup(); resolve(null);      };
    const cleanup = () => {
      el.confirmBD.classList.remove('open');
      el.confirmSave.style.display = 'none';
      el.confirmBD.querySelector('.confirm-actions').classList.remove('confirm-stacked');
      el.confirmSave.removeEventListener('click', onSave);
      el.confirmYes.removeEventListener('click', onDiscard);
      el.confirmNo.removeEventListener('click', onCancel);
    };
    el.confirmSave.addEventListener('click', onSave);
    el.confirmYes.addEventListener('click', onDiscard);
    el.confirmNo.addEventListener('click', onCancel);
  });
}

/* ---- CACHE & REFS ---- */

async function loadCache(storeNames) {
  await Promise.all(storeNames.map(async name => {
    state.cache[name] = await getAll(name);
    state.refs[name]  = Object.fromEntries(state.cache[name].map(i => [i.id, i]));
  }));
}

async function refreshAll() {
  await loadCache(['areas','panels','power','safety','networks','assets']);
}
