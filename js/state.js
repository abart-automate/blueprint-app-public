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
  detailSlotNetworkPorts:[],   // Array of network port entries for an in-edit Controller/Communication card

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
  formSlotNetworkPorts:[],   // Array of network port entries for an in-edit Controller/Communication slot form
  // --- Data cache (populated by refreshAll / loadCache) ---
  cache: { partsLibrary: [] },
  refs:  {},

  // --- Picker ---
  pickerMeta: null,
};

/* ---- DOM REFERENCES ---- */

const $ = id => document.getElementById(id);
const el = {
  header:       $('app-header'),
  main:         $('app-main'),
  backBtn:      $('back-btn'),
  addBtn:       $('add-btn'),
  pageTitle:    $('page-title'),
  detail:       $('detail-panel'),
  resizeHandle: $('detail-resize-handle'), // drag handle between list and detail panes (desktop)
  backdrop:     $('sheet-backdrop'),
  sheet:        $('form-sheet'),
  formTitle:    $('form-title'),
  formBody:     $('form-body'),
  formSave:     $('form-save'),
  formCancel:   $('form-cancel'),
  confirmBD:    $('confirm-backdrop'),
  confirmT:     $('confirm-title'),
  confirmM:     $('confirm-msg'),
  confirmNo:    $('confirm-no'),
  confirmSave:  $('confirm-save'),   // 3rd button used only by confirmUnsaved()
  confirmYes:   $('confirm-yes'),
  promptBD:     $('prompt-backdrop'),
  promptT:      $('prompt-title'),
  promptM:      $('prompt-msg'),
  promptField:  $('prompt-input'),
  promptCancel: $('prompt-cancel'),
  promptOk:     $('prompt-ok'),
  toast:        $('toast'),
  nav:          $('bottom-nav'),
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

/**
 * Shows the shared Yes/Cancel confirm dialog.
 * Labels/class are set on open and restored to the HTML defaults on cleanup, so
 * callers never need to mutate el.confirmYes/el.confirmNo directly — every dialog
 * declares its own button text instead of inheriting whatever a previous caller left.
 */
function confirm(title, msg, { yesLabel = 'Delete', noLabel = 'Cancel', yesClass = 'btn-danger' } = {}) {
  return new Promise(resolve => {
    el.confirmT.textContent  = title;
    el.confirmM.textContent  = msg;
    el.confirmYes.textContent = yesLabel;
    el.confirmNo.textContent  = noLabel;
    el.confirmYes.className   = `btn ${yesClass}`;
    el.confirmBD.classList.add('open');
    const yes = () => { cleanup(); resolve(true); };
    const no  = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      el.confirmBD.classList.remove('open');
      el.confirmYes.textContent = 'Delete';
      el.confirmNo.textContent  = 'Cancel';
      el.confirmYes.className   = 'btn btn-danger';
      el.confirmYes.removeEventListener('click', yes);
      el.confirmNo.removeEventListener('click', no);
    };
    el.confirmYes.addEventListener('click', yes);
    el.confirmNo.addEventListener('click', no);
  });
}

/**
 * Shows a 3-button dialog laid out left-to-right.
 * Returns: 'cancel' | 'mid' | 'yes'
 * Button classes are restored to their HTML defaults on cleanup.
 */
function confirmThreeWay(title, msg, { cancelLabel, midLabel, midClass, yesLabel, yesClass }) {
  return new Promise(resolve => {
    el.confirmT.textContent      = title;
    el.confirmM.textContent      = msg;
    el.confirmNo.textContent     = cancelLabel;
    el.confirmSave.textContent   = midLabel;
    el.confirmYes.textContent    = yesLabel;
    el.confirmSave.className     = `btn ${midClass}`;
    el.confirmYes.className      = `btn ${yesClass}`;
    el.confirmSave.style.display = '';
    el.confirmBD.classList.add('open');

    const onCancel = () => { cleanup(); resolve('cancel'); };
    const onMid    = () => { cleanup(); resolve('mid');    };
    const onYes    = () => { cleanup(); resolve('yes');    };
    const cleanup  = () => {
      el.confirmBD.classList.remove('open');
      el.confirmSave.style.display = 'none';
      el.confirmNo.textContent     = 'Cancel';   // restore HTML defaults
      el.confirmSave.textContent   = 'Save Changes';
      el.confirmYes.textContent    = 'Delete';
      el.confirmSave.className     = 'btn btn-primary';
      el.confirmYes.className      = 'btn btn-danger';
      el.confirmNo.removeEventListener('click', onCancel);
      el.confirmSave.removeEventListener('click', onMid);
      el.confirmYes.removeEventListener('click', onYes);
    };
    el.confirmNo.addEventListener('click', onCancel);
    el.confirmSave.addEventListener('click', onMid);
    el.confirmYes.addEventListener('click', onYes);
  });
}

/**
 * Shows a 3-button "unsaved changes" dialog (left-to-right).
 * Resolves with: 'save' | 'discard' | null (cancel)
 */
function confirmUnsaved(title, msg) {
  return confirmThreeWay(title, msg, {
    cancelLabel: 'Cancel',
    midLabel:    'Save Changes', midClass: 'btn-primary',
    yesLabel:    'Discard',      yesClass: 'btn-danger',
  }).then(r => r === 'mid' ? 'save' : r === 'yes' ? 'discard' : null);
}

/**
 * Shows a text-input prompt dialog.
 * Resolves with the trimmed string the user entered, or null if cancelled.
 * Requires a non-empty value — blank submission shakes the input and re-focuses.
 */
function promptInput(title, msg, defaultValue = '') {
  return new Promise(resolve => {
    el.promptT.textContent = title;
    el.promptM.textContent = msg;
    el.promptField.value   = defaultValue;
    el.promptBD.classList.add('open');
    requestAnimationFrame(() => { el.promptField.focus(); el.promptField.select(); });

    const submit = () => {
      const val = el.promptField.value.trim();
      if (!val) {
        el.promptField.classList.add('field-invalid');
        setTimeout(() => el.promptField.classList.remove('field-invalid'), 600);
        el.promptField.focus();
        return;
      }
      cleanup(); resolve(val);
    };
    const cancel = () => { cleanup(); resolve(null); };
    const onKey  = e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); };

    const cleanup = () => {
      el.promptBD.classList.remove('open');
      el.promptOk.removeEventListener('click', submit);
      el.promptCancel.removeEventListener('click', cancel);
      el.promptField.removeEventListener('keydown', onKey);
    };
    el.promptOk.addEventListener('click', submit);
    el.promptCancel.addEventListener('click', cancel);
    el.promptField.addEventListener('keydown', onKey);
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
