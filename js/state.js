// @ts-check
/* ============================================================
   APPLICATION STATE & DOM REFERENCES
   Central state object, DOM element cache, toast/confirm UI,
   and cache/refs helpers. Loaded before app.js.
   ============================================================ */

/**
 * A media item as held in state's *editable* image/photo arrays (already
 * normalized — see utils.js's normalizeMediaItems() for the raw stored-value
 * shapes this gets built from).
 * @typedef {{ blob: Blob, mimeType: string }} EditableMediaItem
 */

/** @typedef {{ terminal?: string, label?: string }} ItemTableRow */

/**
 * A single network-port entry, as used by both PLC slot Controller/
 * Communication cards (state.*SlotNetworkPorts) and HMI/Field Device assets
 * (state.*AssetNetworkPorts) — see utils.js's getEntityNetworkPorts().
 * @typedef {{ portNumber?: number, networkId: string, ipAddress?: string, nodeAddress?: string }} NetworkPortRow
 */

/**
 * Row shapes for the switch-network/switch-port/IO-point/power-bus tables are
 * still owned by renderers/tables.js (not yet typed) — kept as an honest
 * `Record<string, any>` placeholder here rather than guessed at.
 * @typedef {Record<string, any>} UntypedTableRow
 */

/**
 * @typedef {Object} State
 * @property {string} page
 *
 * @property {EntityType | null} detailType
 * @property {string | null} detailId
 * @property {Array<{ type: EntityType | null, id: string | null, slotNumber?: number | null }>} detailStack
 * @property {number | null} detailSlotNumber
 * @property {Record<string, any>} detailChanges - Pending field-level edits (key -> value).
 * @property {EditableMediaItem[]} detailImages - "Other Media" gallery.
 * @property {Record<string, EditableMediaItem[]>} detailNamedPhotos - Keyed by required-photo slot name.
 * @property {boolean} detailMediaDirty - True after any add/remove so the navigation guard fires.
 * @property {Record<string, ItemTableRow[]>} detailItemTables - Keyed by wiring-table key.
 * @property {UntypedTableRow[]} detailSwitchNetworks
 * @property {UntypedTableRow[]} detailSwitchPorts
 * @property {UntypedTableRow[]} detailSlotIoPoints
 * @property {UntypedTableRow[]} detailSlotPowerBus
 * @property {NetworkPortRow[]} detailSlotNetworkPorts - In-edit Controller/Communication card.
 * @property {NetworkPortRow[]} detailAssetNetworkPorts - In-edit HMI/Field Device asset (see ASSET_CLASS_NETWORK_PORTS).
 *
 * @property {FormType | null} formType
 * @property {string | null} formId
 * @property {Record<string, any> | null} formPreset - Polymorphic: {rackId,slotNumber} for a PLC slot form, or {field,value,extra,copyFrom} for an entity form preset.
 * @property {EditableMediaItem[]} formImages
 * @property {Record<string, EditableMediaItem[]>} formNamedPhotos
 * @property {Record<string, ItemTableRow[]>} formItemTables
 * @property {UntypedTableRow[]} formSwitchNetworks
 * @property {UntypedTableRow[]} formSwitchPorts
 * @property {UntypedTableRow[]} formIoPoints
 * @property {UntypedTableRow[]} formPowerBus
 * @property {NetworkPortRow[]} formSlotNetworkPorts - In-edit Controller/Communication slot form.
 * @property {NetworkPortRow[]} formAssetNetworkPorts - In-edit HMI/Field Device asset form.
 *
 * @property {Partial<Record<StoreName, DbRecord[]>>} cache - Populated by refreshAll/loadCache.
 * @property {Partial<Record<StoreName, Record<string, DbRecord>>>} refs
 *
 * @property {any} pickerMeta
 */

/** @type {State} */
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
  detailAssetNetworkPorts:[],  // Array of network port entries for an in-edit HMI/Field Device asset (see ASSET_CLASS_NETWORK_PORTS)

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
  formAssetNetworkPorts:[],  // Array of network port entries for an in-edit HMI/Field Device asset form

  // --- Data cache (populated by refreshAll / loadCache) ---
  cache: { partsLibrary: [] },
  refs:  {},

  // --- Picker ---
  pickerMeta: null,
};

