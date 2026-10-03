import type { DbRecord, StoreName } from './db.js';
import type { EntityType, EnumFieldDef, FieldDef, ItemTableDef } from './entity-config.js';

import { ENTITY } from './entity-config.js';
import { state } from './state.js';
import { renderDetailPlaceholder } from './app.js';
import { isUsableMediaEntry } from './media.js';
/* ============================================================
   UTILITIES
   Pure helper functions with no side effects beyond what they
   explicitly return or render. Depends on: state, ENTITY.
   ============================================================ */

/* ---- EXHAUSTIVENESS CHECK ---- */

/**
 * Compile-time exhaustiveness check for a closed union: calling this with a
 * value TS believes is `never` (every union member already handled by a
 * preceding `case`/`if`) is how a switch's `default` proves nothing was
 * missed — adding a new union member later without a matching case turns
 * into a compile error here instead of a silent fallthrough at runtime.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

/* ---- HTML ESCAPING ---- */

export function esc(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- REF RESOLUTION ---- */

/**
 * Consolidated from 4+ duplicated patterns scattered across app.js.
 */
export function resolveRef(storeName: StoreName, id: string | undefined | null): DbRecord | null {
  return state.refs?.[storeName]?.[id ?? ''] ?? null;
}

export function resolveRefName(storeName: StoreName, id: string | undefined | null): string {
  return resolveRef(storeName, id)?.name ?? '';
}

/* ---- NETWORK CONNECTION HELPERS ---- */

export interface NetworkPortEntry { networkId: string, ipAddress?: string, nodeAddress?: string }

/**
 * Normalizes "what network port(s) is this thing connected to" across the
 * three shapes currently in use, so every caller reads one canonical shape
 * instead of re-deriving it:
 *   - Network Switch assets: item.switchNetworks[] ({networkId, ipAddress?, nodeAddress?})
 *   - HMI / Field Device assets, and PLC slots: item.networkPorts[] (same shape)
 *   - Legacy pre-networkPorts-migration records: scalar item.networkId
 *     (+ item.ipAddress/item.nodeAddress), wrapped into a single-entry array
 *
 * Call with either an asset record or a PLC slot object (slot.networkPorts
 * follows the same shape, so this works unchanged for both).
 *
 * @param item - An asset, or a PLC slot object
 */
export function getEntityNetworkPorts(item: Record<string, any> | undefined | null): NetworkPortEntry[] {
  if (item?.switchNetworks?.length) return item.switchNetworks;
  if (item?.networkPorts?.length) return item.networkPorts;
  if (item?.networkId) return [{ networkId: item.networkId, ipAddress: item.ipAddress, nodeAddress: item.nodeAddress }];
  return [];
}

/**
 * Formats a list of network-port entries (from getEntityNetworkPorts) into
 * "Network Name — address" label parts, resolving each entry's network via
 * state.refs and dropping any entry whose network no longer exists.
 *
 * @param contextNetworkId - When given, only entries connected to this
 *   specific network are included — e.g. when rendering a card inside
 *   that network's own detail page, where showing a device's *other*
 *   unrelated network connections would be misleading.
 */
export function formatNetworkPortLabels(ports: NetworkPortEntry[], contextNetworkId?: string): string[] {
  const relevant = contextNetworkId ? ports.filter(p => p.networkId === contextNetworkId) : ports;
  return relevant.map(p => {
    const net = state.refs.networks?.[p.networkId];
    if (!net) return '';
    const addr = p.ipAddress || p.nodeAddress || '';
    return addr ? `${net.name} — ${addr}` : net.name;
  }).filter(Boolean);
}

/* ---- SORTING ---- */

/**
 * Case-insensitive alphabetical comparator for items with a name field.
 * Used by list views and child sections to ensure consistent A→Z display.
 */
export const sortByName = (a: { name?: string }, b: { name?: string }): number =>
  (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });

/* ---- FIELD / ENTITY HELPERS ---- */

