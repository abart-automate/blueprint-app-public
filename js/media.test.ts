import { describe, it, expect } from 'vitest';

import type { BlobMediaItem } from './media.js';

/**
 * media.ts and lightbox.ts have no app-module imports (PhotoSwipe is only
 * pulled in by a dynamic import() inside openMediaLightbox), so unlike
 * utils.test.ts no `window` stub is needed to load them under vitest's
 * DOM-free "node" environment. Only the pure helpers are tested here; the
 * decode/encode pipeline needs a real browser canvas (see the plan's manual
 * device checklist).
 */
import {
  MAX_STORED_PIXELS,
  THUMB_MAX_EDGE,
  collectEntityMedia,
  entityHasMedia,
  extensionForMime,
  fitWithinLongEdge,
  fitWithinPixelBudget,
  freshenMediaItems,
  getFirstMedia,
  mapEntityMedia,
  mapEntityMediaAsync,
  mimeFromFilename,
  needsReencode,
  normalizeMediaItems,
} from './media.js';
import { computeZoomLevels } from './lightbox.js';

const blobItem = (bytes = 'x', mimeType = 'image/jpeg'): BlobMediaItem =>
  ({ blob: new Blob([bytes], { type: mimeType }), mimeType });

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
  const a = blobItem('a'), b = blobItem('b'), c = blobItem('c');

  it('collects slot and gallery items, coercing legacy single values', () => {
    const entity = { images: [a], namedPhotos: { Nameplate: b, Overview: [c] } };
    expect(collectEntityMedia(entity)).toEqual([b, c, a]);
  });

  it('entityHasMedia ignores empty slots', () => {
    expect(entityHasMedia({ images: [], namedPhotos: { Nameplate: [] } })).toBe(false);
    expect(entityHasMedia({ namedPhotos: { Nameplate: [a] } })).toBe(true);
    expect(entityHasMedia({})).toBe(false);
  });

  it('getFirstMedia prefers the gallery, then the first non-empty slot', () => {
    expect(getFirstMedia({ images: [a], namedPhotos: { X: [b] } })).toBe(a);
    expect(getFirstMedia({ images: [], namedPhotos: { X: [], Y: [c] } })).toBe(c);
    expect(getFirstMedia({})).toBeNull();
  });

  it('mapEntityMedia maps every item, drops null results, and keeps absent fields absent', () => {
    const out = mapEntityMedia({ id: '1', images: [a, b], namedPhotos: { X: [c] } },
      item => (item === b ? null : 'mapped'));
    expect(out).toEqual({ id: '1', images: ['mapped'], namedPhotos: { X: ['mapped'] } });
    expect('images' in mapEntityMedia({ id: '2' }, x => x)).toBe(false);
  });

  it('mapEntityMediaAsync resolves conversions back into place', async () => {
    const out = await mapEntityMediaAsync({ images: [a], namedPhotos: { X: [b] } },
      async item => (item === a ? 'A' : 'B'));
    expect(out).toEqual({ images: ['A'], namedPhotos: { X: ['B'] } });
  });
});

describe('normalizeMediaItems', () => {
  it('wraps legacy base64 strings and passes blob items through', () => {
    const item = blobItem();
    expect(normalizeMediaItems(['data:image/jpeg;base64,AA', item])).toEqual([
      { _legacySrc: 'data:image/jpeg;base64,AA', mimeType: 'image/jpeg' },
      item,
    ]);
    expect(normalizeMediaItems(undefined)).toEqual([]);
  });
});

describe('freshenMediaItems', () => {
  it('copies both the original blob and the thumbnail into new in-memory blobs', async () => {
    const original = { ...blobItem('full'), thumb: new Blob(['thumb'], { type: 'image/jpeg' }), width: 10, height: 5 };
    const [fresh] = await freshenMediaItems([original]) as BlobMediaItem[];
    expect(fresh.blob).not.toBe(original.blob);
    expect(fresh.thumb).not.toBe(original.thumb);
    expect(await fresh.blob.text()).toBe('full');
    expect(await fresh.thumb!.text()).toBe('thumb');
    expect(fresh.width).toBe(10);
  });

  it('leaves legacy items untouched', async () => {
    const legacy = { _legacySrc: 'data:x', mimeType: 'image/jpeg' };
    expect(await freshenMediaItems([legacy])).toEqual([legacy]);
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
