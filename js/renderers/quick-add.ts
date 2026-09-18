import type { EntityType } from '../entity-config.js';
import type { EditableMediaItem } from '../state.js';

import { ENTITY } from '../entity-config.js';
import { el, loadCache, showToast, state } from '../state.js';
import { upsert } from '../db.js';
import { buildEnumOptions, buildRefOptions, esc, freshenMediaItems, markFormMediaStart, revokeFormMediaUrls } from '../utils.js';
import { renderMediaGallery } from './tables.js';
import { validateRequiredFields, validateUniqueName, _field } from '../operations.js';
import { navigate, openDetail } from '../app.js';
/* ============================================================
   QUICK ADD MODAL
   A focused, always-available overlay for creating any entity
   type from any page. Shows only the essential fields (name,
   type/subtype, a parent reference, description, and optional
   media) rather than the full form sheet.

   Dependency chain: entity-config → state → db → utils →
   tables → operations → app  (no circularity introduced since
   app.ts does not import from this file).
   ============================================================ */

/** Ordered list of all entity types shown in the type-selector bar. */
const ENTITY_TYPE_ORDER: EntityType[] = ['areas', 'panels', 'power', 'safety', 'networks', 'assets'];

/**
 * The subset of field keys rendered in the compact quick-add view per entity
 * type. Derived from the canonical ENTITY schema — no configs are duplicated
 * here, only the keys that should appear (others are omitted from this view).
 */
const QUICK_FIELDS: Record<EntityType, string[]> = {
  areas:    ['name', 'description'],
  panels:   ['name', 'areaId', 'description'],
  power:    ['name', 'panelId', 'description'],
  safety:   ['name', 'panelId', 'safetyCategory', 'description'],
  networks: ['name', 'networkType', 'description'],
  assets:   ['name', 'assetClass', 'assetSubclass', 'panelId', 'description'],
};

/* ---- OPEN / CLOSE ---- */

/**
 * Opens the Quick Add modal, optionally pre-selecting an entity type.
 * Pass the current page name; if it maps to a valid EntityType the
 * corresponding type chip is activated immediately.
 */
export function openQuickAdd(defaultType?: string): void {
  const type = ENTITY_TYPE_ORDER.includes(defaultType as EntityType)
    ? (defaultType as EntityType)
    : null;

  state.qaType   = type;
  state.qaImages = [];
  markFormMediaStart();

  renderTypeBar(type);
  if (type) {
    void renderQuickAddFields(type);
  } else {
    el.qaBody.innerHTML = `<p class="qa-placeholder">Select a type above to continue.</p>`;
  }

  el.qaBackdrop.setAttribute('aria-hidden', 'false');
  el.qaModal.setAttribute('aria-hidden', 'false');
  el.qaBackdrop.classList.add('open');
  el.qaModal.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.qaModal.classList.add('open'));
  });
}

/** Closes the Quick Add modal and cleans up media blob URLs and state. */
export function closeQuickAdd(): void {
  el.qaModal.classList.remove('open');
  el.qaBackdrop.classList.remove('open');
  el.qaModal.setAttribute('aria-hidden', 'true');
  el.qaBackdrop.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    el.qaModal.style.display = 'none';
    el.qaBody.innerHTML      = '';
    el.qaTypeBar.innerHTML   = '';
  }, 300);
  revokeFormMediaUrls();
  state.qaType   = null;
  state.qaImages = [];
}

/* ---- TYPE BAR ---- */

/** Renders the six entity-type chips. Clicking one switches the form fields. */
function renderTypeBar(selected: EntityType | null): void {
  el.qaTypeBar.innerHTML = ENTITY_TYPE_ORDER.map(t => {
    const cfg = ENTITY[t];
    const active = t === selected ? ' active' : '';
    return `<button class="qa-type-chip${active}" data-qa-type="${t}">${esc(cfg.plural)}</button>`;
  }).join('');

  el.qaTypeBar.querySelectorAll<HTMLButtonElement>('.qa-type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.qaType as EntityType;
      state.qaType = type;
      el.qaTypeBar.querySelectorAll('.qa-type-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      void renderQuickAddFields(type);
    });
  });
}

/* ---- FIELD RENDERING ---- */

/**
 * Builds an HTML string for a single field.
 * Mirrors the structure of buildFormField() in renderers/form.ts but
 * reads no preset state — the quick-add form always starts blank.
 */
function buildQaField(key: string, type: EntityType): string {
  const allFields = [
    ...(ENTITY[type].fields || []),
    ...(Object.values((ENTITY as any)[type]?.classFields    || {}).flat() as any[]),
    ...(Object.values((ENTITY as any)[type]?.subclassFields || {}).flat() as any[]),
  ];
  const f = allFields.find(fd => fd.key === key);
  if (!f) return '';

  const requiredMark = f.required ? '<span class="req">*</span>' : '';

  if (f.type === 'text' || f.type === 'textarea') {
    const inner = f.type === 'textarea'
      ? `<textarea id="f-${f.key}" class="f-textarea field-empty" placeholder="${esc(f.label)}"></textarea>`
      : `<input id="f-${f.key}" class="f-input field-empty" type="text" value="" placeholder="${esc(f.label)}">`;
    return `<div class="fg"><label class="fg-label">${esc(f.label)}${requiredMark}</label>${inner}</div>`;
  }

  if (f.type === 'enum') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${requiredMark}</label>
      <select id="f-${f.key}" class="f-select field-empty">
        <option value="">— Select —</option>
        ${buildEnumOptions(f.options, '')}
      </select>
    </div>`;
  }

  if (f.type === 'ref') {
    const items = state.cache[(f as any).refStore as EntityType] || [];
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-${f.key}" class="f-select field-empty">
        <option value="">— Unassigned —</option>
        ${buildRefOptions(items, '')}
      </select>
    </div>`;
  }

  return '';
}