export function getEffectiveFields(type: EntityType, item: Record<string, any> | undefined | null): FieldDef[] {
  const cfg           = ENTITY[type];
  const base          = cfg.fields || [];
  const proto         = cfg.protocolFields?.[item?.networkType ?? ''] || [];
  const classF        = cfg.classFields?.[item?.assetClass ?? ''] || [];
  const subclassF     = cfg.subclassFields?.[item?.assetSubclass ?? ''] || [];
  const cardTypeF     = cfg.cardTypeFields?.[item?.cardType ?? ''] || [];
  const linkedNetType = state.refs?.networks?.[item?.networkId]?.networkType;
  const networkTypeF  = type === 'assets' ? (cfg.networkTypeFields?.[linkedNetType ?? ''] || []) : [];
  return [...base, ...proto, ...classF, ...subclassF, ...cardTypeF, ...networkTypeF];
}

export function itemTables(type: EntityType, item: Record<string, any> | undefined | null): ItemTableDef[] {
  const cfg = ENTITY[type];
  return [
    ...(cfg.itemTables || []),
    ...(cfg.classItemTables?.[item?.assetClass ?? ''] || []),
  ];
}

/**
 * Returns true for any Network Switch asset with a subtype selected.
 * All three subtypes (Managed, Unmanaged, Router) display the full switch UI
 * (VLANs + port table). Subtype-specific constraints (VLAN limits, port
 * auto-assignment) are enforced inside the individual table renderers.
 *
 * @param assetClass - The asset's class string
 * @param subclass   - The asset's subclass/subtype string
 */
export function isSwitchAsset(assetClass: string, subclass: string): boolean {
  return assetClass === 'Network Switch' && !!subclass;
}

/**
 * Resolves the option list for an enum field config object.
 * For 'assetSubclass' the options are dynamic — derived from the item's assetClass
 * via ENTITY.assets.classSubclasses. All other enum fields return their static
 * f.options list.
 *
 * @param f    - Field config (key, type, options, …)
 * @param item - Current entity data (provides assetClass context)
 */
export function resolveFieldOptions(f: FieldDef, item: Record<string, any> | undefined | null): readonly string[] {
  if (f.key === 'assetSubclass') {
    return ENTITY.assets.classSubclasses?.[item?.assetClass ?? ''] || [];
  }
  return ('options' in f ? f.options : null) || [];
}

/**
 * Reassigns slotNumber on every slot to match its position in the array.
 * Call after any add, delete, reorder, or duplicate so the invariant
 * slotNumber === array-index is always true before persisting.
 */
export function renumberSlots<T extends Record<string, any>>(slots: T[]): (T & { slotNumber: number })[] {
  return slots.map((s, i) => ({ ...s, slotNumber: i }));
}

/**
 * Returns the networkTypeFields config for the network with the given id.
 */
export function getNetworkAddrFields(networkId: string | undefined | null): readonly FieldDef[] {
  const net = state.refs.networks?.[networkId ?? ''];
  return ENTITY.assets.networkTypeFields?.[net?.networkType ?? ''] || [];
}

// Backward-compat helper: an asset saved before the Network Ports migration
// (see ASSET_CLASS_NETWORK_PORTS) may still carry a legacy scalar networkId
// plus address fields. Synthesizes a single "Port 1" row from those legacy
// fields so the value isn't silently dropped the first time the record is
// opened — saving then persists it into networkPorts[] and clears the legacy
// fields (see saveEntityForm in operations.js / buildDetailItem's autosave
// path in renderers/detail.js).
export function buildLegacyNetworkPortRow(item: Record<string, any>): { portNumber: number, networkId: string, ipAddress?: string, subnetMask?: string, gateway?: string, nodeAddress?: string } {
  const row: { portNumber: number, networkId: string, ipAddress?: string, subnetMask?: string, gateway?: string, nodeAddress?: string } = { portNumber: 1, networkId: item.networkId };
  for (const key of ['ipAddress', 'subnetMask', 'gateway', 'nodeAddress'] as const) {
    if (item[key]) row[key] = item[key];
  }
  return row;
}

export function getIpPrefix(ipRange: string | undefined | null): string {
  if (!ipRange) return '';
  const parts = ipRange.split('/')[0].split('.');
  return parts.length >= 3 ? parts.slice(0, 3).join('.') + '.' : '';
}

