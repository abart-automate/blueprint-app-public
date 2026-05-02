/* ============================================================
   ENTITY CONFIGURATION
   ============================================================ */

const ENTITY = {
  areas: {
    label: 'Area', plural: 'Areas', store: 'areas',
    color: '#7c3aed', bgColor: '#ede9fe', badgeClass: 'badge-area',
    noImages: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
    ],
    getSubtitle: () => '',
    getChildren: [
      { label: 'Panels',   store: 'panels',   field: 'areaId' },
      { label: 'Networks', store: 'networks', field: 'assignedToId', filter: i => i.assignedToType === 'Area' },
    ],
  },

  panels: {
    label: 'Panel', plural: 'Panels', store: 'panels',
    color: '#0891b2', bgColor: '#e0f2fe', badgeClass: 'badge-panel',
    requiredPhotoSlots: ['Nameplate', 'Front (Doors Closed)', 'Front (Doors Open)'],
    fields: [
      { key: 'name',        label: 'Name',             type: 'text',     required: true },
      { key: 'areaId',      label: 'Area',             type: 'ref',      refStore: 'areas',   required: true },
      { key: 'location',    label: 'Location',         type: 'text' },
      { key: 'manufacturer',label: 'Manufacturer',     type: 'text' },
      { key: 'description', label: 'Description',      type: 'textarea' },
      // Nameplate Data
      { key: 'npVoltage',        label: 'Voltage',          type: 'text',    section: 'Nameplate Data' },
      { key: 'npPhase',          label: 'Phase',            type: 'enum',    options: ['1','3'], section: 'Nameplate Data' },
      { key: 'npSccr',           label: 'SCCR',             type: 'text',    section: 'Nameplate Data' },
      { key: 'npFla',            label: 'FLA',              type: 'text',    section: 'Nameplate Data' },
      { key: 'npLargestMotorHp', label: 'Largest Motor HP', type: 'text', section: 'Nameplate Data' },
      { key: 'nemaRating', label: 'NEMA Rating', type: 'enum', section: 'Nameplate Data',
        options: ['NEMA 1','NEMA 2','NEMA 3','NEMA 3R','NEMA 3S','NEMA 3X','NEMA 3RX','NEMA 4','NEMA 4X','NEMA 5','NEMA 6','NEMA 6P','NEMA 7','NEMA 9','NEMA 12','NEMA 12K','NEMA 13'] },
      { key: 'npDrawingRef', label: 'Drawing Reference', type: 'text', section: 'Nameplate Data' },
      // Physical Sizing
      { key: 'physH', label: 'Height', type: 'text', section: 'Physical Sizing' },
      { key: 'physW', label: 'Width',  type: 'text', section: 'Physical Sizing' },
      { key: 'physD', label: 'Depth',  type: 'text', section: 'Physical Sizing' },
      // Backpanel Sizing
      { key: 'bpH', label: 'Height', type: 'text', section: 'Backpanel Sizing' },
      { key: 'bpW', label: 'Width',  type: 'text', section: 'Backpanel Sizing' },
      // Clearance
      { key: 'clrFront',  label: 'Front',  type: 'text', section: 'Clearance' },
      { key: 'clrBack',   label: 'Back',   type: 'text', section: 'Clearance' },
      { key: 'clrLeft',   label: 'Left',   type: 'text', section: 'Clearance' },
      { key: 'clrRight',  label: 'Right',  type: 'text', section: 'Clearance' },
      { key: 'clrTop',    label: 'Top',    type: 'text', section: 'Clearance' },
      { key: 'clrBottom', label: 'Bottom', type: 'text', section: 'Clearance' },
      // Notes at the bottom
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.areas?.[item.areaId]?.name || '—',
    getChildren: [
      { label: 'Power',           store: 'power',    field: 'panelId' },
      { label: 'Safety Circuits', store: 'safety',   field: 'panelId' },
      { label: 'Networks', store: 'networks', field: 'assignedToId', filter: i => i.assignedToType === 'Panel' },
      { label: 'Assets',   store: 'assets',   field: 'panelId' },
    ],
  },

  power: {
    label: 'Power', plural: 'Power', store: 'power',
    color: '#b45309', bgColor: '#fef3c7', badgeClass: 'badge-power',
    requiredPhotoSlots: ['Device', 'Part Number', 'Input Wiring', 'Output Wiring'],
    wiringTables: [
      { key: 'inputWiring',  label: 'Input Wiring'  },
      { key: 'outputWiring', label: 'Output Wiring' },
    ],
    fields: [
      { key: 'name',         label: 'Name',         type: 'text',     required: true },
      { key: 'panelId',      label: 'Panel',        type: 'ref',      refStore: 'panels', required: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'partNumber',   label: 'Part Number',  type: 'text' },
      { key: 'description',  label: 'Description',  type: 'textarea' },
      // Physical Sizing
      { key: 'physH', label: 'Height (in)', type: 'text', section: 'Physical Sizing' },
      { key: 'physW', label: 'Width (in)',  type: 'text', section: 'Physical Sizing' },
      { key: 'physD', label: 'Depth (in)', type: 'text', section: 'Physical Sizing' },
      // Clearance
      { key: 'clrTop',    label: 'Top (in)',    type: 'text', section: 'Clearance' },
      { key: 'clrBottom', label: 'Bottom (in)', type: 'text', section: 'Clearance' },
      { key: 'clrFront',  label: 'Front (in)',  type: 'text', section: 'Clearance' },
      { key: 'clrBack',   label: 'Back (in)',   type: 'text', section: 'Clearance' },
      { key: 'clrLeft',   label: 'Left (in)',   type: 'text', section: 'Clearance' },
      { key: 'clrRight',  label: 'Right (in)',  type: 'text', section: 'Clearance' },
      // Input Power
      { key: 'inVoltage',           label: 'Voltage',            type: 'text',                       section: 'Input Power' },
      { key: 'inAmperage',          label: 'Amperage',           type: 'text',                       section: 'Input Power' },
      { key: 'inPhase',             label: 'Phase',              type: 'enum', options: ['1', '3'],  section: 'Input Power' },
      { key: 'inCircuitProtection', label: 'Circuit Protection', type: 'text',                       section: 'Input Power' },
      // Output Power
      { key: 'outVoltage',  label: 'Voltage',  type: 'text',                      section: 'Output Power' },
      { key: 'outAmperage', label: 'Amperage', type: 'text',                      section: 'Output Power' },
      { key: 'outPhase',    label: 'Phase',    type: 'enum', options: ['1', '3'], section: 'Output Power' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.panels?.[item.panelId]?.name || '—',
    getChildren: [
      { label: 'Safety Circuits', store: 'safety', field: 'powerId' },
    ],
  },

  safety: {
    label: 'Safety Circuit', plural: 'Safety Circuits', store: 'safety',
    color: '#dc2626', bgColor: '#fee2e2', badgeClass: 'badge-safety',
    fields: [
      { key: 'name',           label: 'Name',             type: 'text',     required: true },
      { key: 'panelId',        label: 'Panel',            type: 'ref',      refStore: 'panels',  required: true },
      { key: 'powerId',        label: 'Power (optional)', type: 'ref',      refStore: 'power',   required: false },
      { key: 'circuitType',    label: 'Circuit Type',     type: 'enum',     options: ['E-Stop','Light Curtain','Safety Gate','Two-Hand Control','Safety Mat','Safety Scanner','Safety Relay','Safety PLC Input','Other'] },
      { key: 'safetyCategory', label: 'Safety Category',  type: 'enum',     options: ['CAT B','CAT 1','CAT 2','CAT 3','CAT 4','PLa','PLb','PLc','PLd','PLe','SIL 1','SIL 2','SIL 3'] },
      { key: 'device',         label: 'Safety Device',    type: 'text' },
      { key: 'description',    label: 'Description',      type: 'textarea' },
      { key: 'notes',          label: 'Notes',            type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.panels?.[item.panelId]?.name || '—',
    getChildren: [],
  },

  networks: {
    label: 'Network', plural: 'Networks', store: 'networks',
    color: '#16a34a', bgColor: '#dcfce7', badgeClass: 'badge-network',
    fields: [
      { key: 'name',           label: 'Name',              type: 'text',     required: true },
      { key: 'networkType',    label: 'Network Type',       type: 'enum',     options: ['Ethernet/IP','ControlNet','DeviceNet','Modbus TCP','Modbus RTU','Serial-RS232', 'Serial-RS485','Other'] },
      { key: 'ipRange',        label: 'IP Range / Subnet',  type: 'text' },
      { key: 'assignedToType', label: 'Assigned To',        type: 'assign-type', options: ['Plant','Area','Panel'] },
      { key: 'assignedToId',   label: 'Assigned Item',      type: 'assign-id' },
      { key: 'description',    label: 'Description',        type: 'textarea' },
      { key: 'notes',          label: 'Notes',              type: 'textarea' },
    ],
    getSubtitle: (item, refs) => {
      if (!item.assignedToType || item.assignedToType === 'Plant') return 'Plant-wide';
      const s = { Area: 'areas', Panel: 'panels' }[item.assignedToType];
      return refs?.[s]?.[item.assignedToId]?.name || item.assignedToType;
    },
    getChildren: [],
  },

  assets: {
    label: 'Asset', plural: 'Assets', store: 'assets',
    color: '#475569', bgColor: '#f1f5f9', badgeClass: 'badge-asset',
    fields: [
      { key: 'name',         label: 'Name',         type: 'text', required: true },
      { key: 'panelId',      label: 'Panel',        type: 'ref',  refStore: 'panels' },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'partNumber',   label: 'Part Number',  type: 'text' },
      { key: 'description',  label: 'Description',  type: 'textarea' },
      // Physical Sizing
      { key: 'physH', label: 'Height (in)', type: 'text', section: 'Physical Sizing' },
      { key: 'physW', label: 'Width (in)',  type: 'text', section: 'Physical Sizing' },
      { key: 'physD', label: 'Depth (in)', type: 'text', section: 'Physical Sizing' },
      // Clearance
      { key: 'clrTop',    label: 'Top (in)',    type: 'text', section: 'Clearance' },
      { key: 'clrBottom', label: 'Bottom (in)', type: 'text', section: 'Clearance' },
      { key: 'clrFront',  label: 'Front (in)',  type: 'text', section: 'Clearance' },
      { key: 'clrBack',   label: 'Back (in)',   type: 'text', section: 'Clearance' },
      { key: 'clrLeft',   label: 'Left (in)',   type: 'text', section: 'Clearance' },
      { key: 'clrRight',  label: 'Right (in)',  type: 'text', section: 'Clearance' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.panels?.[item.panelId]?.name || '',
    getChildren: [],
  },
};

const ASSIGN_STORE_MAP = { Plant: null, Area: 'areas', Panel: 'panels', Power: 'power', 'Safety Circuit': 'safety', Network: 'networks' };

/* ============================================================
   APPLICATION STATE
   ============================================================ */

const state = {
  page:       'home',
  detailType: null,
  detailId:   null,
  formType:   null,
  formId:     null,
  formPreset: null,   // { field, value } for pre-selecting a parent
  formImages: [],         // working image list during form editing
  formNamedPhotos: {},    // { slotName: base64 } for required photo slots
  formWiringTables: {},   // { [key]: [{terminal, label}] } for wiring table sections
  cache:      {},     // { storeName: [items] }
  refs:       {},     // { storeName: { id: item } } – flat lookup maps
};

/* ============================================================
   DOM REFERENCES
   ============================================================ */

const $ = id => document.getElementById(id);
const el = {
  header:    $('app-header'),
  main:      $('app-main'),
  backBtn:   $('back-btn'),
  addBtn:    $('add-btn'),
  pageTitle: $('page-title'),
  detail:    $('detail-panel'),
  backdrop:  $('sheet-backdrop'),
  sheet:     $('form-sheet'),
  formTitle: $('form-title'),
  formBody:  $('form-body'),
  formSave:  $('form-save'),
  formCancel:$('form-cancel'),
  confirmBD: $('confirm-backdrop'),
  confirmT:  $('confirm-title'),
  confirmM:  $('confirm-msg'),
  confirmNo: $('confirm-no'),
  confirmYes:$('confirm-yes'),
  toast:     $('toast'),
  nav:       $('bottom-nav'),
};

/* ============================================================
   TOAST
   ============================================================ */

let toastTimer = null;
function showToast(msg, type = '') {
  el.toast.textContent = msg;
  el.toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.className = 'toast'; }, 2800);
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */

function confirm(title, msg) {
  return new Promise(resolve => {
    el.confirmT.textContent = title;
    el.confirmM.textContent = msg;
    el.confirmBD.classList.add('open');
    const yes = () => { cleanup(); resolve(true); };
    const no  = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      el.confirmBD.classList.remove('open');
      el.confirmYes.removeEventListener('click', yes);
      el.confirmNo.removeEventListener('click', no);
    };
    el.confirmYes.addEventListener('click', yes);
    el.confirmNo.addEventListener('click', no);
  });
}

/* ============================================================
   CACHE & REFS
   ============================================================ */

async function loadCache(storeNames) {
  await Promise.all(storeNames.map(async name => {
    state.cache[name] = await getAll(name);
    state.refs[name]  = Object.fromEntries(state.cache[name].map(i => [i.id, i]));
  }));
}

async function refreshAll() {
  await loadCache(['areas','panels','power','safety','networks','assets']);
}

/* ============================================================
   IMAGE UTILITIES
   ============================================================ */

function resizeImage(file, maxPx = 1400) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   LIGHTBOX
   ============================================================ */

function openLightbox(src) {
  let lb = document.querySelector('.lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.className = 'lightbox open';
    lb.innerHTML = `<img src=""><button class="lightbox-close">✕</button>`;
    lb.querySelector('.lightbox-close').onclick = () => lb.remove();
    lb.onclick = e => { if (e.target === lb) lb.remove(); };
    document.querySelector('#app').appendChild(lb);
  }
  lb.querySelector('img').src = src;
  lb.classList.add('open');
}

/* ============================================================
   BACK BUTTON / DETAIL PANEL
   ============================================================ */

function openDetail(type, id) {
  state.detailType = type;
  state.detailId   = id;
  renderDetail();
  el.detail.classList.remove('animating');
  el.detail.style.display = 'block';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.detail.classList.add('open'));
  });
  el.backBtn.style.visibility = 'visible';
  el.addBtn.style.visibility  = 'hidden';
  el.pageTitle.textContent    = ENTITY[type].label;
}

