import type { DbRecord, StoreName } from './db.js';
import type { FormType } from './entity-config.js';
import type { NormalizedMediaItem } from './utils.js';

import { getAll } from './db.js';
/* ============================================================
   APPLICATION STATE & DOM REFERENCES
   Central state object, DOM element cache, toast/confirm UI,
   and cache/refs helpers. Loaded before app.js.
   ============================================================ */

/**
 * A media item as held in state's *editable* image/photo arrays (already
 * normalized — see utils.js's normalizeMediaItems() for the raw stored-value
 * shapes this gets built from).
 */
export interface EditableMediaItem { blob: Blob, mimeType: string }

export interface ItemTableRow { terminal?: string, label?: string }

/**
 * A single network-port entry, as used by both PLC slot Controller/
 * Communication cards (state.*SlotNetworkPorts) and HMI/Field Device assets
 * (state.*AssetNetworkPorts) — see utils.js's getEntityNetworkPorts().
 */
export interface NetworkPortRow { portNumber?: number, networkId: string, ipAddress?: string, nodeAddress?: string }

/**
 * Row shapes for the switch-network/switch-port/IO-point/power-bus tables are
 * still owned by renderers/tables.js (not yet typed) — kept as an honest
 * `Record<string, any>` placeholder here rather than guessed at.
 */
export type UntypedTableRow = Record<string, any>;

export interface State {
  page: string;

  detailType: FormType | null;
  detailId: string | null;
  detailStack: Array<{ type: FormType | null, id: string | null, slotNumber?: number | null }>;
  detailSlotNumber: number | null;
  /** Pending field-level edits (key -> value). */
  detailChanges: Record<string, any>;
  /**
   * "Other Media" gallery. Unlike formImages, not blob-converted at load
   * time (normalizeMediaItems() may leave legacy base64 items without a
   * real Blob) — freshenMediaItems() only runs at save time.
   */
  detailImages: NormalizedMediaItem[];
  /** Keyed by required-photo slot name. */
  detailNamedPhotos: Record<string, NormalizedMediaItem[]>;
  /** True after any add/remove so the navigation guard fires. */
  detailMediaDirty: boolean;
  /** Keyed by wiring-table key. */
  detailItemTables: Record<string, ItemTableRow[]>;
  detailSwitchNetworks: UntypedTableRow[];
  detailSwitchPorts: UntypedTableRow[];
  detailSlotIoPoints: UntypedTableRow[];
  detailSlotPowerBus: UntypedTableRow[];
  /** In-edit Controller/Communication card. */
  detailSlotNetworkPorts: NetworkPortRow[];
  /** In-edit HMI/Field Device asset (see ASSET_CLASS_NETWORK_PORTS). */
  detailAssetNetworkPorts: NetworkPortRow[];

  formType: FormType | null;
  formId: string | null;
  /** Polymorphic: {rackId,slotNumber} for a PLC slot form, or {field,value,extra,copyFrom} for an entity form preset. */
  formPreset: Record<string, any> | null;
  formImages: EditableMediaItem[];
  formNamedPhotos: Record<string, EditableMediaItem[]>;
  formItemTables: Record<string, ItemTableRow[]>;
  formSwitchNetworks: UntypedTableRow[];
  formSwitchPorts: UntypedTableRow[];
  formIoPoints: UntypedTableRow[];
  formPowerBus: UntypedTableRow[];
  /** In-edit Controller/Communication slot form. */
  formSlotNetworkPorts: NetworkPortRow[];
  /** In-edit HMI/Field Device asset form. */
  formAssetNetworkPorts: NetworkPortRow[];

  /**
   * Populated by refreshAll/loadCache. partsLibrary is the one key
   * initialised eagerly (see the initial `state` value below) and kept
   * current by getPartsLibraryCache(), so unlike the other stores it's
   * never actually undefined — typed non-optional so parts-library.js
   * doesn't need a null guard on every access.
   */
  cache: Partial<Record<StoreName, DbRecord[]>> & { partsLibrary: DbRecord[] };
  refs: Partial<Record<StoreName, Record<string, DbRecord>>>;

