/* ============================================================
   MEDIA
   Everything about photos/videos attached to records: the stored
   data shapes, the capture/upload processing pipeline, thumbnail
   generation, object-URL lifecycle, and entity-level media helpers.
   No imports from app modules — safe to load in unit tests without
   a DOM (DOM APIs are only touched inside the async pipeline).
   The fullscreen viewer lives separately in lightbox.ts (lazy-loaded).
   ============================================================ */

/* ---- DATA SHAPES ---- */

/**
 * The current stored shape of one photo/video.
 *   - `blob`      The stored file. For photos this is the original camera/library
 *                 file byte-for-byte (EXIF intact) unless it had to be re-encoded —
 *                 see needsReencode().
 *   - `width`/`height`  Display dimensions of `blob` (EXIF orientation applied).
 *                 Lets the lightbox open at the right aspect ratio without a reflow.
 *   - `thumb`     Small JPEG used by grids/cards so lists never decode full-res
 *                 bitmaps (a 12MP bitmap is ~48MB of RAM — iOS kills the tab).
 * width/height/thumb are optional: records saved before they existed, and records
 * restored from JSON import, lack them until ensureMediaMetadata() backfills them.
 * `_legacySrc?: undefined` lets this union cleanly with NormalizedLegacyItem.
 */
export type BlobMediaItem = {
  blob: Blob,
  mimeType: string,
  width?: number,
  height?: number,
  thumb?: Blob,
  _legacySrc?: undefined,
};

/**
 * Historical stored shapes of a media value:
 *   - A raw base64 data-URL string (oldest format, pre-blob storage).
 *   - A BlobMediaItem (current format).
 *   - An array of either (namedPhotos slots and the "Other Media" gallery).
 * normalizeMediaItems() is the sanctioned entry point that turns any of these
 * into a uniform NormalizedMediaItem[]; other modules consume that output.
 */
export type LegacyBase64MediaItem = string;
export type RawMediaItem = BlobMediaItem | LegacyBase64MediaItem;
export type StoredMediaValue = RawMediaItem | RawMediaItem[] | undefined | null;

/** A legacy base64 item after normalizeMediaItems() — never branched on via typeof again. */
export type NormalizedLegacyItem = {
  _legacySrc: string,
  mimeType: string,
  blob?: undefined,
  width?: undefined,
  height?: undefined,
  thumb?: undefined,
};
export type NormalizedMediaItem = BlobMediaItem | NormalizedLegacyItem;

/** Call sites that legitimately see either raw or normalized shapes. */
export type MediaItemLike = RawMediaItem | NormalizedMediaItem;
export type AnyMediaValue = MediaItemLike | MediaItemLike[] | undefined | null;

/**
 * The media-bearing fields of any record (entities, checklist items, detail-panel
 * state). The index signature lets whole records (DbRecord) be passed directly.
 */