/* ---- COMPLETENESS ---- */

export const COMPLETION_THRESHOLD = 75;

export function completenessColor(pct: number): string {
  return pct >= COMPLETION_THRESHOLD ? 'var(--success)' : 'var(--danger)';
}

export function calcCompleteness(type: EntityType, item: Record<string, any>): number {
  const cfg = ENTITY[type];
  let total = 0, filled = 0;
  for (const f of getEffectiveFields(type, item)) {
    // f.type is widened to string here on purpose: 'assign-type'/'assign-id'
    // aren't produced by any current entity-config.js field def (confirmed by
    // search — FieldDef's union is accurately closed to the 4 real variants),
    // but form.js/detail.js/operations.js still branch on these two type
    // strings too, so this guard is kept defensive rather than deleted.
    const fType = f.type as string;
    if (fType === 'assign-type' || fType === 'assign-id') continue; // UI-only; exclude from score
    total++;
    const val = item[f.key];
    if (val !== undefined && val !== null && String(val).trim() !== '') filled++;
  }
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      total++;
      // A photo whose bytes were lost (damaged ref) doesn't count as captured.
      const sv = item.namedPhotos?.[slot];
      if ((Array.isArray(sv) ? sv : sv ? [sv] : []).some(isUsableMediaEntry)) filled++;
    }
  }
  for (const t of itemTables(type, item)) {
    total++;
    const rows = (item[t.key] || []) as any[];
    if (rows.some(r => r.terminal || r.label)) filled++;
  }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

export function calcAreaCompleteness(area: DbRecord): number {
  const panelItems = (state.cache.panels || []).filter(p => p.areaId === area.id);
  const panelIds = new Set(panelItems.map(p => p.id));
  const allItems: Array<{ type: EntityType, item: DbRecord }> = [
    ...panelItems.map(p => ({ type: 'panels' as const, item: p })),
    ...(state.cache.power    || []).filter(p => panelIds.has(p.panelId)).map(p => ({ type: 'power' as const,    item: p })),
    ...(state.cache.safety   || []).filter(s => panelIds.has(s.panelId)).map(s => ({ type: 'safety' as const,   item: s })),
    ...(state.cache.networks || []).filter(n => n.assignedToType === 'Area' && n.assignedToId === area.id).map(n => ({ type: 'networks' as const, item: n })),
    ...(state.cache.assets   || []).filter(a => panelIds.has(a.panelId)).map(a => ({ type: 'assets' as const,   item: a })),
  ];
  if (!allItems.length) return 0;
  return Math.round(allItems.reduce((sum, { type, item }) => sum + calcCompleteness(type, item), 0) / allItems.length);
}

export function calcPanelDevicesCompleteness(panelId: string): number | null {
  const allItems: Array<{ type: EntityType, item: DbRecord }> = [
    ...(state.cache.power    || []).filter(p => p.panelId === panelId).map(p => ({ type: 'power' as const,    item: p })),
    ...(state.cache.safety   || []).filter(s => s.panelId === panelId).map(s => ({ type: 'safety' as const,   item: s })),
    ...(state.cache.networks || []).filter(n => n.assignedToType === 'Panel' && n.assignedToId === panelId).map(n => ({ type: 'networks' as const, item: n })),
    ...(state.cache.assets   || []).filter(a => a.panelId === panelId).map(a => ({ type: 'assets' as const,   item: a })),
  ];
  if (!allItems.length) return null;
  return Math.round(allItems.reduce((sum, { type, item }) => sum + calcCompleteness(type, item), 0) / allItems.length);
}