function closeDetail() {
  el.detail.classList.remove('open');
  el.detail.classList.add('animating');
  setTimeout(() => {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'none';
    el.detail.innerHTML = '';
  }, 300);
  state.detailType = null;
  state.detailId   = null;
  setHeaderForPage(state.page);
}

/* ============================================================
   SHEET FORM
   ============================================================ */

function openSheet(type, id = null, preset = null) {
  state.formType   = type;
  state.formId     = id;
  state.formPreset = preset;
  const existing = id ? state.refs[type]?.[id] : null;
  state.formImages      = existing?.images      ? [...existing.images]      : [];
  state.formNamedPhotos = existing?.namedPhotos ? {...existing.namedPhotos} : {};
  state.formWiringTables = {};
  const cfg = ENTITY[type];
  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables)
      state.formWiringTables[t.key] = existing?.[t.key] ? existing[t.key].map(r => ({...r})) : [];
  }
  el.formTitle.textContent = (id ? 'Edit ' : 'Add ') + ENTITY[type].label;
  renderForm();
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.sheet.classList.add('open'));
  });
}

function closeSheet() {
  el.sheet.classList.remove('open');
  el.backdrop.classList.remove('open');
  setTimeout(() => { el.sheet.style.display = 'none'; el.formBody.innerHTML = ''; }, 300);
  state.formType         = null;
  state.formId           = null;
  state.formPreset       = null;
  state.formImages       = [];
  state.formNamedPhotos  = {};
  state.formWiringTables = {};
}

