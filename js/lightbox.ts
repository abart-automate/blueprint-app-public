import type { MediaItem } from './media.js';

import { saveMediaFilesToDevice } from './device-save.js';
import { createMediaUrl, isVideoMime, mediaItemExtension, revokeTrackedMediaUrl } from './media.js';
import { showToast } from './state.js';
/* ============================================================
   LIGHTBOX
   Fullscreen photo/video viewer built on PhotoSwipe v5: pinch / wheel
   zoom down to actual device pixels, pan, swipe between items.
   PhotoSwipe, its video plugin and its CSS are loaded with a dynamic
   import() on first open, so they stay out of the main bundle (Vite
   emits them as a separate chunk, which sw.js still precaches for
   offline use).
   ============================================================ */

/**
 * Zoom levels for one slide, given PhotoSwipe's "fit" level and the device pixel ratio.
 * Zoom level 1 means one image pixel per CSS pixel, so 1/dpr is one image pixel per
 * *device* pixel — "actual size" on a phone screen.
 *   - secondary (double-tap / click / zoom button): actual size, but always at least 2× fit
 *     so small images still visibly zoom.
 *   - max (pinch / wheel limit): at least 1 (one image px per CSS px, i.e. beyond actual
 *     size on high-DPR phones — enough to read a nameplate) and at least 4× fit.
 */
export function computeZoomLevels(fit: number, dpr: number): { secondary: number, max: number } {
  const max = Math.max(1, fit * 4);
  const secondary = Math.min(max, Math.max(fit * 2, 1 / dpr));
  return { secondary, max };
}

/** Loads an image URL just far enough to read its natural size (legacy items lack stored dimensions). */
async function measureImage(src: string): Promise<{ width: number, height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/** Download icon sized and styled like PhotoSwipe's built-in toolbar icons. */
const DOWNLOAD_ICON =
  '<svg class="pswp__icn" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">' +
  '<path d="M16 6v13M10.5 13.5 16 19l5.5-5.5M8 23h16" fill="none" stroke="currentColor" ' +
  'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Saves one viewed item. The File is built from the already-loaded Blob without
 * awaiting anything first, so the tap still counts as a user gesture for the iOS
 * share sheet ("Save Image" / "Save Video" → Photos).
 */
async function saveLightboxItem(item: MediaItem | undefined): Promise<void> {
  if (!item?.blob) return;
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const file = new File([item.blob], `blueprint-${stamp}.${mediaItemExtension(item)}`, { type: item.mimeType || item.blob.type });
  try {
    await saveMediaFilesToDevice([file]);
  } catch (err) {
    showToast('Could not save photo: ' + (err instanceof Error ? err.message : String(err)), 'error');
  }
}

/**
 * Opens the fullscreen viewer at items[index].
 *
 * Images open at their stored width/height so the opening frame has the right aspect
 * ratio, with the small thumbnail shown as a placeholder (`msrc`) while the full-res
 * original decodes. Legacy items without stored dimensions: the clicked one is measured
 * before opening; any others are corrected when they load (loadComplete).
 *
 * Videos go through photoswipe-video-plugin, which renders a native <video> with
 * controls + playsinline (required for inline playback on iOS) and pauses it on swipe.
 *
 * Items whose bytes are unavailable (`missing`) are skipped; `index` refers to the
 * caller's full list and is remapped onto the remaining items.
 *
 * Every object URL created here is tracked and revoked when the viewer is destroyed —
 * PhotoSwipe's DOM lives outside #app, so revokeBlobUrlsInContainer() never reaches it.
 */
export async function openMediaLightbox(allItems: MediaItem[], index: number): Promise<void> {
  const items = allItems.filter(item => !item.missing);
  if (!items.length) return;
  const startIndex = Math.max(0, items.indexOf(allItems[index]));

  const [{ default: PhotoSwipeLightbox }, { default: PhotoSwipeVideoPlugin }] = await Promise.all([
    import('photoswipe/lightbox'),
    import('photoswipe-video-plugin'),
    import('photoswipe/style.css'),
  ]);

  const urls: string[] = [];
  const track = (url: string) => { urls.push(url); return url; };

  const dataSource = items.map(item => {
    const src = track(createMediaUrl(item));
    if (isVideoMime(item.mimeType)) {
      return {
        type: 'video' as const,
        videoSrc: src,
        width: item.width ?? window.innerWidth,
        height: item.height ?? window.innerHeight,
      };
    }
    return {
      src,
      msrc: item.thumb ? track(createMediaUrl(item, 'thumb')) : undefined,
      width: item.width ?? 0,
      height: item.height ?? 0,
    };
  });

  const opening = dataSource[startIndex];
  if (opening && !('type' in opening) && !opening.width) {
    try {
      Object.assign(opening, await measureImage(opening.src));
    } catch { /* loadComplete below corrects it */ }
  }

  const zoomFor = (key: 'secondary' | 'max') =>
    ({ fit }: { fit: number }) => computeZoomLevels(fit, window.devicePixelRatio || 1)[key];

  const lightbox = new PhotoSwipeLightbox({
    pswpModule: () => import('photoswipe'),
    dataSource,
    bgOpacity: 0.92,
    loop: false,
    wheelToZoom: true,
    // One neighbour each side: full-res originals are large, keep at most 3 decoded.
    preload: [1, 1],
    initialZoomLevel: 'fit',
    secondaryZoomLevel: zoomFor('secondary'),
    maxZoomLevel: zoomFor('max'),
    imageClickAction: 'zoom-or-close',
    tapAction: 'toggle-controls',
    doubleTapAction: 'zoom',
  });

  new PhotoSwipeVideoPlugin(lightbox, {
    videoAttributes: { controls: '', playsinline: '' },
  });

  // Toolbar button: save the item being viewed to the device (camera roll on iOS).
  lightbox.on('uiRegister', () => {
    lightbox.pswp?.ui?.registerElement({
      name: 'download',
      order: 9,
      isButton: true,
      title: 'Save to device',
      html: DOWNLOAD_ICON,
      onClick: (_e, _el, pswp) => void saveLightboxItem(items[pswp.currIndex]),
    });
  });

  // Fallback for legacy slides opened without stored dimensions: read the real size once loaded.
  lightbox.on('loadComplete', ({ slide }) => {
    const el = slide.content.element;
    if (!slide.data.width && el instanceof HTMLImageElement) {
      slide.data.width = el.naturalWidth;
      slide.data.height = el.naturalHeight;
      slide.pswp.updateSize(true);
    }
  });

  lightbox.on('destroy', () => {
    urls.forEach(revokeTrackedMediaUrl);
    // Defer: calling lightbox.destroy() synchronously inside the pswp destroy dispatch
    // would re-enter pswp.destroy(). By the next tick the lightbox has dropped its pswp.
    setTimeout(() => lightbox.destroy(), 0);
  });

  lightbox.init();
  lightbox.loadAndOpen(startIndex);
}
