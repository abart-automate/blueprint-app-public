import { getMany, insert } from './db.js';
/* ============================================================
   MEDIA
   Everything about photos/videos attached to records: the stored
   data shapes, the capture/upload processing pipeline, thumbnail
   generation, the `media` object store, object-URL lifecycle, and
   entity-level media helpers.

   STORAGE MODEL (DB v4)
   Photo/video bytes live in the `media` object store, one row per
   item, and a row is only ever INSERTED or DELETED — never updated.
   Records (entities, checklist items) hold small MediaRef pointers.

   Why: on iOS/WebKit, rewriting an IndexedDB record that embeds Blobs
   deletes the files behind every Blob previously read from it — blob:
   URLs on screen go blank, and writing such a Blob back stores an empty
   one (permanent data loss). With bytes in insert-only rows, field
   autosaves, media add/remove and Excel/JSON imports rewrite only
   small JSON, so loaded Blobs stay valid for the life of the page.

   Only app-module import is db.ts (no top-level side effects), so the
   pure helpers stay testable without a DOM or IndexedDB.
   The fullscreen viewer lives in lightbox.ts (lazy-loaded).
   ============================================================ */

/* ---- DATA SHAPES ---- */

/**
 * What a record stores per photo/video: a pointer to a `media` row plus the
 * metadata needed without loading the row (lightbox aspect ratio, export size
 * estimate). `damaged` marks an item whose bytes were found unreadable or empty
 * during migration/import — kept (not dropped) so the UI can say so and
 * "Restore Photos from Backup" can replace it in place.
 */
export interface MediaRef {
  mediaId: string,
  mimeType: string,
  width?: number,
  height?: number,
  size?: number,
  damaged?: true,
}

/**
 * In-memory media item used by the UI: a MediaRef plus its loaded Blobs.
 *   - `blob`   Original file (photos: byte-for-byte unless re-encoded — see needsReencode()).
 *   - `thumb`  Small JPEG for grids/cards (decoding full-res bitmaps in lists crashes iOS).
 *   - `missing` The bytes are unavailable (damaged ref, deleted row, or empty blob).
 */
export interface MediaItem extends MediaRef {
  blob?: Blob,
  thumb?: Blob,
  missing?: boolean,
}

/** A processed capture/upload not yet stored: what processMediaFile() returns. */
export interface NewMediaItem {
  blob: Blob,
  mimeType: string,
  width?: number,
  height?: number,
  thumb?: Blob,
}

/** One row of the `media` object store. Insert-only — see the module header. */
export interface MediaRow {
  id: string,
  blob: Blob,
  thumb?: Blob,
  mimeType: string,
  width?: number,
  height?: number,
  size: number,
  createdAt: string,
}

/**
 * Pre-v4 inline shapes, accepted only by the migration, the self-healing path in
 * loadMedia(), and the JSON import decoder:
 *   - InlineMediaItem: a Blob embedded directly in the record.
 *   - a base64 data-URL string (oldest format; also the JSON export format).
 */
export type InlineMediaItem = { blob: Blob, mimeType?: string, width?: number, height?: number, thumb?: Blob };
export type StoredMediaEntry = MediaRef | MediaItem | InlineMediaItem | string;
export type StoredMediaValue = StoredMediaEntry | StoredMediaEntry[] | undefined | null;

/**
 * The media-bearing fields of any record (entities, checklist items, detail-panel
 * state). The index signature lets whole records (DbRecord) be passed directly.
 */
export interface MediaFields {
  images?: StoredMediaValue,
  namedPhotos?: Record<string, StoredMediaValue> | null,
  [key: string]: unknown,
}

/* ---- CONSTANTS ---- */

/**
 * Largest image (in pixels) stored without downscaling. Kept just under iOS
 * Safari's maximum canvas area (16,777,216 px) — a larger canvas silently
 * produces a blank/null encode. Default 12MP phone photos are stored untouched;
 * 48/50/200MP sensor-mode photos are downscaled to ~16MP.
 */
export const MAX_STORED_PIXELS = 16_000_000;

/** Image types every target browser (Chrome + Safari) can display natively. */
export const WEB_SAFE_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
]);

