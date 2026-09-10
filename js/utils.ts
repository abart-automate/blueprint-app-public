import type { DbRecord, StoreName } from './db.js';
import type { EntityType, EnumFieldDef, FieldDef, ItemTableDef } from './entity-config.js';

import { ENTITY } from './entity-config.js';
import { state } from './state.js';
import { renderDetailPlaceholder } from './app.js';
/* ============================================================
   UTILITIES
   Pure helper functions with no side effects beyond what they
   explicitly return or render. Depends on: state, ENTITY.
   ============================================================ */

/**
 * The 3 shapes a stored media value can be found in, historically:
 *   - A raw base64 data-URL string (oldest format, pre-blob storage).
 *   - A { blob, mimeType } item (current format) — carries an optional
 *     `_legacySrc?: undefined` so it unions cleanly with the normalized
 *     legacy shape below (same object shape either way; only base64 strings
 *     actually change shape during normalization).
 *   - An array of either of the above (namedPhotos slots, and the
 *     "Other Media" gallery, both support multiple items per field).
 * normalizeMediaItems() is the one sanctioned entry point that turns any of
 * these into a uniform NormalizedMediaItem[] — every other module should
 * consume its output, not this raw union, directly.
 */
export type BlobMediaItem = { blob: Blob, mimeType: string, _legacySrc?: undefined };
export type LegacyBase64MediaItem = string;
export type RawMediaItem = BlobMediaItem | LegacyBase64MediaItem;
export type StoredMediaValue = RawMediaItem | RawMediaItem[] | undefined | null;

/**
 * The shape a legacy base64 RawMediaItem is normalized into by
 * normalizeMediaItems() — downstream code never branches on typeof again.
 */
export type NormalizedLegacyItem = { _legacySrc: string, mimeType: string, blob?: undefined };
export type NormalizedMediaItem = BlobMediaItem | NormalizedLegacyItem;

/**
 * Some call sites (e.g. getCardThumbSrc, used for both freshly-uploaded and
 * already-normalized items) legitimately see either raw or normalized shapes.
 */
export type MediaItemLike = RawMediaItem | NormalizedMediaItem;
export type AnyMediaValue = MediaItemLike | MediaItemLike[] | undefined | null;

/* ---- MEDIA TYPE CONSTANTS ---- */

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4','video/quicktime'];
export const ACCEPTED_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];
export const ACCEPTED_MEDIA_ACCEPT = ACCEPTED_MEDIA_TYPES.join(',');

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
// fields (see saveEntityForm / saveDetailChanges).
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
      const sv = item.namedPhotos?.[slot];
      if (Array.isArray(sv) ? sv.length > 0 : !!sv) filled++;
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

/* ---- MEDIA PROCESSING ---- */

/**
 * Validates file type and returns { blob, mimeType }.
 * Images are resized to max 1400px and re-encoded as JPEG blobs.
 * Throws a user-readable Error for unsupported types.
 */
export async function processMediaFile(file: File): Promise<BlobMediaItem> {
  if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
    throw new Error(
      `Unsupported file: ${file.name} (${file.type || 'unknown type'})\n` +
      `Accepted images: JPEG, PNG, WebP\nAccepted videos: MP4, MOV`
    );
  }
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    return { blob: file, mimeType: file.type };
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxPx = 1400;
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) resolve({ blob, mimeType: 'image/jpeg' });
          else reject(new Error(`Failed to encode image: ${file.name}`));
        }, 'image/jpeg', 0.82);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a legacy base64 data URL to a { blob, mimeType } media item.
 */
export function base64ToMediaItem(dataUrl: string): BlobMediaItem {
  const [header, b64] = dataUrl.split(',');
  const mimeType = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return { blob: new Blob([arr], { type: mimeType }), mimeType };
}

/* ---- OBJECT URL LIFECYCLE ---- */

export const _mediaUrls: string[] = [];
// Index into _mediaUrls where the current form session's URLs begin.
// Set by markFormMediaStart() each time a sheet form opens so that
// revokeFormMediaUrls() can revoke only form-specific entries, leaving
// detail-panel blob URLs intact for the still-visible detail panel.
export let _formMediaStart = 0;

/**
 * Creates and tracks a blob object URL. Call revokeAllMediaUrls() when done.
 * If mediaItem has a _legacySrc (base64 string), returns it directly without creating a URL.
 */
export function createMediaUrl(mediaItem: NormalizedMediaItem): string {
  if (!('blob' in mediaItem) || !mediaItem.blob) return mediaItem._legacySrc ?? '';
  const url = URL.createObjectURL(mediaItem.blob);
  _mediaUrls.push(url);
  return url;
}

// Revoke a single tracked blob URL and remove it from the pool.
// Call this before discarding an <img>/<video> that used createMediaUrl() so the
// pool does not grow unboundedly when a gallery is re-rendered on every add/remove.
/**
 * Revoking an already-revoked or untracked URL is a safe no-op.
 */
export function revokeTrackedMediaUrl(url: string): void {
  const i = _mediaUrls.indexOf(url);
  if (i !== -1) _mediaUrls.splice(i, 1);
  URL.revokeObjectURL(url);
}