export function buildProgressRow(label: string, pct: number | null, color: string, marginTop: string = ''): string {
  const style = marginTop ? ` style="margin-top:${marginTop}"` : '';
  return `<div class="det-completeness-row"${style}>
           <span class="det-completeness-label">${label}</span>
           <span class="det-completeness-pct" style="color:${color}">${pct}%</span>
         </div>
         <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

export function buildDetailCompletenessHtml(type: EntityType, item: DbRecord): string {
  if (type === 'areas') {
    const pct = calcAreaCompleteness(item);
    const color = completenessColor(pct);
    return `
      <div class="det-card det-completeness-card">
        ${buildProgressRow('Area Completeness', pct, color)}
      </div>`;
  }
  if (type === 'panels') {
    const panelPct = calcCompleteness('panels', item);
    const panelColor = completenessColor(panelPct);
    const devPct = calcPanelDevicesCompleteness(item.id ?? '');
    const devRow = devPct !== null
      ? buildProgressRow('Devices', devPct, completenessColor(devPct), '12px')
      : `<div class="det-completeness-row" style="margin-top:12px">
           <span class="det-completeness-label">Devices</span>
           <span style="font-size:13px;color:var(--muted)">None assigned</span>
         </div>`;
    return `
      <div class="det-card det-completeness-card">
        ${buildProgressRow('Panel', panelPct, panelColor)}
        ${devRow}
      </div>`;
  }
  const pct = calcCompleteness(type, item);
  const color = completenessColor(pct);
  return `
    <div class="det-card det-completeness-card">
      ${buildProgressRow('Completeness', pct, color)}
    </div>`;
}

export interface ChecklistSubItem { key: string, label: string, done: number, total: number }
export type ChecklistItem = ChecklistSubItem & { subItems?: ChecklistSubItem[] };

export function calcChecklistAutoItems(): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const [type, cfg] of Object.entries(ENTITY)) {
    if (type === 'assets' || type === 'areas') continue;
    const t = type as EntityType;
    const all = state.cache[t] || [];
    if (!all.length) continue;
    const done = all.filter(i => calcCompleteness(t, i) >= COMPLETION_THRESHOLD).length;
    items.push({ key: t, label: cfg.plural, done, total: all.length });
  }
  const assetClassField = ENTITY.assets.fields.find(f => f.key === 'assetClass') as EnumFieldDef | undefined;
  const assetClassOptions = assetClassField?.options || [];
  const allAssets = state.cache.assets || [];
  const subItems: ChecklistSubItem[] = [];
  for (const cls of assetClassOptions) {
    const clsItems = allAssets.filter(a => a.assetClass === cls);
    if (!clsItems.length) continue;
    const done = clsItems.filter(a => calcCompleteness('assets', a) >= COMPLETION_THRESHOLD).length;
    subItems.push({ key: `asset-${cls}`, label: cls, done, total: clsItems.length });
  }
  if (subItems.length) {
    const totalDone = subItems.reduce((s, i) => s + i.done, 0);
    const totalAll  = subItems.reduce((s, i) => s + i.total, 0);
    items.push({ key: 'assets', label: ENTITY.assets.plural, done: totalDone, total: totalAll, subItems });
  }
  return items;
}

/* ---- ENTITY ICONS ---- */

export function entityIcon(type: string, size: number = 22): string {
  const icons: Record<string, string> = {
    areas:    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    panels:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    power:    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    safety:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    networks: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="1" y="16" width="6" height="6" rx="1"/><rect x="17" y="16" width="6" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="4" y1="16" x2="12" y2="14"/><line x1="20" y1="16" x2="12" y2="14"/></svg>`,
    assets:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  };
  return icons[type] || '';
}

/* ---- RESPONSIVE LAYOUT DETECTION ---- */

/**
 * Returns the current responsive tier based on window.innerWidth.
 *
 * 'mobile'  → < 768 px  Current single-column overlay behaviour unchanged.
 * 'tablet'  → 768–1199 px  Icon-only sidebar; detail slides in as right overlay.
 * 'desktop' → ≥ 1200 px  Three-column layout; detail is a permanent side pane.
 *
 * These thresholds mirror the CSS @media breakpoints in style.css.
 */
export function getLayoutMode(): 'mobile' | 'tablet' | 'desktop' {
  if (window.innerWidth >= 1200) return 'desktop';
  if (window.innerWidth >= 768)  return 'tablet';
  return 'mobile';
}