/** Output format/quality when a photo must be re-encoded (non-web-safe or oversized). */
export const REENCODE_TYPE = 'image/jpeg';
export const REENCODE_QUALITY = 0.92;

/** Thumbnail long edge — sharp in a 3-column grid at 3x device pixel ratio. */
export const THUMB_MAX_EDGE = 480;
export const THUMB_TYPE = 'image/jpeg';
export const THUMB_QUALITY = 0.8;

/**
 * `accept` for the "Take Photo" input. Paired with capture="environment" this
 * opens the native rear camera (full sensor, autofocus, zoom, HDR, flash).
 * Photo-only: adding video/* makes Android show a camera-vs-camcorder chooser.
 */
export const CAMERA_ACCEPT = 'image/*';

/**
 * `accept` for the "Choose from Library" input. A wildcard (not a MIME list)
 * makes iOS show the Photos sheet and transcode HEIC→JPEG automatically.
 */
export const LIBRARY_ACCEPT = 'image/*,video/*';

/** Canonical file extension per MIME type; the reverse map drives mimeFromFilename(). */
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};
const EXTENSION_MIMES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime])),
  jpeg: 'image/jpeg',
  m4v: 'video/mp4',
};

/* ---- PURE HELPERS ---- */

/** Coerces a single value / array / nullish into an array. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function isVideoMime(mimeType: string | undefined): boolean {
  return Boolean(mimeType?.startsWith('video/'));
}

/**
 * Scales (w, h) down — never up — so w*h fits within maxPixels, preserving aspect ratio.
 */