/* ---- DOM REFERENCES ---- */

// Global shorthand for document.getElementById, used throughout every
// renderer/operations file (not just here) — must stay a top-level
// declaration, not scoped inside initEl() below.
/**
 * @param {string} id
 * @returns {HTMLElement | null}
 */
const $ = id => document.getElementById(id);

/**
 * @typedef {{
 *   header: HTMLElement, main: HTMLElement, backBtn: HTMLElement, addBtn: HTMLElement,
 *   pageTitle: HTMLElement, detail: HTMLElement, resizeHandle: HTMLElement,
 *   backdrop: HTMLElement, sheet: HTMLElement, formTitle: HTMLElement, formBody: HTMLElement,
 *   formSave: HTMLElement, formCancel: HTMLElement, confirmBD: HTMLElement, confirmT: HTMLElement,
 *   confirmM: HTMLElement, confirmNo: HTMLElement, confirmSave: HTMLElement, confirmYes: HTMLElement,
 *   promptBD: HTMLElement, promptT: HTMLElement, promptM: HTMLElement,
 *   promptField: HTMLInputElement, promptCancel: HTMLElement, promptOk: HTMLElement,
 *   toast: HTMLElement, nav: HTMLElement,
 * }} ElRefs
 */

/**
 * Cache of frequently-used DOM element references, keyed by logical name.
 *
 * Populated by initEl() rather than at script-parse time: building this via
 * document.getElementById() calls at the top level (the previous approach)
 * silently depended on <script src="state.js"> running after #app's markup
 * was already parsed into the DOM. That's true today only because state.js
 * happens to load near the bottom of index.html's <body> — a fragile,
 * undeclared ordering constraint that a reordered <script> tag, a renamed
 * element id, or a future bundler (whose module-evaluation order need not
 * match <script> tag position) could silently break, leaving every el.*
 * reference null and every interaction a silent no-op.
 *
 * initEl() is called explicitly and synchronously from init() once the DOM
 * is known to be ready, and throws immediately if any expected id is
 * missing, converting "silently null forever" into a fail-fast startup
 * error with the offending id named.
 */
let el = /** @type {ElRefs} */ (/** @type {unknown} */ (null));

function initEl() {
  const refs = {
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
    promptField:  /** @type {HTMLInputElement | null} */ ($('prompt-input')),
    promptCancel: $('prompt-cancel'),
    promptOk:     $('prompt-ok'),
    toast:        $('toast'),
    nav:          $('bottom-nav'),
  };
  const missing = Object.entries(refs).filter(([, node]) => !node).map(([name]) => name);
  if (missing.length) {
    throw new Error(`initEl: missing expected DOM element(s) for: ${missing.join(', ')}`);
  }
  el = /** @type {ElRefs} */ (refs);
}

/* ---- TOAST ---- */

/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastTimer;

/**
 * @param {string} msg
 * @param {string} [type]
 */
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
 *
 * Deliberately named `confirm`, shadowing the built-in `window.confirm` for
 * every caller in this app (same as the original plain-JS behavior).
 * @param {string} title
 * @param {string} msg
 * @param {{ yesLabel?: string, noLabel?: string, yesClass?: string }} [opts]
 * @returns {Promise<boolean>}
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
 * Button classes are restored to their HTML defaults on cleanup.
 * @param {string} title
 * @param {string} msg
 * @param {{ cancelLabel: string, midLabel: string, midClass: string, yesLabel: string, yesClass: string }} opts
 * @returns {Promise<'cancel' | 'mid' | 'yes'>}
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
 * @param {string} title
 * @param {string} msg
 * @returns {Promise<'save' | 'discard' | null>}
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
 * Requires a non-empty value — blank submission shakes the input and re-focuses.
 * @param {string} title
 * @param {string} msg
 * @param {string} [defaultValue]
 * @returns {Promise<string | null>}
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
    /** @param {KeyboardEvent} e */
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

/** @param {StoreName[]} storeNames */
async function loadCache(storeNames) {
  await Promise.all(storeNames.map(async name => {
    const records = await getAll(name);
    state.cache[name] = records;
    state.refs[name]  = Object.fromEntries(records.map(i => [i.id, i]));
  }));
}

async function refreshAll() {
  await loadCache(['areas','panels','power','safety','networks','assets']);
}
