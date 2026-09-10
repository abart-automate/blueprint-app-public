// Ambient declarations for globals loaded via classic <script> tags (not npm
// packages), so files under js/ that reference them can be @ts-check'd.

// Minimal placeholder for the vendored js/vendor/xlsx.full.min.js (SheetJS)
// and js/vendor/jszip.min.js. The TS migration plan calls for properly typed
// ambient d.ts's here once export.js/import.js are converted, after
// confirming feature parity with @types/xlsx and @types/jszip against the
// vendored builds (see the migration plan's Revision 4) — until then this
// just unblocks @ts-check on files that touch these globals.
declare var XLSX: any;
declare var JSZip: any;
