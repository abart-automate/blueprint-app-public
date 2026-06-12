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
  detailChanges:    {},

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
  cache: {},
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
  confirmBD: $('confirm-backdrop'),
  confirmT:  $('confirm-title'),
  confirmM:  $('confirm-msg'),
  confirmNo: $('confirm-no'),
  confirmYes:$('confirm-yes'),
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