export function fitWithinPixelBudget(w: number, h: number, maxPixels: number): { width: number, height: number } {
  const scale = Math.min(1, Math.sqrt(maxPixels / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

/**
 * Scales (w, h) down — never up — so the longer edge is at most maxEdge.
 */
export function fitWithinLongEdge(w: number, h: number, maxEdge: number): { width: number, height: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * True when a decoded photo cannot be stored as-is: either the format is not
 * displayable in every target browser (e.g. HEIC from an Android gallery), or
 * it exceeds MAX_STORED_PIXELS.
 */
export function needsReencode(mimeType: string, width: number, height: number): boolean {
  return !WEB_SAFE_IMAGE_TYPES.has(mimeType) || width * height > MAX_STORED_PIXELS;
}

/** File extension (no dot) for a MIME type; falls back to the sanitized subtype. */
export function extensionForMime(mimeType: string | undefined): string {
  if (!mimeType) return 'bin';
  return MIME_EXTENSIONS[mimeType] ?? (mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin');
}

/**
 * Infers a MIME type from a filename. Some Android pickers hand over files with
 * an empty `type` (notably HEIC), so processMediaFile() falls back to this.
 */
export function mimeFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIMES[ext] ?? '';
}

function isHeicMime(mimeType: string): boolean {
  return mimeType === 'image/heic' || mimeType === 'image/heif';
}

/** True for a v4 pointer (anything carrying a `mediaId`). */
export function isMediaRef(entry: unknown): entry is MediaRef {
  return typeof entry === 'object' && entry !== null && typeof (entry as MediaRef).mediaId === 'string';
}

/**
 * Classifies one stored media entry:
 *   'ref'     v4 pointer (MediaRef / MediaItem)
 *   'inline'  pre-v4 Blob embedded in the record
 *   'base64'  data-URL string (oldest stored format, and the JSON export format)
 *   'invalid' anything else (dropped by importers)
 */
export function classifyMediaEntry(entry: unknown): 'ref' | 'inline' | 'base64' | 'invalid' {
  if (isMediaRef(entry)) return 'ref';
  if (typeof entry === 'string') return entry.startsWith('data:') ? 'base64' : 'invalid';
  if (typeof entry === 'object' && entry !== null && (entry as InlineMediaItem).blob instanceof Blob) return 'inline';
  return 'invalid';
}

/** Strips a MediaItem down to the pointer a record stores. Missing items keep their ref, flagged damaged. */
export function toMediaRef(item: MediaItem | MediaRef): MediaRef {
  const ref: MediaRef = { mediaId: item.mediaId, mimeType: item.mimeType };
  if (item.width) ref.width = item.width;
  if (item.height) ref.height = item.height;
  if (item.size) ref.size = item.size;
  if (item.damaged || (item as MediaItem).missing) ref.damaged = true;
  return ref;
}

/** toMediaRef() over a list — what every record write stores for images / a slot. */
export function toMediaRefs(items: (MediaItem | MediaRef)[]): MediaRef[] {
  return items.map(toMediaRef);
}

/** True when a stored entry is a usable photo (a ref not flagged damaged, or legacy inline data). */
export function isUsableMediaEntry(entry: unknown): boolean {
  const kind = classifyMediaEntry(entry);
  return kind === 'ref' ? !(entry as MediaRef).damaged : kind !== 'invalid';
}

/* ---- ENTITY-LEVEL MEDIA HELPERS ---- */

/**
 * Splits a record's media into its gallery images and its named-photo slots,
 * each coerced to an array (legacy records stored single values).
 */
export function entityMediaLists(entity: MediaFields): { images: StoredMediaEntry[], slots: Array<[string, StoredMediaEntry[]]> } {
  return {
    images: asArray(entity.images),
    slots: Object.entries(entity.namedPhotos ?? {}).map(([slot, value]) => [slot, asArray(value)]),
  };
}

/** Every media entry on a record (named-photo slots, then the gallery), flattened. */
export function collectEntityMedia(entity: MediaFields): StoredMediaEntry[] {
  const { images, slots } = entityMediaLists(entity);
  return [...slots.flatMap(([, items]) => items), ...images];
}

/** True when the record has at least one photo or video in any slot or the gallery. */
export function entityHasMedia(entity: MediaFields): boolean {
  return collectEntityMedia(entity).length > 0;
}

/**
 * Number of entries on a record that still embed bytes (pre-v4 Blobs or base64
 * strings, which is also the JSON export format) — the unit of progress for the
 * migration and for JSON import.
 */
export function countInlineEntries(entity: MediaFields): number {
  return collectEntityMedia(entity).filter(e => {
    const kind = classifyMediaEntry(e);
    return kind === 'inline' || kind === 'base64';
  }).length;
}

/** True when any stored entry still embeds bytes — i.e. the record needs migrating. */
export function hasInlineMedia(entity: MediaFields): boolean {
  return countInlineEntries(entity) > 0;
}

/** Every mediaId a record points at (used by orphan cleanup). */
export function collectMediaIds(entity: MediaFields): string[] {
  return collectEntityMedia(entity).filter(isMediaRef).map(r => r.mediaId);
}

/**
 * The media entry a list card uses as its thumbnail: the first usable gallery
 * image, else the first usable slot photo. Videos are skipped (no still thumbnail).
 */
export function getFirstMedia(entity: MediaFields): StoredMediaEntry | null {
  const { images, slots } = entityMediaLists(entity);
  const usableStill = (e: StoredMediaEntry) => isUsableMediaEntry(e) && !isVideoMime(typeof e === 'string' ? undefined : e.mimeType);
  return images.find(usableStill) ?? slots.flatMap(([, items]) => items).find(usableStill) ?? null;
}

/**
 * Returns a shallow copy of `entity` with every media entry replaced by fn(entry).
 * Entries for which fn returns null/undefined are dropped. Fields absent on the
 * input stay absent on the output.
 */
export function mapEntityMedia<T extends Record<string, any>>(entity: T, fn: (entry: StoredMediaEntry) => unknown): T {
  const out: Record<string, any> = { ...entity };
  const keep = (items: StoredMediaEntry[]) => items.map(fn).filter(x => x != null);
  if (entity.images) out.images = keep(asArray(entity.images));
  if (entity.namedPhotos) {
    out.namedPhotos = Object.fromEntries(entityMediaLists(entity).slots.map(([slot, items]) => [slot, keep(items)]));
  }
  return out as T;
}

/**
 * Async variant of mapEntityMedia(). Entries are converted one at a time, in
 * order — conversions may decode full-resolution photos, and doing them
 * concurrently could exhaust memory on a phone.
 */
export async function mapEntityMediaAsync<T extends Record<string, any>>(entity: T, fn: (entry: StoredMediaEntry) => Promise<unknown>): Promise<T> {
  const results = new Map<StoredMediaEntry, unknown>();
  for (const entry of collectEntityMedia(entity)) {
    if (!results.has(entry)) results.set(entry, await fn(entry));
  }
  return mapEntityMedia(entity, entry => results.get(entry));
}

/* ---- DECODE / ENCODE (browser only) ---- */

interface DecodedImage {
  image: CanvasImageSource,
  width: number,
  height: number,
  /** Frees the decoded bitmap / temporary object URL. Always call when done. */
  release(): void,
}

/**
 * Decodes an image blob with EXIF orientation applied, without a base64 round-trip.
 * Prefers createImageBitmap (off-main-thread decode); falls back to an
 * HTMLImageElement for browsers that reject the options bag or the format there.
 * Rejects when the browser cannot decode the format at all (e.g. HEIC on Chrome).
 */
async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* fall through to <img> decode */ }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

/**
 * Draws `image` at width×height and encodes it. JPEG output gets a white
 * background so transparent PNGs don't turn black. The canvas is shrunk to 0×0
 * afterwards — iOS otherwise holds its backing store until GC and runs out of
 * canvas memory after a few large photos.
 */
function renderToBlob(image: CanvasImageSource, width: number, height: number, type: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas is not available'));
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      canvas.width = canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode image'));
    }, type, quality);
  });
}