/**
 * Stamps the current layout mode on document.body as a data-layout attribute
 * so both CSS (body[data-layout="desktop"] selectors) and JS can branch on it
 * without duplicating the breakpoint numbers.
 *
 * Also initialises the desktop detail pane if we are already on a wide
 * viewport at page load (before the user clicks any entity card).
 *
 * Called once from init() and re-evaluates on every window resize (debounced
 * to 100 ms to avoid thrashing layout during continuous drag).
 */
export function initLayoutDetection(): void {
  function applyLayout() {
    const mode = getLayoutMode();
    document.body.dataset.layout = mode;

    if (mode === 'desktop') {
      /* On desktop the detail pane is always visible.  If nothing is
         currently selected, show the empty-state placeholder.
         renderDetailPlaceholder lives in app.js (loaded after utils.js). */
      const panel = document.getElementById('detail-panel');
      if (panel) {
        panel.style.display = 'flex';
        if (!panel.innerHTML.trim() && typeof renderDetailPlaceholder === 'function') {
          renderDetailPlaceholder();
        }
      }
    }
  }

  applyLayout();

  let _resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(applyLayout, 100);
  });
}

/* ---- DEBOUNCE ---- */

/**
 * A debounced wrapper around `fn`. Calling it resets a `ms`-long timer;
 * `fn` only actually runs once no further calls arrive within that window.
 * Unlike the one-off inline debounce in initLayoutDetection() above, this is
 * a reusable, exported primitive with explicit `cancel()`/`flush()` escape
 * hatches — needed by the detail-panel autosave (js/renderers/detail.js),
 * which must be able to abort a pending tick (panel closed) or force it to
 * run immediately (navigating away with a pending edit).
 */
export interface DebouncedFn<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  /** Cancels any pending invocation without running `fn`. */
  cancel(): void;
  /** If a call is pending, runs `fn` immediately (with its latest args) and cancels the timer. */
  flush(): void;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;

  const run = (): void => {
    timer = undefined;
    const args = lastArgs;
    lastArgs = undefined;
    if (args) fn(...args);
  };

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  }) as DebouncedFn<T>;

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };

  debounced.flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    run();
  };

  return debounced;
}

/**
 * Renders an ISO timestamp as "just now" / "5m ago" / "3h ago" / "2d ago"
 * for the Recent Changes (undo history) panel.
 */
export function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ---- OPTION BUILDERS ---- */

/**
 * Builds <option> HTML for a list of string values (enum fields).
 */
export function buildEnumOptions(options: readonly string[], selectedVal: string | undefined | null): string {
  return options
    .map(o => `<option value="${esc(o)}"${o === selectedVal ? ' selected' : ''}>${esc(o)}</option>`)
    .join('');
}

/**
 * Builds <option> HTML for a list of {id, name} ref objects.
 */
export function buildRefOptions(items: DbRecord[], selectedId: string | undefined | null): string {
  return items
    .map(i => `<option value="${esc(i.id)}"${i.id === selectedId ? ' selected' : ''}>${esc(i.name)}</option>`)
    .join('');
}

/**
 * Builds <option> HTML from a pre-filtered array of network objects.
 * Callers are responsible for filtering (Ethernet-only, assigned-only, etc.).
 */
export function buildNetworkOptions(selectedId: string | undefined | null, networks: DbRecord[]): string {
  return buildRefOptions(networks, selectedId);
}

/* ---- FIELD-EMPTY TOGGLE ---- */

/**
 * Attaches delegated input/change listeners that toggle the 'field-empty' class
 * based on whether the matched element has a value. changeSel defaults to inputSel
 * when both events should use the same selector (e.g. detail view); pass separate
 * selectors when input and select controls use different class names (e.g. form view).
 */
export function attachFieldEmptyToggle(container: Element, inputSel: string, changeSel: string = inputSel): void {
  container.addEventListener('input', e => {
    const f = ((e.target as Element | null)?.closest(inputSel) ?? null) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (f) f.classList.toggle('field-empty', !f.value);
  });
  container.addEventListener('change', e => {
    const f = ((e.target as Element | null)?.closest(changeSel) ?? null) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (f) f.classList.toggle('field-empty', !f.value);
  });
}