/* ============================================================
   ROUTER
   ============================================================ */

function navigate(page) {
  if (state.detailType) closeDetail();
  if (state.formType)   closeSheet();
  state.page = page;
  window.location.hash = page;
  setHeaderForPage(page);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  renderPage();
}

function setHeaderForPage(page) {
  if (page === 'home') {
    el.pageTitle.textContent   = 'Plant Asset Manager';
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'hidden';
  } else {
    el.pageTitle.textContent   = ENTITY[page].plural;
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'visible';
  }
}

/* ============================================================
   PAGE RENDERING
   ============================================================ */

async function renderPage() {
  el.main.innerHTML = '<div class="spinner"></div>';
  if (state.page === 'home')  { await renderHome(); return; }
  if (state.page === 'areas') { await renderAreasList(); return; }
  await renderList(state.page);
}

/* ---- HOME ---- */
async function renderHome() {
  await refreshAll();
  const plantName = (await getSetting('plantName')) || 'My Plant';
  const plantDesc = (await getSetting('plantDesc')) || 'Tap the edit button to set plant info';

  const counts = {};
  for (const key of Object.keys(ENTITY)) counts[key] = state.cache[key]?.length ?? 0;

  const icons = {
    areas:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    panels:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    power:    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    safety:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    networks: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="1" y="16" width="6" height="6" rx="1"/><rect x="17" y="16" width="6" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="4" y1="16" x2="12" y2="14"/><line x1="20" y1="16" x2="12" y2="14"/></svg>`,
    assets:   `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  };

  el.main.innerHTML = `
    <div class="home-hero">
      <div class="home-plant-name">${esc(plantName)}</div>
      <div class="home-plant-desc">${esc(plantDesc)}</div>
      <button class="home-edit-btn" id="home-edit-plant" aria-label="Edit plant info">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
    <div class="stats-grid">
      ${Object.entries(ENTITY).map(([key, cfg]) => `
        <div class="stat-card" data-nav="${key}">
          <div class="stat-icon" style="background:${cfg.bgColor};color:${cfg.color}">${icons[key]}</div>
          <div class="stat-info">
            <div class="stat-count">${counts[key]}</div>
            <div class="stat-label">${cfg.plural}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  el.main.querySelector('#home-edit-plant').addEventListener('click', () => openPlantForm());
  el.main.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
}