/** Builds a thumbnail for an already-decoded image. */
function renderThumb(decoded: DecodedImage): Promise<Blob> {
  const { width, height } = fitWithinLongEdge(decoded.width, decoded.height, THUMB_MAX_EDGE);
  return renderToBlob(decoded.image, width, height, THUMB_TYPE, THUMB_QUALITY);
}

/**
 * Reads a video's intrinsic dimensions from its metadata (no frame decode).
 * Resolves undefined when the browser can't parse it — the lightbox then falls
 * back to the viewport size.
 */
function probeVideoDimensions(blob: Blob): Promise<{ width: number, height: number } | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    const done = (dims?: { width: number, height: number }) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(dims);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => done(video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : undefined);
    video.onerror = () => done(undefined);
    video.src = url;
  });
}

/* ---- CAPTURE / UPLOAD PIPELINE ---- */

/**
 * Turns a picked or captured file into a NewMediaItem (not yet stored — the
 * picker passes it straight to saveNewMedia()).
 *
 * Photos:
 *   - Web-safe and ≤ MAX_STORED_PIXELS → the original file is kept byte-for-byte
 *     (native resolution, EXIF intact).
 *   - Otherwise (HEIC/HEIF from an Android gallery, or 48MP+ sensor modes) →
 *     decoded and re-encoded as JPEG, downscaled to fit MAX_STORED_PIXELS.
 *   - Always gets a `thumb` and `width`/`height`.
 * iOS already hands over JPEG for camera captures and (with a wildcard `accept`)
 * transcodes HEIC library picks, so re-encoding is mainly an Android safety net.
 *
 * Videos are stored as-is; only their dimensions are probed.
 *
 * Throws a user-readable Error for unsupported or undecodable files.
 */
export async function processMediaFile(file: File): Promise<NewMediaItem> {
  const mimeType = file.type || mimeFromFilename(file.name);

  if (isVideoMime(mimeType)) {
    return { blob: file, mimeType, ...(await probeVideoDimensions(file)) };
  }
  if (!mimeType.startsWith('image/')) {
    throw new Error(
      `Unsupported file: ${file.name} (${mimeType || 'unknown type'})\n` +
      `Accepted: photos (JPEG, PNG, WebP, HEIC…) and videos (MP4, MOV…)`
    );
  }

  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error(isHeicMime(mimeType)
      ? `This device can't read HEIC photos (${file.name}). Set the camera to JPEG / "Most compatible", or pick a JPEG.`
      : `Could not read image: ${file.name}`);
  }

  try {
    let item: NewMediaItem = { blob: file, mimeType, width: decoded.width, height: decoded.height };
    if (needsReencode(mimeType, decoded.width, decoded.height)) {
      const size = fitWithinPixelBudget(decoded.width, decoded.height, MAX_STORED_PIXELS);
      const blob = await renderToBlob(decoded.image, size.width, size.height, REENCODE_TYPE, REENCODE_QUALITY);
      item = { blob, mimeType: REENCODE_TYPE, ...size };
    }
    item.thumb = await renderThumb(decoded);
    return item;
  } finally {
    decoded.release();
  }
}