/**
 * Clears #qa-body and renders the compact field set for the given entity type,
 * followed by the media gallery for entity types that support it.
 */
async function renderQuickAddFields(type: EntityType): Promise<void> {
  const keys = QUICK_FIELDS[type];

  let html = '';
  for (const key of keys) {
    if (key === 'assetSubclass') {
      // Rendered dynamically after assetClass is wired — placeholder wrapper only
      html += `<div id="qa-subclass-wrap" style="display:none">
        <div class="fg">
          <label class="fg-label">Subtype</label>
          <select id="f-assetSubclass" class="f-select field-empty">
            <option value=""></option>
          </select>
        </div>
      </div>`;
    } else {
      html += buildQaField(key, type);
    }
  }

  el.qaBody.innerHTML = html;

  // Wire assetClass → assetSubclass cascade for assets
  if (type === 'assets') {
    const classSel = _field('f-assetClass') as HTMLSelectElement | null;
    const syncSubclass = () => {
      const cls        = classSel?.value ?? '';
      const subclasses = (ENTITY.assets as any).classSubclasses?.[cls] as string[] || [];
      const wrap       = document.getElementById('qa-subclass-wrap');
      const subSel     = _field('f-assetSubclass') as HTMLSelectElement | null;
      if (!wrap || !subSel) return;
      subSel.innerHTML = '<option value=""></option>' +
        subclasses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
      wrap.style.display = subclasses.length ? '' : 'none';
    };
    classSel?.addEventListener('change', syncSubclass);
    syncSubclass();
  }

  // Media gallery (skip for entity types with noImages: true)
  const cfg = ENTITY[type];
  if (!cfg.noImages) {
    const section  = document.createElement('div');
    section.innerHTML = `<div class="form-section-hdr">Media</div>`;
    const grid = document.createElement('div');
    grid.className = 'img-grid';
    section.appendChild(grid);
    el.qaBody.appendChild(section);

    const reGallery = () => renderMediaGallery(grid, state.qaImages, {
      onAdd:    (items: EditableMediaItem[]) => { state.qaImages.push(...items); reGallery(); },
      onRemove: (i: number)                  => { state.qaImages.splice(i, 1);  reGallery(); },
    });
    reGallery();
  }
}

/* ---- SAVE ---- */

/**
 * Collects values from the visible quick-add fields, validates, persists the
 * new entity via upsert(), refreshes the relevant cache slice, then closes the
 * modal and shows a success toast with a "View" action.
 */
export async function saveQuickAdd(): Promise<void> {
  const type = state.qaType;
  if (!type) {
    showToast('Select a type first', 'error');
    return;
  }

  // Collect field values from the rendered quick-add fields
  const item: Record<string, any> = {};
  for (const key of QUICK_FIELDS[type]) {
    const el2 = _field(`f-${key}`);
    if (!el2) continue;
    const val = el2.value;
    item[key] = (el2.tagName === 'SELECT' && !val) ? '' : val.trim?.() ?? val;
  }

  // Validate required fields and name uniqueness
  const missingField = validateRequiredFields(type, item);
  if (missingField) {
    showToast(`${missingField.label} is required`, 'error');
    return;
  }
  const nameError = validateUniqueName(type, item);
  if (nameError) {
    showToast(nameError, 'error');
    return;
  }

  // Disable save button during async work
  el.qaSave.disabled    = true;
  el.qaSave.textContent = 'Saving…';

  try {
    // Freshen media blobs (re-slice ArrayBuffer to survive transfer across ticks)
    if (state.qaImages.length) {
      item.images = await freshenMediaItems(state.qaImages);
    }

    const saved = await upsert(type, item);
    await loadCache([type]);

    closeQuickAdd();

    const cfg       = ENTITY[type];
    const savedId   = (saved as any).id as string;
    showToastWithAction(`${cfg.label} created`, 'success', 'View', () => {
      void navigate(type);
      openDetail(type, savedId);
    });
  } catch (err) {
    showToast('Save failed', 'error');
    console.error('[quick-add] saveQuickAdd error:', err);
  } finally {
    el.qaSave.disabled    = false;
    el.qaSave.textContent = 'Save';
  }
}

/* ---- TOAST WITH ACTION ---- */

/**
 * Shows a toast with a clickable action button.
 * Delegates timer management to showToast() (same 2800 ms window), then
 * replaces the plain text node with interactive markup and enables pointer
 * events so the button is clickable.
 */
function showToastWithAction(msg: string, cssType: string, actionLabel: string, onAction: () => void): void {
  showToast(msg, cssType);
  el.toast.classList.add('has-action');
  el.toast.innerHTML = `<span>${esc(msg)}</span><button class="toast-action-btn">${esc(actionLabel)}</button>`;
  el.toast.querySelector<HTMLButtonElement>('.toast-action-btn')
    ?.addEventListener('click', () => {
      el.toast.className = 'toast';
      el.toast.innerHTML = '';
      onAction();
    }, { once: true });
}
