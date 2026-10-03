import { describe, it, expect } from 'vitest';

import type { MediaRef } from './media.js';

/**
 * media.ts imports only db.ts (no top-level side effects) and lightbox.ts only
 * media.ts (PhotoSwipe is a dynamic import() inside openMediaLightbox), so unlike
 * utils.test.ts no `window` stub is needed under vitest's DOM-free "node"
 * environment. Only the pure helpers are tested here; IndexedDB-backed flows are
 * in media-io.test.ts, and the decode/encode pipeline needs a real browser canvas
 * (see the plan's manual device checklist).
 */
import {
  MAX_STORED_PIXELS,
  THUMB_MAX_EDGE,
  classifyMediaEntry,
  collectEntityMedia,
  collectMediaIds,
  countInlineEntries,
  entityHasMedia,
  extensionForMime,
  fitWithinLongEdge,
  fitWithinPixelBudget,
  getFirstMedia,
  hasInlineMedia,
  isUsableMediaEntry,
  mapEntityMedia,
  mapEntityMediaAsync,
  mimeFromFilename,
  needsReencode,
  toMediaRef,
  toMediaRefs,
} from './media.js';
import { computeZoomLevels } from './lightbox.js';

const ref = (mediaId: string, extra: Partial<MediaRef> = {}): MediaRef => ({ mediaId, mimeType: 'image/jpeg', ...extra });
const inline = (bytes = 'x') => ({ blob: new Blob([bytes], { type: 'image/jpeg' }), mimeType: 'image/jpeg' });

describe('fitWithinPixelBudget', () => {
  it('leaves images within budget untouched', () => {
    expect(fitWithinPixelBudget(4032, 3024, MAX_STORED_PIXELS)).toEqual({ width: 4032, height: 3024 });
  });

  it('downscales a 48MP photo to fit the budget, preserving aspect ratio', () => {
    const { width, height } = fitWithinPixelBudget(8064, 6048, MAX_STORED_PIXELS);
    expect(width * height).toBeLessThanOrEqual(MAX_STORED_PIXELS);
    expect(width * height).toBeGreaterThan(MAX_STORED_PIXELS * 0.99);
    expect(width / height).toBeCloseTo(8064 / 6048, 2);
  });

  it('stays under the iOS canvas area limit', () => {
    const { width, height } = fitWithinPixelBudget(16320, 12240, MAX_STORED_PIXELS); // 200MP
    expect(width * height).toBeLessThan(16_777_216);
  });
});

describe('fitWithinLongEdge', () => {
  it('scales the long edge down to the limit', () => {
    expect(fitWithinLongEdge(4000, 3000, THUMB_MAX_EDGE)).toEqual({ width: 480, height: 360 });
    expect(fitWithinLongEdge(3000, 4000, THUMB_MAX_EDGE)).toEqual({ width: 360, height: 480 });
  });

  it('never upscales', () => {
    expect(fitWithinLongEdge(200, 100, THUMB_MAX_EDGE)).toEqual({ width: 200, height: 100 });
  });
});

describe('needsReencode', () => {
  it('keeps web-safe originals within the pixel budget', () => {
    expect(needsReencode('image/jpeg', 4032, 3024)).toBe(false);
    expect(needsReencode('image/png', 1000, 1000)).toBe(false);
  });

  it('re-encodes formats browsers cannot all display', () => {
    expect(needsReencode('image/heic', 4032, 3024)).toBe(true);
    expect(needsReencode('image/tiff', 100, 100)).toBe(true);
  });

  it('re-encodes oversized images', () => {
    expect(needsReencode('image/jpeg', 8064, 6048)).toBe(true);
  });
});

describe('extensionForMime / mimeFromFilename', () => {
  it('maps known types', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/png')).toBe('png');
    expect(extensionForMime('video/quicktime')).toBe('mov');
  });

  it('falls back to the subtype, then "bin"', () => {
    expect(extensionForMime('image/x-icon')).toBe('xicon');
    expect(extensionForMime('')).toBe('bin');
    expect(extensionForMime(undefined)).toBe('bin');
  });

  it('infers MIME types from filenames (Android sometimes sends an empty type)', () => {
    expect(mimeFromFilename('IMG_0001.HEIC')).toBe('image/heic');
    expect(mimeFromFilename('photo.jpeg')).toBe('image/jpeg');
    expect(mimeFromFilename('clip.mov')).toBe('video/quicktime');
    expect(mimeFromFilename('notes.txt')).toBe('');
  });
});