export interface MediaFields {
  images?: AnyMediaValue,
  namedPhotos?: Record<string, AnyMediaValue> | null,
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

/* ---- ENTITY-LEVEL MEDIA HELPERS ---- */

/**
 * Splits a record's media into its gallery images and its named-photo slots,
 * each coerced to an array (legacy records stored single values).
 */
export function entityMediaLists(entity: MediaFields): { images: MediaItemLike[], slots: Array<[string, MediaItemLike[]]> } {
  return {
    images: asArray(entity.images),
    slots: Object.entries(entity.namedPhotos ?? {}).map(([slot, value]) => [slot, asArray(value)]),
  };
}

/** Every media item on a record (named-photo slots, then the gallery), flattened. */
export function collectEntityMedia(entity: MediaFields): MediaItemLike[] {
  const { images, slots } = entityMediaLists(entity);
  return [...slots.flatMap(([, items]) => items), ...images];
}

/** True when the record has at least one photo or video in any slot or the gallery. */
export function entityHasMedia(entity: MediaFields): boolean {
  return collectEntityMedia(entity).length > 0;
}

/** The media item a list card uses as its thumbnail: first gallery image, else first slot photo. */
export function getFirstMedia(entity: MediaFields): MediaItemLike | null {
  const { images, slots } = entityMediaLists(entity);
  return images[0] ?? slots.find(([, items]) => items.length)?.[1][0] ?? null;
}

/**
 * Returns a shallow copy of `entity` with every media item replaced by fn(item).
 * Items for which fn returns null/undefined are dropped. Fields absent on the
 * input stay absent on the output.
 */
export function mapEntityMedia<T extends Record<string, any>>(entity: T, fn: (item: MediaItemLike) => unknown): T {
  const out: Record<string, any> = { ...entity };
  const keep = (items: MediaItemLike[]) => items.map(fn).filter(x => x != null);
  if (entity.images) out.images = keep(asArray(entity.images));
  if (entity.namedPhotos) {
    out.namedPhotos = Object.fromEntries(entityMediaLists(entity).slots.map(([slot, items]) => [slot, keep(items)]));
  }
  return out as T;
}

/** Async variant of mapEntityMedia(): converts every item concurrently, then rebuilds the record. */
export async function mapEntityMediaAsync<T extends Record<string, any>>(entity: T, fn: (item: MediaItemLike) => Promise<unknown>): Promise<T> {
  const items = collectEntityMedia(entity);
  const results = new Map(await Promise.all(items.map(async item => [item, await fn(item)] as const)));
  return mapEntityMedia(entity, item => results.get(item));
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
 * Turns a picked or captured file into a storable BlobMediaItem.
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
export async function processMediaFile(file: File): Promise<BlobMediaItem> {
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
    let stored: BlobMediaItem = { blob: file, mimeType, width: decoded.width, height: decoded.height };
    if (needsReencode(mimeType, decoded.width, decoded.height)) {
      const size = fitWithinPixelBudget(decoded.width, decoded.height, MAX_STORED_PIXELS);
      const blob = await renderToBlob(decoded.image, size.width, size.height, REENCODE_TYPE, REENCODE_QUALITY);
      stored = { blob, mimeType: REENCODE_TYPE, ...size };
    }
    stored.thumb = await renderThumb(decoded);
    return stored;
  } finally {
    decoded.release();
  }
}

/**
 * Backfills `thumb` and `width`/`height` on image items that lack them (records
 * saved before thumbnails existed, or restored from a JSON import, which carries
 * only the original bytes). Mutates the items in place, one at a time to bound
 * peak memory. Returns true when anything changed so the caller can persist.
 * Undecodable items are skipped silently — they still display via the full blob.
 */
export async function ensureMediaMetadata(items: NormalizedMediaItem[]): Promise<boolean> {
  let changed = false;
  for (const item of items) {
    if (!item.blob || isVideoMime(item.mimeType) || (item.thumb && item.width)) continue;
    try {
      const decoded = await decodeImage(item.blob);
      try {
        item.width = decoded.width;
        item.height = decoded.height;
        item.thumb = await renderThumb(decoded);
        changed = true;
      } finally {
        decoded.release();
      }
    } catch { /* leave as-is */ }
  }
  return changed;
}

/* ---- LEGACY CONVERSION / NORMALIZATION ---- */

/**
 * Converts a legacy base64 data URL to a BlobMediaItem (MIME type taken from the header).
 */
export function base64ToMediaItem(dataUrl: string): BlobMediaItem {
  const [header, b64] = dataUrl.split(',');
  const mimeType = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return { blob: new Blob([arr], { type: mimeType }), mimeType };
}

/**
 * Normalises a stored media value into NormalizedMediaItem[]. Legacy base64
 * strings become NormalizedLegacyItems (displayed straight from the data URL).
 */
export function normalizeMediaItems(value: StoredMediaValue): NormalizedMediaItem[] {
  return asArray(value).map(x => (typeof x === 'string' ? { _legacySrc: x, mimeType: 'image/jpeg' } : x));
}

/**
 * Like normalizeMediaItems(), but converts legacy base64 strings to real blobs.
 * Used where the result is edited and saved back (the form sheet).
 */
export function toBlobMediaItems(value: StoredMediaValue): BlobMediaItem[] {
  return asArray(value).map(x => (typeof x === 'string' ? base64ToMediaItem(x) : x));
}

/**
 * Converts IDB-backed blobs to fresh in-memory blobs before writing back to IndexedDB.
 * WebKit/Safari cannot reliably re-store blobs retrieved from IndexedDB via structured
 * clone — they write back as zero-byte blobs, causing broken media after a
 * close-and-reopen cycle. Reading via arrayBuffer() + new Blob() produces a true
 * in-memory copy. Applies to every Blob on the item (`blob` and `thumb`).
 */
export async function freshenMediaItems(items: NormalizedMediaItem[] | undefined | null): Promise<NormalizedMediaItem[]> {
  if (!items?.length) return [];
  const freshen = async (blob: Blob, type: string) => new Blob([await blob.arrayBuffer()], { type: blob.type || type });
  return Promise.all(items.map(async mi => {
    if (!mi?.blob) return mi;
    try {
      return {
        ...mi,
        blob: await freshen(mi.blob, mi.mimeType),
        ...(mi.thumb ? { thumb: await freshen(mi.thumb, THUMB_TYPE) } : {}),
      };
    } catch {
      return mi;
    }
  }));
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
 * uses the thumbnail when one exists (falls back to the full blob). Legacy
 * base64 items return their data URL directly (nothing to track or revoke).
 * Release with revokeTrackedMediaUrl()/revokeBlobUrlsInContainer()/revokeAllMediaUrls().
 */
export function createMediaUrl(mediaItem: NormalizedMediaItem, variant: 'full' | 'thumb' = 'full'): string {
  if (!mediaItem.blob) return mediaItem._legacySrc ?? '';
  const url = URL.createObjectURL(variant === 'thumb' && mediaItem.thumb ? mediaItem.thumb : mediaItem.blob);
  _mediaUrls.push(url);
  return url;
}

/**
 * Revokes one blob URL and removes it from the tracked pool. Call before
 * discarding an element that used createMediaUrl() so the pool doesn't grow
 * when a gallery is re-rendered. Revoking an untracked or already-revoked URL
 * is a safe no-op; non-blob (data:) URLs are ignored.
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
 * Handles tracked URLs and untracked ones (e.g. from getCardThumbSrc()).
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

/**
 * Returns a src for a list-card thumbnail <img>, preferring the small `thumb`.
 * Accepts raw or normalized items, or an array (uses the first). Videos have no
 * card thumbnail. URLs created here are untracked — callers revoke them with
 * revokeBlobUrlsInContainer() before replacing the card list.
 */
export function getCardThumbSrc(mediaValue: AnyMediaValue): string | null {
  const item = Array.isArray(mediaValue) ? mediaValue[0] : mediaValue;
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (item._legacySrc) return item._legacySrc;
  if (isVideoMime(item.mimeType) || !item.blob) return null;
  return URL.createObjectURL(item.thumb ?? item.blob);
}