/**
 * Fills in thumbnail and dimensions for media whose bytes came from somewhere
 * other than the picker (pre-v4 records, JSON imports, backups). Best effort:
 * a photo the browser can't decode is still kept, just without a thumbnail.
 */
async function deriveMetadata(blob: Blob, mimeType: string): Promise<Pick<NewMediaItem, 'width' | 'height' | 'thumb'>> {
  try {
    if (isVideoMime(mimeType)) return (await probeVideoDimensions(blob)) ?? {};
    const decoded = await decodeImage(blob);
    try {
      return { width: decoded.width, height: decoded.height, thumb: await renderThumb(decoded) };
    } finally {
      decoded.release();
    }
  } catch {
    return {};
  }
}

/* ---- MEDIA STORE ---- */

/**
 * Stores a new item as an insert-only `media` row and returns the in-memory
 * MediaItem (ref + Blobs). Called the moment a photo is captured or picked, so it
 * survives the page being discarded while the camera app is in front.
 *
 * Bytes are copied into fresh in-memory Blobs first: picker Files on iOS are backed
 * by temp files, and IndexedDB-backed Blobs (migration) must not be re-stored by
 * reference on WebKit — see the module header.
 */
export async function saveNewMedia(item: NewMediaItem): Promise<MediaItem> {
  const blob = new Blob([await item.blob.arrayBuffer()], { type: item.mimeType });
  // A thumbnail is regenerable; an unreadable one (pre-v4 data) must not fail the save.
  const thumb = item.thumb
    ? await item.thumb.arrayBuffer().then(b => new Blob([b], { type: THUMB_TYPE }), () => undefined)
    : undefined;
  const row: MediaRow = {
    id: crypto.randomUUID(),
    blob,
    mimeType: item.mimeType,
    size: blob.size,
    createdAt: new Date().toISOString(),
    ...(thumb ? { thumb } : {}),
    ...(item.width ? { width: item.width, height: item.height } : {}),
  };
  await insert('media', row);
  return { mediaId: row.id, mimeType: row.mimeType, width: row.width, height: row.height, size: row.size, blob, thumb };
}

/**
 * Converts one pre-v4 inline entry (embedded Blob or base64 data URL) into a stored
 * `media` row, deriving thumbnail/dimensions. Used by the migration, JSON import,
 * backup restore, and loadMedia()'s self-healing path.
 *
 * Reads the bytes BEFORE anything rewrites the owning record (WebKit — see the module
 * header). Bytes that are unreadable or empty yield a `damaged` item rather than
 * being dropped, so the loss stays visible and restorable.
 */
export async function importInlineMedia(entry: InlineMediaItem | string): Promise<MediaItem> {
  let blob: Blob;
  let mimeType: string;
  try {
    if (typeof entry === 'string') {
      ({ blob, mimeType } = base64ToBlob(entry));
    } else {
      mimeType = entry.mimeType || entry.blob.type || 'image/jpeg';
      blob = new Blob([await entry.blob.arrayBuffer()], { type: mimeType });
    }
  } catch {
    return damagedItem(typeof entry === 'string' ? 'image/jpeg' : entry.mimeType || 'image/jpeg');
  }
  if (!blob.size) return damagedItem(mimeType);
  const meta = typeof entry !== 'string' && entry.thumb && entry.width
    ? { width: entry.width, height: entry.height, thumb: entry.thumb }
    : await deriveMetadata(blob, mimeType);
  return saveNewMedia({ blob, mimeType, ...meta });
}

