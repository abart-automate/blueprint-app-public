/* ============================================================
   DEVICE SAVE
   Saving files to the device: the iOS share sheet vs. a plain
   <a download>. No app imports, so the lazily-used lightbox can
   share it with the exporters without pulling in export.ts.
   ============================================================ */

/** iPhone/iPad, including iPadOS reporting itself as a Mac. */
function isIOSDevice(): boolean {
  return /iP(hone|od|ad)/.test(navigator.userAgent)
    || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
}

/**
 * True when `files` should be saved through the OS share sheet rather than an
 * <a download> link. Only on iOS: there, downloading a blob URL is unreliable in
 * an installed (standalone) PWA, while the share sheet offers "Save to Files" (and
 * "Save Image" / "Save Video" for media). Android keeps the normal download (its
 * share sheet has no generic "save" target, and Chrome refuses to share ZIP files).
 */
export function shouldShareFiles(files: File[]): boolean {
  return isIOSDevice() && typeof navigator.canShare === 'function' && navigator.canShare({ files });
}

/**
 * Opens the share sheet with only `files` (adding title/text makes iOS hide
 * "Save Image"). Resolves false if the user dismissed it. Must run inside a user gesture.
 */
async function shareFiles(files: File[]): Promise<boolean> {
  try {
    await navigator.share({ files });
    return true;
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return false;
    throw err;
  }
}

/** Plain <a download> save. The URL is revoked later; revoking right after click() can cancel it on mobile. */
function downloadViaLink(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Saves a generated file to the device. Returns false if the user dismissed the
 * share sheet. On iOS this must run inside a user gesture (see deliverExport()).
 */
export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (shouldShareFiles([file])) return shareFiles([file]);
  downloadViaLink(blob, filename);
  return true;
}

/**
 * Saves photos/videos to the device's photo library where the web allows it.
 * iOS: the share sheet, whose "Save Image(s)" / "Save Video" puts them in Photos.
 * It must be called inside the tap's user gesture, so callers build the Files
 * from already-loaded Blobs without awaiting anything first.
 * Elsewhere (Android, desktop) there is no gallery API: each file is downloaded
 * individually (Android's Gallery/Photos shows the Downloads folder), staggered
 * so the browser doesn't drop rapid consecutive downloads.
 * Resolves false if nothing was saved (no files, or the share sheet was dismissed).
 */
export async function saveMediaFilesToDevice(files: File[]): Promise<boolean> {
  if (!files.length) return false;
  if (shouldShareFiles(files)) return shareFiles(files);
  for (const [i, file] of files.entries()) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 250));
    downloadViaLink(file, file.name);
  }
  return true;
}