  pickerMeta: any;

  /**
   * The captured `beforeinstallprompt` event, held here (rather than as a
   * module-level `let` in init.js) so ES-module consumers can read AND
   * clear it via ordinary property mutation instead of reassigning a
   * read-only imported binding.
   */
  deferredInstallPrompt: any;
}

export const state: State = {
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

  // --- PWA install prompt ---
  deferredInstallPrompt: null,
};

/* ---- DOM REFERENCES ---- */

// Global shorthand for document.getElementById, used throughout every
// renderer/operations file (not just here) — must stay a top-level
// declaration, not scoped inside initEl() below.
export const $ = (id: string): HTMLElement | null => document.getElementById(id);

export interface ElRefs {
  header: HTMLElement, main: HTMLElement, backBtn: HTMLElement, addBtn: HTMLElement,
  pageTitle: HTMLElement, detail: HTMLElement, resizeHandle: HTMLElement,
  backdrop: HTMLElement, sheet: HTMLElement, formTitle: HTMLElement, formBody: HTMLElement,
  formSave: HTMLButtonElement, formCancel: HTMLElement, confirmBD: HTMLElement, confirmT: HTMLElement,
  confirmM: HTMLElement, confirmNo: HTMLElement, confirmSave: HTMLElement, confirmYes: HTMLElement,
  promptBD: HTMLElement, promptT: HTMLElement, promptM: HTMLElement,
  promptField: HTMLInputElement, promptCancel: HTMLElement, promptOk: HTMLElement,
  toast: HTMLElement, nav: HTMLElement,
}

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
export let el: ElRefs = null as unknown as ElRefs;

export function initEl(): void {
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
    formSave:     $('form-save') as HTMLButtonElement | null,
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
    promptField:  $('prompt-input') as HTMLInputElement | null,
    promptCancel: $('prompt-cancel'),
    promptOk:     $('prompt-ok'),
    toast:        $('toast'),
    nav:          $('bottom-nav'),
  };
  const missing = Object.entries(refs).filter(([, node]) => !node).map(([name]) => name);
  if (missing.length) {
    throw new Error(`initEl: missing expected DOM element(s) for: ${missing.join(', ')}`);
  }
  el = refs as ElRefs;
}

/* ---- TOAST ---- */

export let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(msg: string, type: string = ''): void {
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
 */
export function confirm(
  title: string,
  msg: string,
  { yesLabel = 'Delete', noLabel = 'Cancel', yesClass = 'btn-danger' }: { yesLabel?: string, noLabel?: string, yesClass?: string } = {}
): Promise<boolean> {
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
 */
export function confirmThreeWay(
  title: string,
  msg: string,
  { cancelLabel, midLabel, midClass, yesLabel, yesClass }: { cancelLabel: string, midLabel: string, midClass: string, yesLabel: string, yesClass: string }
): Promise<'cancel' | 'mid' | 'yes'> {
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
 */
export function confirmUnsaved(title: string, msg: string): Promise<'save' | 'discard' | null> {
  return confirmThreeWay(title, msg, {
    cancelLabel: 'Cancel',
    midLabel:    'Save Changes', midClass: 'btn-primary',
    yesLabel:    'Discard',      yesClass: 'btn-danger',
  }).then(r => r === 'mid' ? 'save' : r === 'yes' ? 'discard' : null);
}

/**
 * Shows a text-input prompt dialog.
 * Requires a non-empty value — blank submission shakes the input and re-focuses.
 */
export function promptInput(title: string, msg: string, defaultValue: string = ''): Promise<string | null> {
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); };

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

export async function loadCache(storeNames: StoreName[]): Promise<void> {
  await Promise.all(storeNames.map(async name => {
    const records = await getAll(name);
    state.cache[name] = records;
    state.refs[name]  = Object.fromEntries(records.map(i => [i.id, i]));
  }));
}

export async function refreshAll(): Promise<void> {
  await loadCache(['areas','panels','power','safety','networks','assets']);
}