function openPlantForm() {
  el.formTitle.textContent = 'Plant Info';
  state.formType = '__plant__';
  state.formImages = [];
  el.formBody.innerHTML = `
    <div class="fg">
      <label class="fg-label">Plant Name <span class="req">*</span></label>
      <input id="pf-name" class="f-input" type="text" placeholder="Enter plant name">
    </div>
    <div class="fg">
      <label class="fg-label">Description</label>
      <textarea id="pf-desc" class="f-textarea" placeholder="Brief description of the plant"></textarea>
    </div>
  `;
  getSetting('plantName').then(n => { if (n) $('pf-name').value = n; });
  getSetting('plantDesc').then(d => { if (d) $('pf-desc').value = d; });
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

/* ---- AREAS LIST ---- */
async function renderAreasList() {
  await refreshAll();
  const areas = state.cache.areas || [];

  el.main.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="list-search" class="search-input" type="search" placeholder="Search areas…">
    </div>
    <div id="area-list" class="area-list"></div>
  `;

  const list = el.main.querySelector('#area-list');

  const render = () => {
    const q = el.main.querySelector('#list-search')?.value?.toLowerCase() || '';
    const shown = q ? areas.filter(a => a.name?.toLowerCase().includes(q)) : areas;

    if (!shown.length) {
      list.innerHTML = areas.length === 0
        ? `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>No Areas yet</h3><p>Tap <strong>+</strong> to add your first area.</p></div>`
        : `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No results</h3><p>Try a different search.</p></div>`;
      return;
    }

    list.innerHTML = shown.map(area => {
      const panelItems = (state.cache.panels  || []).filter(p => p.areaId === area.id);
      const panelIds   = new Set(panelItems.map(p => p.id));
      const counts = {
        panels:   panelItems.length,
        power:    (state.cache.power    || []).filter(p => panelIds.has(p.panelId)).length,
        safety:   (state.cache.safety   || []).filter(s => panelIds.has(s.panelId)).length,
        networks: (state.cache.networks || []).filter(n => n.assignedToType === 'Area' && n.assignedToId === area.id).length,
        assets:   (state.cache.assets   || []).filter(a => panelIds.has(a.panelId)).length,
      };
      return areaCardHTML(area, counts);
    }).join('');

    list.querySelectorAll('.area-card').forEach(card => {
      card.addEventListener('click', () => openDetail('areas', card.dataset.id));
    });
    list.querySelectorAll('.area-card-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem('areas', btn.dataset.id, btn.dataset.name);
      });
    });
  };

  el.main.querySelector('#list-search').addEventListener('input', render);
  render();
}

function areaCardHTML(area, counts) {
  const pct = calcAreaCompleteness(area);
  const barColor = pct >= 75 ? 'var(--success)' : 'var(--danger)';
  const countDefs = [
    { type: 'panels',   color: 'var(--c-panel)',   title: 'Panels',   n: counts.panels },
    { type: 'power',    color: 'var(--c-power)',   title: 'Power',    n: counts.power },
    { type: 'safety',   color: 'var(--c-safety)',  title: 'Safety',   n: counts.safety },
    { type: 'networks', color: 'var(--c-network)', title: 'Networks', n: counts.networks },
    { type: 'assets',   color: 'var(--c-asset)',   title: 'Assets',   n: counts.assets },
  ];
  return `
    <div class="area-card" data-id="${area.id}">
      <div class="area-card-header">
        <div class="area-card-name">${esc(area.name)}</div>
        <button class="area-card-delete" data-id="${area.id}" data-name="${esc(area.name)}" aria-label="Delete area">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      <div class="area-card-counts">
        ${countDefs.map(c => `
          <div class="area-count-item" style="color:${c.color}" title="${c.title}">
            ${entityIcon(c.type, 17)}
            <span>${c.n}</span>
          </div>
        `).join('')}
      </div>
      <div class="card-progress-wrap area-card-progress">
        <div class="card-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
    </div>
  `;
}

/* ---- LIST VIEW ---- */
async function renderList(type) {
  await loadCache([type, 'areas', 'panels', 'power', 'safety', 'networks']);
  const items = state.cache[type] || [];
  const cfg   = ENTITY[type];

  const parentFilter = buildParentFilterChips(type, items);

  el.main.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="list-search" class="search-input" type="search" placeholder="Search ${cfg.plural.toLowerCase()}…">
    </div>
    ${parentFilter.html}
    <div id="card-list" class="card-list"></div>
  `;

  parentFilter.bind(el.main);

  const list = el.main.querySelector('#card-list');
  let activeParent = 'all';

  const render = () => {
    const q     = el.main.querySelector('#list-search')?.value?.toLowerCase() || '';
    const shown = items.filter(item => {
      const matchQ = !q || item.name?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.tag?.toLowerCase().includes(q);
      const matchP = activeParent === 'all' || matchParentChip(type, item, activeParent);
      return matchQ && matchP;
    });

    if (!shown.length) {
      list.innerHTML = items.length === 0
        ? `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>No ${cfg.plural} yet</h3><p>Tap <strong>+</strong> to add your first ${cfg.label.toLowerCase()}.</p></div>`
        : `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No results</h3><p>Try a different search or filter.</p></div>`;
      return;
    }

    list.innerHTML = shown.map(item => cardHTML(type, item)).join('');
    list.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => openDetail(type, card.dataset.id));
    });
    list.querySelectorAll('.card-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(type, btn.dataset.id, btn.dataset.name);
      });
    });
  };

  el.main.querySelector('#list-search').addEventListener('input', render);
  el.main.addEventListener('chip-change', e => { activeParent = e.detail; render(); });
  render();
}

function cardHTML(type, item) {
  const cfg  = ENTITY[type];
  const sub  = cfg.getSubtitle(item, state.refs);
  const firstImg = item.images?.[0] || (item.namedPhotos && Object.values(item.namedPhotos)[0]) || null;
  const thumb = firstImg
    ? `<img class="card-thumb" src="${firstImg}" alt="">`
    : `<div class="card-thumb-ph" style="color:${cfg.color};background:${cfg.bgColor}">${entityIcon(type, 24)}</div>`;

  const counts = (cfg.getChildren || []).map(child => {
    const all = state.cache[child.store] || [];
    const n = child.filter
      ? all.filter(i => i[child.field] === item.id && child.filter(i)).length
      : all.filter(i => i[child.field] === item.id).length;
    return { store: child.store, label: child.label, n };
  });
  const countsHtml = counts.length ? `
    <div class="card-counts">
      ${counts.map(c => `
        <div class="card-count-item" style="color:${ENTITY[c.store].color}" title="${esc(c.label)}">
          ${entityIcon(c.store, 14)}<span>${c.n}</span>
        </div>`).join('')}
    </div>` : '';

  const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  const pct = calcCompleteness(type, item);
  const barColor = pct >= 75 ? 'var(--success)' : 'var(--danger)';

  let progressHtml;
  if (type === 'panels') {
    const devPct = calcPanelDevicesCompleteness(item.id);
    const devColor = devPct !== null ? (devPct >= 75 ? 'var(--success)' : 'var(--danger)') : 'var(--border)';
    progressHtml = `
      <div class="card-progress-multi">
        <div class="cpr-row">
          <span class="cpr-label">Panel</span>
          <div class="cpr-track"><div class="cpr-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <span class="cpr-pct" style="color:${barColor}">${pct}%</span>
        </div>
        <div class="cpr-row">
          <span class="cpr-label">Devices</span>
          <div class="cpr-track"><div class="cpr-fill" style="width:${devPct ?? 0}%;background:${devColor}"></div></div>
          <span class="cpr-pct" style="color:${devColor}">${devPct !== null ? devPct + '%' : '—'}</span>
        </div>
      </div>`;
  } else {
    progressHtml = `
      <div class="card-progress-wrap">
        <div class="card-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>`;
  }

  return `
    <div class="card" data-id="${item.id}">
      <div class="card-row">
        ${thumb}
        <div class="card-body">
          <div class="card-name-row">
            <div class="card-name">${esc(item.name)}</div>
            <button class="card-delete-btn" data-id="${item.id}" data-name="${esc(item.name)}" aria-label="Delete">${trashIcon}</button>
          </div>
          ${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}
          ${item.description ? `<div class="card-desc">${esc(item.description)}</div>` : ''}
          ${countsHtml}
        </div>
      </div>
      ${progressHtml}
    </div>
  `;
}

