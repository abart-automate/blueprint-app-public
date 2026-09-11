import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * utils.js imports app.js (for renderDetailPlaceholder), whose import graph
 * does a top-level `(window as any).exportToZip = ...` assignment (see
 * export.js) — harmless in a real browser, but it throws ReferenceError
 * under vitest's default DOM-free "node" environment (no jsdom/happy-dom
 * installed). A minimal `window = {}` stand-in — not a real DOM — is enough
 * for that one property assignment to succeed. See renderers/detail.test.ts
 * for the same setup, used there for the same reason.
 */
(globalThis as any).window = (globalThis as any).window ?? {};

const { debounce, formatRelativeTime } = await import('./utils.js');

/* ============================================================
   debounce() — new reusable primitive backing the detail-panel
   autosave tick (js/renderers/detail.js). First unit tests in the repo
   for app logic (see the autosave plan's Verification section).
   ============================================================ */
describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call fn until the delay elapses', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('collapses rapid repeated calls into a single trailing invocation with the latest args', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced('a');
    vi.advanceTimersByTime(500);
    debounced('b');
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled(); // only 500ms since the last call
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('cancel() prevents a pending call from ever firing', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() runs a pending call immediately, with its latest args, and cancels the timer', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced('x');
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('x');
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1); // no second call from the (now-cancelled) timer
  });

  it('flush() is a no-op when nothing is pending', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('a call after the timer fires starts a fresh debounce window', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 1000);
    debounced('first');
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    debounced('second');
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });
});

/* ============================================================
   formatRelativeTime() — used by the Recent Changes (undo history) panel
   ============================================================ */
describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports "just now" for a timestamp a couple seconds ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T11:59:58.000Z').toISOString())).toBe('just now');
  });

  it('reports seconds ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T11:59:30.000Z').toISOString())).toBe('30s ago');
  });

  it('reports minutes ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T11:55:00.000Z').toISOString())).toBe('5m ago');
  });

  it('reports hours ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T09:00:00.000Z').toISOString())).toBe('3h ago');
  });

  it('reports days ago', () => {
    expect(formatRelativeTime(new Date('2025-12-30T12:00:00.000Z').toISOString())).toBe('2d ago');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});