function damagedItem(mimeType: string): MediaItem {
  return { mediaId: crypto.randomUUID(), mimeType, damaged: true, missing: true };
}

/**
 * Loads media for display/editing: refs resolve to their `media` rows in one
 * transaction; order and count are preserved, so list indices line up with the
 * stored array. A damaged ref, a missing row, or an empty Blob comes back as
 * `missing: true`.
 *
 * Self-healing: a pre-v4 inline entry (only possible if the startup migration
 * could not finish) is stored as a new row on the fly, so the caller's next
 * write stores a ref instead of re-storing the Blob.
 */
export async function loadMedia(value: StoredMediaValue): Promise<MediaItem[]> {
  const entries = asArray(value).filter(e => classifyMediaEntry(e) !== 'invalid');
  const rows = await readMediaRows(entries.filter(isMediaRef).map(r => r.mediaId));
  const out: MediaItem[] = [];
  for (const entry of entries) {
    out.push(isMediaRef(entry)
      ? itemFromRow(entry, rows.get(entry.mediaId))
      : await importInlineMedia(entry as InlineMediaItem | string));
  }
  return out;
}

/**
 * Read-only variant of loadMedia() for exporters: resolves refs to rows and passes
 * inline entries through (decoding base64), never writing anything.
 */
export async function readMediaForExport(value: StoredMediaValue): Promise<MediaItem[]> {
  const entries = asArray(value).filter(e => classifyMediaEntry(e) !== 'invalid');
  const rows = await readMediaRows(entries.filter(isMediaRef).map(r => r.mediaId));
  return entries.map(entry => {
    if (isMediaRef(entry)) return itemFromRow(entry, rows.get(entry.mediaId));
    try {
      const { blob, mimeType } = typeof entry === 'string'
        ? base64ToBlob(entry)
        : { blob: (entry as InlineMediaItem).blob, mimeType: (entry as InlineMediaItem).mimeType || (entry as InlineMediaItem).blob.type };
      return { mediaId: '', mimeType, blob, size: blob.size, missing: !blob.size };
    } catch {
      return { mediaId: '', mimeType: 'image/jpeg', missing: true };
    }
  });
}

/** loadMedia() for a whole record, keeping the gallery / slot structure. */
export async function loadEntityMedia(entity: MediaFields, read: (v: StoredMediaValue) => Promise<MediaItem[]> = loadMedia):
  Promise<{ images: MediaItem[], slots: Array<[string, MediaItem[]]> }> {
  const { images, slots } = entityMediaLists(entity);
  const outSlots: Array<[string, MediaItem[]]> = [];
  for (const [slot, items] of slots) outSlots.push([slot, await read(items)]);
  return { images: await read(images), slots: outSlots };
}

async function readMediaRows(ids: string[]): Promise<Map<string, MediaRow>> {
  const unique = [...new Set(ids)];
  const rows = await getMany('media', unique);
  return new Map(rows.filter((r): r is MediaRow & Record<string, any> => r != null).map(r => [r.id, r as MediaRow]));
}

function itemFromRow(ref: MediaRef, row: MediaRow | undefined): MediaItem {
  if (ref.damaged || !row || !row.blob?.size) return { ...ref, missing: true };
  return { ...ref, blob: row.blob, thumb: row.thumb, width: ref.width ?? row.width, height: ref.height ?? row.height, size: row.size };
}

/* ---- LEGACY CONVERSION ---- */

/** Decodes a base64 data URL into a Blob (MIME type taken from the header). */
export function base64ToBlob(dataUrl: string): { blob: Blob, mimeType: string } {
  const [header, b64] = dataUrl.split(',');
  const mimeType = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return { blob: new Blob([arr], { type: mimeType }), mimeType };
}

/* ---- OBJECT URL LIFECYCLE ---- */

export const _mediaUrls: string[] = [];
/**
 * Index into _mediaUrls where the current form session's URLs begin. Set by
 * markFormMediaStart() each time a sheet form opens so that revokeFormMediaUrls()
 * revokes only form-specific entries, leaving detail-panel URLs intact.
 */
export let _formMediaStart = 0;