/* ---- PARENT FILTER CHIPS ---- */
function buildParentFilterChips(type, items) {
  const parentField = ENTITY[type]?.fields.find(f => f.type === 'ref' && f.required);
  if (!parentField) return { html: '', bind: () => {} };
  const refStore = parentField.refStore;
  const parentIds = [...new Set(items.map(i => i[parentField.key]).filter(Boolean))];
  if (!parentIds.length) return { html: '', bind: () => {} };
  const parents = parentIds.map(id => state.refs[refStore]?.[id]).filter(Boolean);
  if (!parents.length) return { html: '', bind: () => {} };
  const html = `
    <div class="chips" id="filter-chips">
      <button class="chip active" data-val="all">All</button>
      ${parents.map(p => `<button class="chip" data-val="${p.id}">${esc(p.name)}</button>`).join('')}
    </div>
  `;
  const bind = (container) => {
    const chips = container.querySelector('#filter-chips');
    if (!chips) return;
    chips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      container.dispatchEvent(new CustomEvent('chip-change', { detail: chip.dataset.val }));
    });
  };
  return { html, bind };
}

function matchParentChip(type, item, parentId) {
  const parentField = ENTITY[type]?.fields.find(f => f.type === 'ref' && f.required);
  if (!parentField) return true;
  return item[parentField.key] === parentId;
}

/* ============================================================
   DETAIL VIEW
   ============================================================ */

async function renderDetail() {
  const { detailType: type, detailId: id } = state;
  if (!type || !id) return;
  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) { closeDetail(); return; }
  await refreshAll();

  // Other photos gallery
  const images = item.images?.length
    ? `<div class="det-gallery">${item.images.map(src => `<img src="${src}" alt="" data-lightbox>`).join('')}</div>`
    : '';

  // Build field rows grouped by section
  const skipKeys = new Set(['id','createdAt','updatedAt','images','namedPhotos','assignedToType','assignedToId']);
  const sectionMap = new Map();
  for (const f of cfg.fields) {
    if (skipKeys.has(f.key) || f.type === 'assign-type' || f.type === 'assign-id') continue;
    let val = item[f.key];
    if (!val) continue;
    if (f.type === 'ref') {
      const refItem = state.refs[f.refStore]?.[val];
      val = refItem ? refItem.name : val;
    }
    const fieldHtml = `<div class="det-field"><div class="det-flabel">${esc(f.label)}</div><div class="det-fval">${esc(String(val))}</div></div>`;
    const sectionKey = f.section || null;
    if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
    sectionMap.get(sectionKey).push(fieldHtml);
  }

  const generalFields = (sectionMap.get(null) || []).join('');

  let sectionCards = '';
  for (const [section, rows] of sectionMap) {
    if (!section) continue;
    sectionCards += `
      <div class="det-card">
        <div class="section-label" style="margin:0 0 10px">${esc(section)}</div>
        ${rows.join('')}
      </div>
    `;
  }

  // Required photos card
  let requiredPhotosCard = '';
  if (cfg.requiredPhotoSlots) {
    const photoItems = cfg.requiredPhotoSlots.map(slot => {
      const src = item.namedPhotos?.[slot];
      return `
        <div class="named-photo-det-item">
          <div class="named-photo-det-label">${esc(slot)}</div>
          ${src
            ? `<img class="named-photo-det-img" src="${src}" alt="${esc(slot)}" data-lightbox>`
            : `<div class="named-photo-det-empty">Not captured</div>`
          }
        </div>
      `;
    }).join('');
    requiredPhotosCard = `
      <div class="det-card">
        <div class="section-label" style="margin:0 0 10px">Required Photos</div>
        ${photoItems}
      </div>
    `;
  }

  // Wiring table cards
  let wiringCards = '';
  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables) {
      const rows = item[t.key] || [];
      const rowsHtml = rows.length
        ? rows.map(r => `<tr><td class="wiring-det-terminal">${esc(r.terminal)}</td><td>${esc(r.label)}</td></tr>`).join('')
        : `<tr><td colspan="2" class="wiring-empty">No entries</td></tr>`;
      wiringCards += `
        <div class="det-card">
          <div class="section-label" style="margin:0 0 10px">${esc(t.label)}</div>
          <table class="wiring-det-table">
            <thead><tr><th>Terminal</th><th>Label</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }
  }

  // Assignment badge for networks/assets
  let assignBadge = '';
  if (item.assignedToType) {
    if (item.assignedToType === 'Plant') {
      assignBadge = `<span class="badge badge-plant">Plant-wide</span>`;
    } else {
      const s   = ASSIGN_STORE_MAP[item.assignedToType];
      const ref = s ? state.refs[s]?.[item.assignedToId] : null;
      const bc  = { Area:'badge-area', Panel:'badge-panel', Power:'badge-power', 'Safety Circuit':'badge-safety', Network:'badge-network' }[item.assignedToType] || 'badge-asset';
      assignBadge = `<span class="badge ${bc}">${esc(item.assignedToType)}: ${esc(ref?.name || '—')}</span>`;
    }
  }

  // Related children
  const childSections = await buildChildSections(type, id, item);

  el.detail.innerHTML = `
    <button class="det-back-btn" id="det-back" aria-label="Back">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    ${buildDetailCompletenessHtml(type, item)}
    ${images}
    <div class="det-card">
      ${type === 'areas'
        ? `<input class="det-name-input" id="det-name-input" type="text" value="${esc(item.name)}">`
        : `<div class="det-name">${esc(item.name)}</div>`
      }
      <div class="det-badges">
        <span class="badge ${cfg.badgeClass}">${esc(cfg.label)}</span>
        ${assignBadge}
      </div>
      ${generalFields || '<div class="det-field" style="color:var(--muted);font-size:14px">No additional details.</div>'}
      ${type !== 'areas' ? `
        <div class="det-actions" style="margin-top:14px">
          <button class="btn btn-outline btn-sm" id="det-edit">Edit</button>
        </div>` : ''}
    </div>
    ${sectionCards}
    ${requiredPhotosCard}
    ${wiringCards}
    ${childSections}
  `;

  el.detail.querySelectorAll('[data-lightbox]').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
  el.detail.querySelector('#det-back').addEventListener('click', closeDetail);
  if (type === 'areas') {
    const nameInput = el.detail.querySelector('#det-name-input');
    nameInput.addEventListener('blur', async () => {
      const newName = nameInput.value.trim();
      if (!newName || newName === item.name) return;
      await upsert('areas', { ...item, name: newName });
      await refreshAll();
      item.name = newName;
      const card = document.querySelector(`.area-card[data-id="${id}"]`);
      if (card) {
        card.querySelector('.area-card-name').textContent = newName;
        card.querySelector('.area-card-delete').dataset.name = newName;
      }
    });
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameInput.blur(); });
  } else {
    el.detail.querySelector('#det-edit').addEventListener('click', () => {
      closeDetail();
      openSheet(type, id);
    });
  }
  el.detail.querySelectorAll('.child-card-list').forEach(list => {
    const childStore = list.dataset.childStore;
    list.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => openDetail(childStore, card.dataset.id));
    });
    list.querySelectorAll('.card-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteItem(childStore, btn.dataset.id, btn.dataset.name);
      });
    });
  });
  el.detail.querySelectorAll('[data-add-child]').forEach(btn => {
    btn.addEventListener('click', () => {
      const childType   = btn.dataset.addChild;
      const presetField = btn.dataset.presetField;
      const presetVal   = btn.dataset.presetVal;
      openSheet(childType, null, { field: presetField, value: presetVal });
    });
  });
}

async function buildChildSections(type, id, item) {
  const cfg = ENTITY[type];
  if (!cfg.getChildren?.length) return '';

  let html = '';
  for (const child of cfg.getChildren) {
    const all      = state.cache[child.store] || [];
    const filtered = child.filter
      ? all.filter(i => i[child.field] === id && child.filter(i))
      : all.filter(i => i[child.field] === id);

    const rows = filtered.map(ci => cardHTML(child.store, ci)).join('');

    html += `
      <div class="det-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-label" style="margin:0">${esc(child.label)}</div>
          <button class="det-add-child-btn" data-add-child="${child.store}" data-preset-field="${child.field}" data-preset-val="${id}" aria-label="Add ${esc(child.label)}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        ${rows
          ? `<div class="card-list child-card-list" data-child-store="${child.store}">${rows}</div>`
          : `<div style="font-size:14px;color:var(--muted)">None added yet.</div>`
        }
      </div>
    `;
  }
  return html;
}

/* ============================================================
   FORM RENDERING
   ============================================================ */

async function renderForm() {
  const { formType: type, formId: id } = state;
  if (type === '__plant__') return; // already rendered
  const cfg      = ENTITY[type];
  const existing = id ? await getById(type, id) : null;
  await refreshAll();

  let html = '';
  let currentSection = undefined;
  for (const f of cfg.fields) {
    if (f.section !== currentSection) {
      currentSection = f.section;
      if (currentSection) html += `<div class="form-section-hdr">${esc(currentSection)}</div>`;
    }
    html += await buildFormField(f, existing, type);
  }

  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables) {
      html += `<div class="form-section-hdr">${esc(t.label)}</div><div id="wiring-table-${t.key}"></div>`;
    }
  }

  if (cfg.requiredPhotoSlots) {
    html += `<div class="form-section-hdr">Required Photos</div><div id="named-photo-slots">`;
    for (const slot of cfg.requiredPhotoSlots) {
      const slotId = `np-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
      html += `<div class="named-photo-slot"><div class="named-photo-slot-label">${esc(slot)}</div><div id="${slotId}" class="named-photo-area"></div></div>`;
    }
    html += `</div>`;
  }

  if (!cfg.noImages) {
    html += `
      <div class="form-section-hdr">Other Photos</div>
      <div class="fg">
        <label class="img-upload" id="img-upload-label">
          <input type="file" id="img-file-input" accept="image/*" multiple>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Tap to add images
        </label>
        <div id="img-preview-grid" class="img-grid"></div>
      </div>
    `;
  }

  el.formBody.innerHTML = html;

  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables) renderWiringTable(t.key, t.label);
  }

  if (cfg.requiredPhotoSlots) {
    renderNamedPhotoSlots(cfg.requiredPhotoSlots);
  }

  if (!cfg.noImages) {
    renderImagePreviews();
    const fileInput = $('img-file-input');
    fileInput.addEventListener('change', async () => {
      for (const file of Array.from(fileInput.files)) {
        const b64 = await resizeImage(file);
        state.formImages.push(b64);
      }
      fileInput.value = '';
      renderImagePreviews();
    });
  }

  // Wire up dynamic assignment dropdowns
  const assignTypeSelect = $('f-assign-type');
  if (assignTypeSelect) {
    assignTypeSelect.addEventListener('change', () => populateAssignId(type, assignTypeSelect.value, existing?.assignedToId));
    populateAssignId(type, assignTypeSelect.value, existing?.assignedToId);
  }

  // Wire up power filter when panel changes (for safety circuits)
  if (type === 'safety') {
    const panelSel = $('f-panelId');
    if (panelSel) {
      panelSel.addEventListener('change', () => filterPowerByPanel(panelSel.value, existing?.powerId));
      // filter immediately using current panel selection
      if (panelSel.value) filterPowerByPanel(panelSel.value, existing?.powerId);
    }
  }
}

