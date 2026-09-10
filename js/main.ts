/* ============================================================
   MODULE ENTRY POINT
   The single <script type="module"> Vite/the browser loads. Explicitly
   imports every app file for its side effects (top-level declarations),
   in the same order the old classic <script> tags used, then calls
   init() last — after every module in the graph has fully evaluated.

   init() deliberately isn't called from within init.js itself: several
   of these files import each other circularly (e.g. app.js <-> detail.js,
   app.js <-> operations.js), which ES modules handle safely as long as
   nothing at a module's own top level depends on another module's
   circular partner having already run its top-level code. Calling init()
   here, after the import graph settles, sidesteps that entirely rather
   than relying on the accident of which module happens to load first.
   ============================================================ */
import './db.js';
import './entity-config.js';
import './state.js';
import './utils.js';
import './renderers/tables.js';
import './renderers/form.js';
import './renderers/detail.js';
import './events.js';
import './operations.js';
import './parts-library.js';
import './app.js';
import './export.js';
import './import.js';
import './json-merge.js';
import { init } from './init.js';

init();