describe('entity media helpers', () => {
  const a = ref('a'), b = ref('b'), c = ref('c');

  it('collects slot and gallery entries, coercing legacy single values', () => {
    const entity = { images: [a], namedPhotos: { Nameplate: b, Overview: [c] } };
    expect(collectEntityMedia(entity)).toEqual([b, c, a]);
    expect(collectMediaIds(entity)).toEqual(['b', 'c', 'a']);
  });

  it('entityHasMedia ignores empty slots', () => {
    expect(entityHasMedia({ images: [], namedPhotos: { Nameplate: [] } })).toBe(false);
    expect(entityHasMedia({ namedPhotos: { Nameplate: [a] } })).toBe(true);
    expect(entityHasMedia({})).toBe(false);
  });

  it('getFirstMedia prefers the gallery, then the first usable slot photo', () => {
    expect(getFirstMedia({ images: [a], namedPhotos: { X: [b] } })).toBe(a);
    expect(getFirstMedia({ images: [], namedPhotos: { X: [], Y: [c] } })).toBe(c);
    expect(getFirstMedia({})).toBeNull();
  });

  it('getFirstMedia skips damaged photos and videos', () => {
    const damaged = ref('d', { damaged: true });
    const video = ref('v', { mimeType: 'video/mp4' });
    expect(getFirstMedia({ images: [damaged, video, b] })).toBe(b);
    expect(getFirstMedia({ images: [damaged] })).toBeNull();
  });

  it('mapEntityMedia maps every entry, drops null results, and keeps absent fields absent', () => {
    const out = mapEntityMedia({ id: '1', images: [a, b], namedPhotos: { X: [c] } },
      item => (item === b ? null : 'mapped'));
    expect(out).toEqual({ id: '1', images: ['mapped'], namedPhotos: { X: ['mapped'] } });
    expect('images' in mapEntityMedia({ id: '2' }, x => x)).toBe(false);
  });

  it('mapEntityMediaAsync resolves conversions back into place, in order', async () => {
    const seen: unknown[] = [];
    const out = await mapEntityMediaAsync({ images: [a], namedPhotos: { X: [b] } },
      async item => { seen.push(item); return item === a ? 'A' : 'B'; });
    expect(out).toEqual({ images: ['A'], namedPhotos: { X: ['B'] } });
    expect(seen).toEqual([b, a]);
  });
});

describe('stored entry classification', () => {
  it('classifies refs, inline blobs, base64 strings and junk', () => {
    expect(classifyMediaEntry(ref('a'))).toBe('ref');
    expect(classifyMediaEntry(inline())).toBe('inline');
    expect(classifyMediaEntry('data:image/jpeg;base64,AA')).toBe('base64');
    expect(classifyMediaEntry('https://example.com/x.jpg')).toBe('invalid');
    expect(classifyMediaEntry(null)).toBe('invalid');
    expect(classifyMediaEntry({ mimeType: 'image/jpeg' })).toBe('invalid');
  });

  it('counts inline (pre-v4) entries so records needing migration are found', () => {
    const legacy = { images: [inline(), ref('a')], namedPhotos: { X: 'data:image/jpeg;base64,AA' } };
    expect(countInlineEntries(legacy)).toBe(2);
    expect(hasInlineMedia(legacy)).toBe(true);
    expect(hasInlineMedia({ images: [ref('a')] })).toBe(false);
  });

  it('treats damaged refs as unusable', () => {
    expect(isUsableMediaEntry(ref('a'))).toBe(true);
    expect(isUsableMediaEntry(ref('a', { damaged: true }))).toBe(false);
    expect(isUsableMediaEntry(inline())).toBe(true);
    expect(isUsableMediaEntry('nope')).toBe(false);
  });
});

describe('toMediaRef(s)', () => {
  it('strips loaded Blobs, keeping only what a record stores', () => {
    const item = { ...ref('a', { width: 4, height: 3, size: 99 }), blob: new Blob(['x']), thumb: new Blob(['t']) };
    expect(toMediaRef(item)).toEqual({ mediaId: 'a', mimeType: 'image/jpeg', width: 4, height: 3, size: 99 });
  });

  it('keeps missing items as damaged refs (so they can be restored in place)', () => {
    expect(toMediaRefs([{ ...ref('a'), missing: true }])).toEqual([{ mediaId: 'a', mimeType: 'image/jpeg', damaged: true }]);
  });
});

describe('computeZoomLevels', () => {
  it('double-tap goes to actual device pixels for large photos', () => {
    // 4032px-wide photo fit to a 390px-wide phone screen at 3x DPR.
    const fit = 390 / 4032;
    const { secondary, max } = computeZoomLevels(fit, 3);
    expect(secondary).toBeCloseTo(1 / 3);
    expect(max).toBe(1);
  });

  it('always zooms at least 2x fit, and never past max', () => {
    const { secondary, max } = computeZoomLevels(0.9, 1);
    expect(secondary).toBeLessThanOrEqual(max);
    expect(secondary).toBeGreaterThanOrEqual(1);
    expect(max).toBeCloseTo(3.6);
  });
});
