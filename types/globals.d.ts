// Ambient declarations for globals loaded via classic <script> tags (not npm
// packages), so files under js/ that reference them can be @ts-check'd.

// Minimal placeholder for the vendored js/vendor/xlsx.full.min.js (SheetJS).
// The TS migration plan calls for a properly typed ambient d.ts here once
// export.js/import.js are converted, after confirming feature parity with
// @types/xlsx against the vendored "full" build (see the migration plan's
// Revision 4) — until then this just unblocks @ts-check on files that touch
// the global (parts-library.js today).
declare var XLSX: any;