async function buildFormField(f, existing, type) {
  // For new items, apply preset value if this field matches
  const presetVal = (!existing && state.formPreset?.field === f.key) ? state.formPreset.value : null;
  const val = existing?.[f.key] ?? presetVal ?? '';

  if (f.type === 'text') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <input id="f-${f.key}" class="f-input" type="text" value="${esc(val)}" placeholder="${esc(f.label)}">
    </div>`;
  }

  if (f.type === 'textarea') {
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <textarea id="f-${f.key}" class="f-textarea" placeholder="${esc(f.label)}">${esc(val)}</textarea>
    </div>`;
  }

  if (f.type === 'enum') {
    const opts = f.options.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-${f.key}" class="f-select">
        <option value="">— Select —</option>
        ${opts}
      </select>
    </div>`;
  }

  if (f.type === 'ref') {
    const items = state.cache[f.refStore] || [];
    const opts  = items.map(i => `<option value="${i.id}" ${i.id === val ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
    // For safety's powerId — will be filtered after panel selected
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <select id="f-${f.key}" class="f-select">
        ${f.required ? '' : '<option value="">— None —</option>'}
        ${opts}
      </select>
    </div>`;
  }

  if (f.type === 'assign-type') {
    const preset = state.formPreset?.field === 'assignedToType' ? state.formPreset.value : null;
    const current = existing?.assignedToType || preset || '';
    const opts = f.options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${esc(o)}</option>`).join('');
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}</label>
      <select id="f-assign-type" class="f-select">
        <option value="">— Select type —</option>
        ${opts}
      </select>
    </div>`;
  }

  if (f.type === 'assign-id') {
    return `<div class="fg" id="fg-assign-id" style="display:none">
      <label class="fg-label" id="label-assign-id">Assigned Item</label>
      <select id="f-assign-id" class="f-select">
        <option value="">— Select —</option>
      </select>
    </div>`;
  }

  return '';
}

async function populateAssignId(type, assignType, currentId) {
  const fg  = $('fg-assign-id');
  const sel = $('f-assign-id');
  const lbl = $('label-assign-id');
  if (!fg || !sel) return;

  if (!assignType || assignType === 'Plant') {
    fg.style.display = 'none';
    return;
  }

  fg.style.display = 'block';
  if (lbl) lbl.textContent = assignType;

  const storeName = ASSIGN_STORE_MAP[assignType];
  if (!storeName) { fg.style.display = 'none'; return; }

  const items = state.cache[storeName] || [];
  sel.innerHTML = `<option value="">— Select —</option>` + items.map(i => {
    const sub = ENTITY[storeName]?.getSubtitle(i, state.refs);
    const label = sub ? `${i.name} (${sub})` : i.name;
    return `<option value="${i.id}" ${i.id === currentId ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

async function filterPowerByPanel(panelId, currentPowerId) {
  const sel = $('f-powerId');
  if (!sel) return;
  const all = state.cache['power'] || [];
  const filtered = panelId ? all.filter(p => p.panelId === panelId) : all;
  sel.innerHTML = `<option value="">— None —</option>` + filtered.map(p =>
    `<option value="${p.id}" ${p.id === currentPowerId ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
}

function renderImagePreviews() {
  const grid = $('img-preview-grid');
  if (!grid) return;
  grid.innerHTML = state.formImages.map((src, i) => `
    <div class="img-thumb">
      <img src="${src}" alt="">
      <button class="img-rm" data-idx="${i}">✕</button>
    </div>
  `).join('');
  grid.querySelectorAll('.img-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formImages.splice(Number(btn.dataset.idx), 1);
      renderImagePreviews();
    });
  });
}

function renderNamedPhotoSlots(slots) {
  const cameraIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  for (const slot of slots) {
    const slotId = `np-slot-${slot.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
    const area = $(slotId);
    if (!area) continue;
    const src = state.formNamedPhotos[slot];
    if (src) {
      area.innerHTML = `
        <div class="img-thumb named-img-thumb">
          <img src="${src}" alt="${esc(slot)}">
          <button class="img-rm" type="button">✕</button>
        </div>
      `;
      area.querySelector('.img-rm').addEventListener('click', e => {
        e.stopPropagation();
        delete state.formNamedPhotos[slot];
        renderNamedPhotoSlots(slots);
      });
    } else {
      area.innerHTML = `
        <label class="named-photo-upload">
          <input type="file" accept="image/*">
          ${cameraIcon}
          <span>Tap to capture</span>
        </label>
      `;
      area.querySelector('input[type="file"]').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const b64 = await resizeImage(file);
        state.formNamedPhotos[slot] = b64;
        renderNamedPhotoSlots(slots);
      });
    }
  }
}