/**
 * Creates and tracks a blob object URL for a media item. `variant: 'thumb'`
 * uses the thumbnail when one exists (falls back to the full blob). Returns ''
 * for items without bytes. Release with revokeTrackedMediaUrl() /
 * revokeBlobUrlsInContainer() / revokeAllMediaUrls().
 */
export function createMediaUrl(mediaItem: MediaItem, variant: 'full' | 'thumb' = 'full'): string {
  const blob = variant === 'thumb' && mediaItem.thumb ? mediaItem.thumb : mediaItem.blob;
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  _mediaUrls.push(url);
  return url;
}

/**
 * Revokes one blob URL and removes it from the tracked pool. Call before
 * discarding an element that used createMediaUrl() so the pool doesn't grow
 * when a gallery is re-rendered. Revoking an untracked or already-revoked URL
 * is a safe no-op; non-blob URLs are ignored.
 */
export function revokeTrackedMediaUrl(url: string): void {
  if (!url.startsWith('blob:')) return;
  const i = _mediaUrls.indexOf(url);
  if (i !== -1) _mediaUrls.splice(i, 1);
  URL.revokeObjectURL(url);
}

/**
 * Revokes all blob URLs referenced by <img>/<video> elements inside containerEl.
 * Call immediately before any innerHTML assignment that destroys blob-src elements.
 * Handles tracked URLs and untracked ones (list-card thumbnails from hydrateMediaThumbs()).
 */
export function revokeBlobUrlsInContainer(containerEl: Element): void {
  containerEl.querySelectorAll('img[src^="blob:"], video[src^="blob:"]').forEach(el => {
    revokeTrackedMediaUrl((el as HTMLImageElement | HTMLVideoElement).src);
  });
}

/** Records the pool boundary just before a sheet form opens. */
export function markFormMediaStart(): void {
  _formMediaStart = _mediaUrls.length;
}

/** Revokes only URLs created since the last markFormMediaStart() (the sheet form's own). */
export function revokeFormMediaUrls(): void {
  _mediaUrls.splice(_formMediaStart).forEach(u => URL.revokeObjectURL(u));
}

/** Revokes every tracked URL — call when the detail panel closes or all data is cleared. */
export function revokeAllMediaUrls(): void {
  _mediaUrls.forEach(u => URL.revokeObjectURL(u));
  _mediaUrls.length = 0;
  _formMediaStart = 0;
}

/* ---- LIST-CARD THUMBNAILS ---- */

/**
 * List cards are rendered as HTML strings, so they can't await media loads. Card
 * renderers emit a placeholder carrying `data-media-id` (see cardThumbHtml() in
 * app.ts); this swaps every such placeholder for an <img> of the stored thumbnail,
 * loading all of them in one transaction. Placeholders whose media is missing
 * keep showing the entity icon. The URLs are untracked — the existing
 * revokeBlobUrlsInContainer() calls before list re-renders release them.
 */
export async function hydrateMediaThumbs(root: ParentNode): Promise<void> {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('[data-media-id]:not([data-hydrating])'));
  if (!placeholders.length) return;
  placeholders.forEach(el => el.setAttribute('data-hydrating', ''));
  const rows = await readMediaRows(placeholders.map(el => el.dataset.mediaId as string));
  for (const el of placeholders) {
    const row = rows.get(el.dataset.mediaId as string);
    const blob = row?.thumb ?? (row?.blob?.size ? row.blob : undefined);
    if (!blob || !el.isConnected) continue;
    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.alt = '';
    img.decoding = 'async';
    img.src = URL.createObjectURL(blob);
    el.replaceWith(img);
  }
}

/**
 * Hydrates card thumbnails wherever cards get rendered, without every renderer
 * having to remember to call hydrateMediaThumbs(): a MutationObserver batches
 * newly inserted placeholders once per microtask.
 */
export function initMediaThumbHydration(root: HTMLElement): void {
  let scheduled = false;
  const run = () => { scheduled = false; void hydrateMediaThumbs(root); };
  new MutationObserver(() => {
    if (!scheduled) { scheduled = true; queueMicrotask(run); }
  }).observe(root, { childList: true, subtree: true });
  run();
}