/**
 * Revoke all blob URLs currently referenced by <img>/<video> elements inside containerEl.
 * Call this immediately before any innerHTML assignment that destroys blob-src elements.
 * Safe for both tracked URLs (removed from _mediaUrls pool + revoked) and untracked URLs
 * such as those from getCardThumbSrc() (URL.revokeObjectURL called directly; no pool op).
 */
export function revokeBlobUrlsInContainer(containerEl: Element): void {
  containerEl.querySelectorAll('img[src^="blob:"], video[src^="blob:"]').forEach(el => {
    revokeTrackedMediaUrl((el as HTMLImageElement | HTMLVideoElement).src);
  });
}

// Records the pool boundary just before a sheet form opens.
// Any URLs pushed to _mediaUrls after this point belong to the form session.
export function markFormMediaStart(): void {
  _formMediaStart = _mediaUrls.length;
}

// Revoke only blob URLs created since the last markFormMediaStart() call.
// Detail-panel blob URLs (added before the form opened) are left intact so
// thumbnails in the still-visible detail panel are not invalidated.
export function revokeFormMediaUrls(): void {
  _mediaUrls.splice(_formMediaStart).forEach(u => URL.revokeObjectURL(u));
}

// Revoke every tracked blob URL — call when the detail panel closes or all data is cleared.
export function revokeAllMediaUrls(): void {
  _mediaUrls.forEach(u => URL.revokeObjectURL(u));
  _mediaUrls.length = 0;
  _formMediaStart = 0;
}

/**
 * Returns a displayable src string for use in card thumbnail <img> elements.
 * Handles legacy base64 strings, new {blob,mimeType} items, and arrays (namedPhotos slots).
 * Object URLs created here are untracked — acceptable for short-lived card list renders.
 */
export function getCardThumbSrc(mediaValue: AnyMediaValue): string | null {
  const item = Array.isArray(mediaValue) ? mediaValue[0] : mediaValue;
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item._legacySrc) return item._legacySrc;
  if (item.mimeType?.startsWith('video/')) return null;
  if (!item.blob) return null;
  return URL.createObjectURL(item.blob);
}

/**
 * Normalises a stored media value into NormalizedMediaItem[].
 * Handles: undefined, legacy base64 string, single blob item, or array of either.
 */
export function normalizeMediaItems(value: StoredMediaValue): NormalizedMediaItem[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(x => (typeof x === 'string' ? { _legacySrc: x, mimeType: 'image/jpeg' } : x));
}

/**
 * Converts IDB-backed blobs to fresh in-memory blobs before writing back to IndexedDB.
 * WebKit/Safari cannot reliably re-store blobs retrieved from IndexedDB via structured
 * clone — they write back as zero-byte blobs, causing broken thumbnails after a
 * close-and-reopen cycle. Reading via arrayBuffer() + new Blob() produces a true
 * in-memory copy that the structured clone algorithm handles correctly.
 */
export async function freshenMediaItems(items: NormalizedMediaItem[] | undefined | null): Promise<NormalizedMediaItem[]> {
  if (!items?.length) return [];
  return Promise.all(items.map(async mi => {
    if (!mi?.blob || mi._legacySrc) return mi;
    try {
      const buf = await mi.blob.arrayBuffer();
      return { ...mi, blob: new Blob([buf], { type: mi.blob.type || mi.mimeType }) };
    } catch {
      return mi;
    }
  }));
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

/* ---- LIGHTBOX ---- */

/**
 * Opens a fullscreen lightbox for an image or video media item.
 * Accepts { blob, mimeType } or a legacy { _legacySrc } item.
 */
export function openMediaLightbox(mediaItem: NormalizedMediaItem): void {
  let lb = document.querySelector('.lightbox') as HTMLElement | null;
  if (!lb) {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'lightbox-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => _closeLightbox(lb as HTMLElement);
    lb.onclick = e => { if (e.target === lb) _closeLightbox(lb as HTMLElement); };
    lb.appendChild(closeBtn);
    (document.querySelector('#app') as Element).appendChild(lb);
  }
  // Revoke the outgoing lightbox blob URL before replacing it — the lightbox lives in #app,
  // not inside el.detail, so revokeBlobUrlsInContainer(el.detail) never reaches it.
  revokeBlobUrlsInContainer(lb);
  lb.querySelectorAll('img, video').forEach(el => el.remove());

  const src = createMediaUrl(mediaItem);
  const isVideo = mediaItem.mimeType?.startsWith('video/');
  if (isVideo) {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    lb.insertBefore(video, lb.firstChild);
  } else {
    const img = document.createElement('img');
    img.src = src;
    lb.insertBefore(img, lb.firstChild);
  }
  lb.classList.add('open');
}

export function _closeLightbox(lb: HTMLElement): void {
  const video = lb.querySelector('video');
  if (video) video.pause();
  // Revoke blob URL before removing the element from DOM.
  revokeBlobUrlsInContainer(lb);
  lb.remove();
}