function renderWiringTable(key, label) {
  const container = $(`wiring-table-${key}`);
  if (!container) return;
  const rows = state.formWiringTables[key] || [];
  const rmIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const rowsHtml = rows.map((r, i) => `
    <div class="wiring-form-row">
      <input class="f-input wiring-terminal" type="text" placeholder="Terminal" value="${esc(r.terminal || '')}" data-wkey="${key}" data-idx="${i}" data-field="terminal">
      <input class="f-input wiring-label"    type="text" placeholder="Label"    value="${esc(r.label    || '')}" data-wkey="${key}" data-idx="${i}" data-field="label">
      <button class="wiring-rm-btn" data-wkey="${key}" data-idx="${i}" type="button" aria-label="Remove row">${rmIcon}</button>
    </div>
  `).join('');
  container.innerHTML = `
    ${rowsHtml}
    <button class="wiring-add-btn" data-wkey="${key}" type="button">+ Add Row</button>
  `;
  container.querySelectorAll('.wiring-form-row input').forEach(input => {
    input.addEventListener('change', () => {
      const { wkey, idx, field } = input.dataset;
      state.formWiringTables[wkey][Number(idx)][field] = input.value;
    });
  });
  container.querySelectorAll('.wiring-rm-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formWiringTables[btn.dataset.wkey].splice(Number(btn.dataset.idx), 1);
      renderWiringTable(btn.dataset.wkey, label);
    });
  });
  container.querySelector('.wiring-add-btn').addEventListener('click', () => {
    state.formWiringTables[key].push({ terminal: '', label: '' });
    renderWiringTable(key, label);
    const inputs = container.querySelectorAll('.wiring-terminal');
    inputs[inputs.length - 1]?.focus();
  });
}

/* ============================================================
   FORM SAVE
   ============================================================ */

async function saveForm() {
  const type = state.formType;

  // Special case: plant info
  if (type === '__plant__') {
    const name = $('pf-name')?.value.trim();
    if (!name) { showToast('Plant name is required', 'error'); return; }
    await setSetting('plantName', name);
    await setSetting('plantDesc', $('pf-desc')?.value.trim() || '');
    closeSheet();
    showToast('Plant info saved', 'success');
    renderPage();
    return;
  }

  const cfg = ENTITY[type];
  const item = state.formId ? (await getById(type, state.formId)) || {} : {};

  for (const f of cfg.fields) {
    if (f.type === 'assign-type') {
      item.assignedToType = $('f-assign-type')?.value || '';
    } else if (f.type === 'assign-id') {
      item.assignedToId = $('f-assign-id')?.value || '';
    } else {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = el2.value.trim();
    }
  }

  // Validate required fields
  for (const f of cfg.fields) {
    if (f.required && !item[f.key]) {
      showToast(`${f.label} is required`, 'error');
      $(`f-${f.key}`)?.focus();
      return;
    }
  }

  item.images = [...state.formImages];
  if (cfg.requiredPhotoSlots) item.namedPhotos = {...state.formNamedPhotos};
  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables)
      item[t.key] = (state.formWiringTables[t.key] || []).filter(r => r.terminal || r.label);
  }

  // Ensure preset parent is set if the field wasn't rendered as a form field (e.g. assignedToId when type is Plant)
  if (state.formPreset && !state.formId && !item[state.formPreset.field]) {
    item[state.formPreset.field] = state.formPreset.value;
  }

  await upsert(type, item);
  await refreshAll();
  closeSheet();
  showToast(`${cfg.label} saved`, 'success');

  if (state.detailType) {
    renderDetail();
  } else {
    renderPage();
  }
}

/* ============================================================
   DELETE
   ============================================================ */

async function deleteItem(type, id, name) {
  const ok = await confirm('Delete ' + ENTITY[type].label, `Delete "${name}"? This cannot be undone.`);
  if (!ok) return;
  await remove(type, id);
  await refreshAll();
  closeDetail();
  showToast(`${ENTITY[type].label} deleted`);
  renderPage();
}

/* ============================================================
   UTILITY
   ============================================================ */

function calcCompleteness(type, item) {
  const cfg = ENTITY[type];
  let total = 0, filled = 0;
  for (const f of cfg.fields) {
    if (f.type === 'assign-type' || f.type === 'assign-id') continue;
    total++;
    const val = item[f.key];
    if (val !== undefined && val !== null && String(val).trim() !== '') filled++;
  }
  if (cfg.requiredPhotoSlots) {
    for (const slot of cfg.requiredPhotoSlots) {
      total++;
      if (item.namedPhotos?.[slot]) filled++;
    }
  }
  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables) {
      total++;
      if ((item[t.key] || []).some(r => r.terminal || r.label)) filled++;
    }
  }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

function calcAreaCompleteness(area) {
  const panelItems = (state.cache.panels || []).filter(p => p.areaId === area.id);
  const panelIds = new Set(panelItems.map(p => p.id));
  const allItems = [
    ...panelItems.map(p => ({ type: 'panels', item: p })),
    ...(state.cache.power    || []).filter(p => panelIds.has(p.panelId)).map(p => ({ type: 'power',    item: p })),
    ...(state.cache.safety   || []).filter(s => panelIds.has(s.panelId)).map(s => ({ type: 'safety',   item: s })),
    ...(state.cache.networks || []).filter(n => n.assignedToType === 'Area' && n.assignedToId === area.id).map(n => ({ type: 'networks', item: n })),
    ...(state.cache.assets   || []).filter(a => panelIds.has(a.panelId)).map(a => ({ type: 'assets',   item: a })),
  ];
  if (!allItems.length) return 0;
  return Math.round(allItems.reduce((sum, { type, item }) => sum + calcCompleteness(type, item), 0) / allItems.length);
}

function calcPanelDevicesCompleteness(panelId) {
  const allItems = [
    ...(state.cache.power    || []).filter(p => p.panelId === panelId).map(p => ({ type: 'power',    item: p })),
    ...(state.cache.safety   || []).filter(s => s.panelId === panelId).map(s => ({ type: 'safety',   item: s })),
    ...(state.cache.networks || []).filter(n => n.assignedToType === 'Panel' && n.assignedToId === panelId).map(n => ({ type: 'networks', item: n })),
    ...(state.cache.assets   || []).filter(a => a.panelId === panelId).map(a => ({ type: 'assets',   item: a })),
  ];
  if (!allItems.length) return null;
  return Math.round(allItems.reduce((sum, { type, item }) => sum + calcCompleteness(type, item), 0) / allItems.length);
}

function buildDetailCompletenessHtml(type, item) {
  if (type === 'areas') {
    const pct = calcAreaCompleteness(item);
    const color = pct >= 75 ? 'var(--success)' : 'var(--danger)';
    return `
      <div class="det-card det-completeness-card">
        <div class="det-completeness-row">
          <span class="det-completeness-label">Area Completeness</span>
          <span class="det-completeness-pct" style="color:${color}">${pct}%</span>
        </div>
        <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
  }
  if (type === 'panels') {
    const panelPct = calcCompleteness('panels', item);
    const panelColor = panelPct >= 75 ? 'var(--success)' : 'var(--danger)';
    const devPct = calcPanelDevicesCompleteness(item.id);
    const devColor = devPct !== null ? (devPct >= 75 ? 'var(--success)' : 'var(--danger)') : 'var(--muted)';
    const devRow = devPct !== null
      ? `<div class="det-completeness-row" style="margin-top:12px">
           <span class="det-completeness-label">Devices</span>
           <span class="det-completeness-pct" style="color:${devColor}">${devPct}%</span>
         </div>
         <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${devPct}%;background:${devColor}"></div></div>`
      : `<div class="det-completeness-row" style="margin-top:12px">
           <span class="det-completeness-label">Devices</span>
           <span style="font-size:13px;color:var(--muted)">None assigned</span>
         </div>`;
    return `
      <div class="det-card det-completeness-card">
        <div class="det-completeness-row">
          <span class="det-completeness-label">Panel</span>
          <span class="det-completeness-pct" style="color:${panelColor}">${panelPct}%</span>
        </div>
        <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${panelPct}%;background:${panelColor}"></div></div>
        ${devRow}
      </div>`;
  }
  const pct = calcCompleteness(type, item);
  const color = pct >= 75 ? 'var(--success)' : 'var(--danger)';
  return `
    <div class="det-card det-completeness-card">
      <div class="det-completeness-row">
        <span class="det-completeness-label">Completeness</span>
        <span class="det-completeness-pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="det-progress-wrap"><div class="det-progress-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function entityIcon(type, size = 22) {
  const icons = {
    areas:    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    panels:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    power:    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    safety:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    networks: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="1" y="16" width="6" height="6" rx="1"/><rect x="17" y="16" width="6" height="6" rx="1"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="4" y1="16" x2="12" y2="14"/><line x1="20" y1="16" x2="12" y2="14"/></svg>`,
    assets:   `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
  };
  return icons[type] || '';
}

/* ============================================================
   WIRE UP GLOBAL EVENTS
   ============================================================ */

function wireEvents() {
  // Bottom nav
  el.nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn) navigate(btn.dataset.page);
  });

  // Back button
  el.backBtn.addEventListener('click', () => {
    if (state.detailType) {
      closeDetail();
    }
  });

  // Add button
  el.addBtn.addEventListener('click', () => {
    if (state.page !== 'home') openSheet(state.page);
  });

  // Form save / cancel
  el.formSave.addEventListener('click', saveForm);
  el.formCancel.addEventListener('click', closeSheet);

  // Backdrop tap closes sheet
  el.backdrop.addEventListener('click', closeSheet);

  // Hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    if (ENTITY[hash] || hash === 'home') {
      if (hash !== state.page) navigate(hash);
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */

async function init() {
  try {
    await initDB();
    wireEvents();
    const hash = window.location.hash.replace('#', '') || 'home';
    const startPage = (ENTITY[hash] || hash === 'home') ? hash : 'home';
    navigate(startPage);
    initInstallPrompt();
  } catch (err) {
    console.error('Init failed:', err);
    document.querySelector('#app-main').innerHTML = `
      <div class="empty">
        <h3>Storage Error</h3>
        <p>Could not open IndexedDB. Please ensure you're using a modern browser and not in private/incognito mode.</p>
        <p style="margin-top:8px;font-family:monospace;font-size:12px">${esc(String(err))}</p>
      </div>
    `;
  }
}

/* ============================================================
   PWA INSTALL PROMPT (Android / Chrome only)
   ============================================================ */

function initInstallPrompt() {
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
  });

  function showInstallBanner() {
    if (document.getElementById('install-banner')) return;
    const el = document.createElement('div');
    el.id = 'install-banner';
    el.className = 'install-banner';
    el.innerHTML = `<span>Install Plant Asset Manager</span>
      <div class="install-banner-btns">
        <button id="install-now-btn">Install</button>
        <button id="install-skip-btn">Not now</button>
      </div>`;
    document.getElementById('bottom-nav').before(el);
    document.getElementById('install-now-btn').onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') hideInstallBanner();
    };
    document.getElementById('install-skip-btn').onclick = hideInstallBanner;
  }

  function hideInstallBanner() {
    document.getElementById('install-banner')?.remove();
  }
}

/* ============================================================
   PWA UPDATE BANNER
   ============================================================ */

function initUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML =
    '<span>A new version is available.</span>' +
    '<div class="update-banner-btns">' +
    '<button id="update-later-btn">Later</button>' +
    '<button id="update-now-btn">Update Now</button>' +
    '</div>';
  document.getElementById('app-header').before(banner);
  document.getElementById('update-now-btn').onclick = function () {
    window.location.reload();
  };
  document.getElementById('update-later-btn').onclick = function () {
    banner.remove();
  };
}

window.addEventListener('pwa-updated', initUpdateBanner);

init();
