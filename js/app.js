/* ============================================================
   ENTITY CONFIGURATION
   ============================================================ */

const PLC_CARD_TYPE_FIELDS = {
  Controller:    [{ key: 'networkId', label: 'Network', type: 'ref', refStore: 'networks' }],
  Analog:        [{ key: 'ioPointCount', label: 'IO Point Count', type: 'text' },
                  { key: 'signalType',   label: 'Signal Type',    type: 'enum',
                    options: ['4-20mA','0-10V','Thermocouple','RTD'] }],
  Digital:       [{ key: 'ioPointCount', label: 'IO Point Count', type: 'text' },
                  { key: 'voltageLevel', label: 'Voltage Level',  type: 'enum',
                    options: ['24VDC','120VAC','240VAC'] }],
  Communication: [{ key: 'networkId', label: 'Network',  type: 'ref', refStore: 'networks' },
                  { key: 'protocol',  label: 'Protocol', type: 'text' }],
  Specialty:     [],
};

const SERIAL_FIELDS = [
  { key: 'protocol', label: 'Protocol',   type: 'enum', options: ['RS232','RS422','RS485','Modbus RTU','Other'], required: true },
  { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Serial Configuration',
    options: ['1200','2400','4800','9600','19200','38400','57600','115200'] },
  { key: 'dataBits', label: 'Data Bits', type: 'enum', section: 'Serial Configuration', options: ['7','8'] },
  { key: 'parity',   label: 'Parity',    type: 'enum', section: 'Serial Configuration', options: ['None','Even','Odd'] },
  { key: 'stopBits', label: 'Stop Bits', type: 'enum', section: 'Serial Configuration', options: ['1','2'] },
];

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
      { label: 'Panels', store: 'panels', field: 'areaId' },
    ],
  },

  panels: {
    label: 'Panel', plural: 'Panels', store: 'panels',
    color: '#0891b2', bgColor: '#e0f2fe', badgeClass: 'badge-panel',
    requiredPhotoSlots: ['Nameplate', 'Front (Doors Closed)', 'Front (Doors Open)'],
    fields: [
      { key: 'name',        label: 'Name',             type: 'text',     required: true },
      { key: 'areaId',      label: 'Area',             type: 'ref',      refStore: 'areas' },
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
      { key: 'panelId',      label: 'Panel',        type: 'ref',      refStore: 'panels' },
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
      { label: 'Assets',   store: 'assets',   field: 'powerId'},
    ],
  },

  safety: {
    label: 'Safety Circuit', plural: 'Safety Circuits', store: 'safety',
    color: '#dc2626', bgColor: '#fee2e2', badgeClass: 'badge-safety',
    fields: [
      { key: 'name',           label: 'Name',             type: 'text',     required: true },
      { key: 'panelId',        label: 'Panel',            type: 'ref',      refStore: 'panels' },
      { key: 'powerId',        label: 'Power (optional)', type: 'ref',      refStore: 'power',   required: false },
      { key: 'safetyCategory', label: 'Safety Category',  type: 'enum',     options: ['CAT B','CAT 1','CAT 2','CAT 3','CAT 4','PLa','PLb','PLc','PLd','PLe','SIL 1','SIL 2','SIL 3'] },
      { key: 'description',    label: 'Description',      type: 'textarea' },
      { key: 'notes',          label: 'Notes',            type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.panels?.[item.panelId]?.name || '—',
    getChildren: [
      { label: 'Assets',   store: 'assets',   field: 'safetyId' },
    ],
  },

  networks: {
    label: 'Network', plural: 'Networks', store: 'networks',
    color: '#16a34a', bgColor: '#dcfce7', badgeClass: 'badge-network',
    fields: [
      { key: 'name',        label: 'Name',          type: 'text',  required: true },
      { key: 'networkType', label: 'Network Type',  type: 'enum',  required: true,
        options: ['Ethernet','ControlNet','DeviceNet','DH+','Remote-IO','Serial','Other'] },
      { key: 'description', label: 'Description',    type: 'textarea' },
      { key: 'notes',       label: 'Notes',          type: 'textarea' },
    ],
    protocolFields: {
      'Ethernet': [
        { key: 'ipRange',  label: 'IP Range / Subnet', type: 'text', section: 'Network Configuration' },
        { key: 'gateway',  label: 'Gateway',            type: 'text', section: 'Network Configuration' },
        { key: 'vlanId',   label: 'VLAN ID',            type: 'text', section: 'Network Configuration' },
      ],
      'ControlNet': [
        ],
      'DeviceNet': [
        { key: 'powerId', label: 'Power Supply', type: 'ref', refStore: 'power', section: 'Network Configuration' },
        { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Network Configuration',
    options: ['125K','250K','500K'] },
       ],
      'DH+':   [
        { key: 'dhChannel', label: 'Channel', type: 'enum', section: 'Network Configuration',
    options: ['A','B'] },
        { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Network Configuration',
    options: ['57.6K','115.2K','230.4K'] },
      ],
      'Remote-IO':   [
        { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Network Configuration',
    options: ['57.6K','115.2K','230.4K'] },
      ],
      'Serial':   SERIAL_FIELDS,
    },
    getSubtitle: (item, refs) => {
      const panel = item.panelId ? refs?.panels?.[item.panelId]?.name : null;
      const area  = item.areaId  ? refs?.areas?.[item.areaId]?.name  : null;
      if (panel && area) return `${area} / ${panel}`;
      return panel || area || 'Plant-wide';
    },
    getChildren: [
      { label: 'Assets', store: 'assets', field: 'networkId',
        countFn: (all, id) => all.filter(a => a.networkId === id || a.switchNetworks?.some(sn => sn.networkId === id)).length },
    ],
  },

  assets: {
    label: 'Asset', plural: 'Assets', store: 'assets',
    color: '#475569', bgColor: '#f1f5f9', badgeClass: 'badge-asset',
    requiredPhotoSlots: ['Device Front', 'Part Number'],
    fields: [
      { key: 'name',          label: 'Name',          type: 'text', required: true },
      { key: 'assetClass',    label: 'Device Class',  type: 'enum', options: ['Network Switch','PLC','HMI','VFD','Network Device','Hardwired Device'], required: true },
      { key: 'assetSubclass', label: 'Subtype',       type: 'enum', options: [] },
      { key: 'panelId',       label: 'Panel',         type: 'ref',  refStore: 'panels' },
      { key: 'manufacturer',  label: 'Manufacturer',  type: 'text' },
      { key: 'partNumber',    label: 'Part Number',   type: 'text' },
      { key: 'description',   label: 'Description',   type: 'textarea' },
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
    // Fields shown based on the linked network's protocol type
    networkTypeFields: {
      'Ethernet': [
        { key: 'protocol', label: 'Protocol',   type: 'enum', options: ['Ethernet','Modbus TCP','Other'], required: true },
        { key: 'ipAddress',  label: 'IP Address',   type: 'text', section: 'Network Address' },
        { key: 'subnetMask', label: 'Subnet Mask',  type: 'text', section: 'Network Address' },
        { key: 'gateway',    label: 'Gateway',      type: 'text', section: 'Network Address' },
      ],
      'ControlNet': [
        { key: 'nodeAddress', label: 'Node Address', type: 'text', section: 'Network Address' },
      ],
      'DeviceNet': [
        { key: 'nodeAddress', label: 'Node Address', type: 'text', section: 'Network Address' },
      ],
      'Serial': [
        { key: 'nodeAddress', label: 'Node Address', type: 'text', section: 'Network Address' }
      ],
    },
    cardTypeFields: PLC_CARD_TYPE_FIELDS,
    // Class-level fields shown per device class
    classFields: {
      'PLC': [
        { key: 'slotCount', label: 'Slot Count', type: 'text' },
      ],
      'HMI':            [
        { key: 'networkId',    label: 'Network',         type: 'ref', refStore: 'networks' },
        { key: 'controllerId', label: 'PLC Controller',  type: 'ref', refStore: 'assets',
          refFilter: a => a.assetClass === 'PLC' },
      ],
      'VFD':            [
        { key: 'networkId',    label: 'Network',         type: 'ref', refStore: 'networks' },
        { key: 'controllerId', label: 'PLC Controller',  type: 'ref', refStore: 'assets',
          refFilter: a => a.assetClass === 'PLC' },
      ],
      'Network Device': [
        { key: 'networkId',    label: 'Network',         type: 'ref', refStore: 'networks' },
        { key: 'controllerId', label: 'PLC Controller',  type: 'ref', refStore: 'assets',
          refFilter: a => a.assetClass === 'PLC' },
      ],
    },
    // Children shown on drill-in per subclass (extends getChildren)
    subclassChildren: {},
    // Subclass options per device class
    classSubclasses: {
      'Network Switch': ['Managed', 'Unmanaged', 'Router'],
      'PLC':            [],
      'HMI':            [],
      'VFD':            [],
      'Network Device': [],
      'Hardwired Device': [],
    },
    // Extra fields per device subtype
    subclassFields: {
      Managed: [
        { key: 'portCount',       label: 'Port Count',       type: 'text', section: 'Switch Details' },
        { key: 'macAddress',      label: 'MAC Address',      type: 'text', section: 'Switch Details' },
        { key: 'firmwareVersion', label: 'Firmware Version', type: 'text', section: 'Switch Details' },
      ],
      Unmanaged: [
        { key: 'portCount',       label: 'Port Count',       type: 'text', section: 'Switch Details' },
        { key: 'macAddress',      label: 'MAC Address',      type: 'text', section: 'Switch Details' },
        { key: 'firmwareVersion', label: 'Firmware Version', type: 'text', section: 'Switch Details' },
      ],
      Router: [
        { key: 'portCount',       label: 'Port Count',       type: 'text', section: 'Switch Details' },
        { key: 'macAddress',      label: 'MAC Address',      type: 'text', section: 'Router Details' },
        { key: 'firmwareVersion', label: 'Firmware Version', type: 'text', section: 'Router Details' },
      ],
    },
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
  formSwitchNetworks: [], // [{networkId}] for managed switch/router network connections
  formSwitchPorts: [],    // [{portName, networkId, assetId}] for managed switch/router ports
  formIoPoints: [],       // [{label, terminal, description}] for PLC slot IO points
  detailStack:      [],   // [{type, id, slotNumber?}] – navigation history within detail panel
  detailSlotNumber: null, // slot index when viewing a PLC slot detail
  detailChanges:    {},   // { key: newValue } for inline edits in the detail view
  pickerMeta:    null, // { childType, parentField, parentId, selected: Set } for assign picker
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
  const wasOpen = !!(state.detailType && state.detailId);
  if (wasOpen) {
    state.detailStack.push({ type: state.detailType, id: state.detailId });
    state.detailChanges = {};
  }
  state.detailType = type;
  state.detailId   = id;
  renderDetail();
  if (!wasOpen) {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.detail.classList.add('open'));
    });
  }
  el.backBtn.style.visibility = 'visible';
  el.addBtn.style.visibility  = 'hidden';
  el.pageTitle.textContent    = ENTITY[type].label;
}

function closeDetail() {
  if (state.detailStack.length > 0) {
    const prev = state.detailStack.pop();
    state.detailType       = prev.type;
    state.detailId         = prev.id;
    state.detailSlotNumber = prev.slotNumber ?? null;
    state.detailChanges    = {};
    renderDetail();
    el.pageTitle.textContent = prev.type === '__plc_slot__'
      ? `Slot ${prev.slotNumber}`
      : ENTITY[prev.type].label;
    return;
  }
  el.detail.classList.remove('open');
  el.detail.classList.add('animating');
  setTimeout(() => {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'none';
    el.detail.innerHTML = '';
  }, 300);
  state.detailType       = null;
  state.detailId         = null;
  state.detailSlotNumber = null;
  state.detailChanges    = {};
  state.detailStack      = [];
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
  state.formSwitchNetworks = existing?.switchNetworks ? existing.switchNetworks.map(r => ({...r})) : [];
  state.formSwitchPorts    = existing?.switchPorts    ? existing.switchPorts.map(r => ({...r}))    : [];
  state.formIoPoints       = existing?.ioPoints       ? existing.ioPoints.map(r => ({...r}))       : [];
  const subLabel = !id ? (preset?.extra?.assetSubclass || existing?.assetSubclass) : existing?.assetSubclass;
  el.formTitle.textContent = (id ? 'Edit ' : 'Add ') + (subLabel || ENTITY[type].label);
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
  el.formSave.textContent = 'Save';
  el.formSave.disabled    = false;
  setTimeout(() => { el.sheet.style.display = 'none'; el.formBody.innerHTML = ''; }, 300);
  state.formType         = null;
  state.formId           = null;
  state.formPreset       = null;
  state.formImages       = [];
  state.formNamedPhotos  = {};
  state.formWiringTables  = {};
  state.formSwitchNetworks = [];
  state.formSwitchPorts    = [];
  state.formIoPoints       = [];
  state.pickerMeta        = null;
}

function openSlotForm(rackId, slotNumber) {
  const rack     = state.refs.assets?.[rackId];
  const existing = rack?.slots?.find(s => s.slotNumber === slotNumber) || null;
  state.formType     = '__plc_slot__';
  state.formId       = null;
  state.formPreset   = { rackId, slotNumber };
  state.formImages   = [];
  state.formIoPoints = existing?.ioPoints
    ? existing.ioPoints.map(r => ({ label: r.label ?? r.tagName ?? 'Spare', terminal: r.terminal || '', description: r.description || '' }))
    : [];
  el.formTitle.textContent = existing
    ? `Slot ${slotNumber} — Edit Card`
    : `Slot ${slotNumber} — Add Card`;
  renderForm();
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

function openSlotDetail(rackId, slotNumber) {
  const wasOpen = !!state.detailType;
  if (wasOpen) {
    state.detailStack.push({ type: state.detailType, id: state.detailId, slotNumber: state.detailSlotNumber });
    state.detailChanges = {};
  }
  state.detailType       = '__plc_slot__';
  state.detailId         = rackId;
  state.detailSlotNumber = slotNumber;
  renderDetail();
  if (!wasOpen) {
    el.detail.classList.remove('animating');
    el.detail.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => el.detail.classList.add('open')));
  }
  el.backBtn.style.visibility = 'visible';
  el.addBtn.style.visibility  = 'hidden';
  el.pageTitle.textContent    = `Slot ${slotNumber}`;
}

async function openAssignOrCreate(childType, parentField, parentId) {
  await refreshAll();
  const cfg        = ENTITY[childType];
  const unassigned = (state.cache[childType] || []).filter(i => !i[parentField]);

  if (!unassigned.length) {
    openSheet(childType, null, { field: parentField, value: parentId });
    return;
  }

  const selected = new Set();
  state.formType   = '__picker__';
  state.pickerMeta = { childType, parentField, parentId, selected };
  el.formTitle.textContent = `Add ${cfg.label}`;
  el.formSave.textContent  = 'Assign';
  el.formSave.disabled     = true;

  const infoField = cfg.fields.find(f =>
    f.key !== 'name' && f.key !== parentField && f.key !== 'powerId' &&
    (f.type === 'text' || f.type === 'enum')
  );

  const checkIcon = `<svg class="picker-check-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const plusIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

  el.formBody.innerHTML = `
    <div style="margin-bottom:20px">
      <button class="btn btn-outline btn-full" id="picker-create-new">${plusIcon} Create New ${esc(cfg.label)}</button>
    </div>
    <div class="picker-or-label">or select existing to assign</div>
    ${unassigned.map(item => {
      const info = infoField ? item[infoField.key] : '';
      return `<div class="picker-item" data-id="${item.id}">
        <div class="picker-item-body">
          <div class="picker-item-name">${esc(item.name)}</div>
          ${info ? `<div class="picker-item-info">${esc(info)}</div>` : ''}
        </div>
        ${checkIcon}
      </div>`;
    }).join('')}
  `;

  const updateBtn = () => {
    el.formSave.disabled    = selected.size === 0;
    el.formSave.textContent = selected.size > 0 ? `Assign (${selected.size})` : 'Assign';
  };

  el.formBody.querySelector('#picker-create-new').addEventListener('click', () => {
    closeSheet();
    openSheet(childType, null, { field: parentField, value: parentId });
  });

  el.formBody.querySelectorAll('.picker-item').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      if (selected.has(id)) {
        selected.delete(id);
        row.classList.remove('picker-item-selected');
      } else {
        selected.add(id);
        row.classList.add('picker-item-selected');
      }
      updateBtn();
    });
  });

  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

/* ============================================================
   ROUTER
   ============================================================ */

function navigate(page) {
  if (state.detailType) { state.detailStack = []; closeDetail(); }
  if (state.formType)   closeSheet();
  state.page = page;
  window.location.hash = page;
  setHeaderForPage(page);
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  renderPage();
}

function setHeaderForPage(page) {
  if (page === 'home') {
    el.pageTitle.textContent   = 'blueprint';
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'hidden';
  } else if (page === 'plc') {
    el.pageTitle.textContent   = 'PLCs';
    el.backBtn.style.visibility = 'hidden';
    el.addBtn.style.visibility  = 'visible';
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
  if (state.page === 'plc') {
    await renderList('assets', {
      preFilter: a => a.assetClass === 'PLC',
      label:  'PLC Rack',
      plural: 'PLC Racks',
    });
    return;
  }
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
    <div class="home-data-actions">
      <div class="section-label">Data Management</div>
      <div class="home-data-btns">
        <button class="btn btn-outline" id="home-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-outline" id="home-import-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import
        </button>
      </div>
    </div>
  `;

  el.main.querySelector('#home-edit-plant').addEventListener('click', () => openPlantForm());
  el.main.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
  el.main.querySelector('#home-export-btn').addEventListener('click', exportData);
  el.main.querySelector('#home-import-btn').addEventListener('click', importData);
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
async function renderList(type, opts = {}) {
  await loadCache([type, 'areas', 'panels', 'power', 'safety', 'networks']);
  let items = state.cache[type] || [];
  if (opts.preFilter) items = items.filter(opts.preFilter);
  const cfg        = ENTITY[type];
  const cfgLabel   = opts.label  || cfg.label;
  const cfgPlural  = opts.plural || cfg.plural;

  const parentFilter = buildParentFilterChips(type, items);

  el.main.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="list-search" class="search-input" type="search" placeholder="Search ${cfgPlural.toLowerCase()}…">
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
        ? `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>No ${cfgPlural} yet</h3><p>Tap <strong>+</strong> to add your first ${cfgLabel.toLowerCase()}.</p></div>`
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

  const allChildren = [
    ...(cfg.getChildren || []),
    ...(cfg.subclassChildren?.[item?.assetSubclass] || []),
  ];
  const counts = allChildren.map(child => {
    const all = state.cache[child.store] || [];
    const n = child.countFn
      ? child.countFn(all, item.id)
      : child.filter
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

async function renderDetail({ preserveScroll = false } = {}) {
  const { detailType: type, detailId: id } = state;
  if (!type || !id) return;
  const savedScroll = preserveScroll ? el.detail.scrollTop : 0;

  // Slot detail — renders card data embedded in the rack's slots array
  if (type === '__plc_slot__') {
    await refreshAll();
    const rack = state.refs.assets?.[id];
    if (!rack) { closeDetail(); return; }
    const slotNumber = state.detailSlotNumber;
    const slot = rack.slots?.find(s => s.slotNumber === slotNumber);
    const network = slot?.networkId ? state.refs.networks?.[slot.networkId] : null;

    const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const backIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;

    const field = (label, val) => val
      ? `<div class="det-field"><div class="det-flabel">${esc(label)}</div><div class="det-fval">${esc(val)}</div></div>`
      : `<div class="det-field"><div class="det-flabel">${esc(label)}</div><div class="det-fval det-fval-empty">—</div></div>`;

    // IO usage for Analog/Digital
    let ioUsage = '';
    if (slot?.cardType === 'Analog' || slot?.cardType === 'Digital') {
      const total = parseInt(slot?.ioPointCount) || (slot?.ioPoints?.length ?? 0);
      const inUse = (slot?.ioPoints || []).filter(p => p.label && p.label !== 'Spare').length;
      ioUsage = `${inUse} / ${total}`;
    }

    // Base fields every card has
    let fieldsHtml = field('Part Number', slot?.partNumber)
      + field('Revision', slot?.revision)
      + field('Firmware Version', slot?.firmwareVersion)
      + (ioUsage ? field('IO In Use', ioUsage) : '');

    // Card-type-specific fields
    const ctFields = PLC_CARD_TYPE_FIELDS[slot?.cardType] || [];
    for (const f of ctFields) {
      if (f.type === 'ref') {
        const refItem = f.refStore === 'networks' ? network : state.refs[f.refStore]?.[slot?.[f.key]];
        fieldsHtml += field(f.label, refItem?.name);
      } else {
        fieldsHtml += field(f.label, slot?.[f.key]);
      }
    }

    // Network address fields for Controller cards
    if (slot?.cardType === 'Controller' && network) {
      const netFields = ENTITY.assets.networkTypeFields?.[network.networkType] || [];
      for (const f of netFields) fieldsHtml += field(f.label, slot?.[f.key]);
    }

    // IO points table for Analog/Digital
    let ioCard = '';
    if (slot?.cardType === 'Analog' || slot?.cardType === 'Digital') {
      const pts = slot?.ioPoints || [];
      const rowsHtml = pts.length
        ? `<table class="wiring-det-table">
             <thead><tr><th>#</th><th>Label</th><th>Terminal</th><th>Description</th></tr></thead>
             <tbody>${pts.map((r, i) => `
               <tr>
                 <td class="wiring-det-terminal">${i}</td>
                 <td>${esc(r.label || '')}</td>
                 <td>${esc(r.terminal || '')}</td>
                 <td>${esc(r.description || '')}</td>
               </tr>`).join('')}
             </tbody>
           </table>`
        : `<div class="wiring-empty">No IO points configured</div>`;
      ioCard = buildCollapsibleCard('IO Points', rowsHtml, { expanded: true });
    }

    el.detail.innerHTML = `
      <div class="det-header">
        <button class="icon-btn" id="det-back" aria-label="Back">${backIcon}</button>
        <div style="flex:1"></div>
        <button class="icon-btn" id="det-edit" aria-label="Edit">${editIcon}</button>
      </div>
      <div class="det-body">
        <div class="det-title-row">
          <div class="det-name">${esc(slot?.name || '(unnamed card)')}</div>
        </div>
        <div class="det-badges">
          <span class="badge badge-asset">Slot ${slotNumber}</span>
          ${slot?.cardType ? `<span class="badge badge-asset">${esc(slot.cardType)}</span>` : ''}
          <span class="badge badge-panel">${esc(rack.name)}</span>
        </div>
        <div class="det-card">
          <div class="det-fields">${fieldsHtml}</div>
        </div>
        ${ioCard}
      </div>
    `;

    el.detail.querySelector('#det-back').addEventListener('click', closeDetail);
    el.detail.querySelector('#det-edit')?.addEventListener('click', () => openSlotForm(id, slotNumber));
    el.detail.querySelectorAll('.det-section-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const body     = btn.closest('.det-collapsible').querySelector('.det-section-body');
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        body.style.display = expanded ? 'none' : 'block';
      });
    });
    el.detail.querySelectorAll('[data-lightbox]').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src));
    });
    el.detail.scrollTop = savedScroll;
    return;
  }

  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) { state.detailStack = []; closeDetail(); return; }
  await refreshAll();

  // Build field rows grouped by section (all fields shown, blank or not)
  const skipKeys = new Set(['id','createdAt','updatedAt','images','namedPhotos','assignedToType','assignedToId','name']);
  const sectionMap = new Map();
  for (const f of getEffectiveFields(type, item)) {
    if (skipKeys.has(f.key) || f.type === 'assign-type' || f.type === 'assign-id') continue;
    // PLC racks have no meaningful subtype — hide the field
    if (f.key === 'assetSubclass' && item.assetClass === 'PLC') continue;
    const rawVal = item[f.key];
    let displayVal;
    if (f.type === 'ref') {
      const refItem = state.refs[f.refStore]?.[rawVal];
      displayVal = refItem ? refItem.name : '';
    } else {
      displayVal = rawVal != null ? String(rawVal) : '';
    }
    const isEmpty = !displayVal;
    const fieldHtml = `<div class="det-field" data-key="${f.key}"><div class="det-flabel">${esc(f.label)}</div><div class="det-fval${isEmpty ? ' det-fval-empty' : ''}">${isEmpty ? '—' : esc(displayVal)}</div></div>`;
    const sectionKey = f.section || null;
    if (!sectionMap.has(sectionKey)) sectionMap.set(sectionKey, []);
    sectionMap.get(sectionKey).push(fieldHtml);
  }

  const generalFields = (sectionMap.get(null) || []).join('');

  // Categorise named sections: detail sections vs. physical/clearance sections
  const PHYSICAL_SECTIONS = new Set(['Physical Sizing', 'Backpanel Sizing', 'Clearance']);
  let detailSectionCards = '';
  let physicalSectionCards = '';
  for (const [section, rows] of sectionMap) {
    if (!section) continue;
    if (PHYSICAL_SECTIONS.has(section)) {
      physicalSectionCards += buildCollapsibleCard(section, rows.join(''));
    } else {
      detailSectionCards += buildCollapsibleCard(section, rows.join(''));
    }
  }

  // Wiring table cards (collapseable)
  let wiringCards = '';
  if (cfg.wiringTables) {
    for (const t of cfg.wiringTables) {
      const wRows = item[t.key] || [];
      const rowsHtml = wRows.length
        ? wRows.map(r => `<tr><td class="wiring-det-terminal">${esc(r.terminal)}</td><td>${esc(r.label)}</td></tr>`).join('')
        : `<tr><td colspan="2" class="wiring-empty">No entries</td></tr>`;
      wiringCards += buildCollapsibleCard(t.label,
        `<table class="wiring-det-table"><thead><tr><th>Terminal</th><th>Label</th></tr></thead><tbody>${rowsHtml}</tbody></table>`);
    }
  }

  // Required photos card (collapseable)
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
    requiredPhotosCard = buildCollapsibleCard('Required Photos', photoItems);
  }

  // Other photos card (collapseable)
  let otherPhotosCard = '';
  if (!cfg.noImages) {
    const galleryHtml = item.images?.length
      ? `<div class="det-gallery">${item.images.map(src => `<img src="${src}" alt="" data-lightbox>`).join('')}</div>`
      : `<div style="color:var(--muted);font-size:14px;padding:4px 0">No photos added.</div>`;
    otherPhotosCard = buildCollapsibleCard('Other Photos', galleryHtml);
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

  // PLC rack slots card — each slot is clickable to add/edit its card
  let rackSlotsCard = '';
  if (type === 'assets' && item.assetClass === 'PLC') {
    const slotCount  = parseInt(item.slotCount) || 0;
    const slotsMap   = new Map((item.slots || []).map(s => [s.slotNumber, s]));
    const cardCount  = (item.slots || []).length;
    const chevron    = `<svg class="det-toggle-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const title      = cardCount > 0 ? `Cards (${cardCount})` : 'Cards';
    const clearIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    let slotRows = '';
    if (slotCount === 0) {
      slotRows = `<div style="font-size:14px;color:var(--muted)">No slots configured — edit the rack to set Slot Count.</div>`;
    } else {
      slotRows = Array.from({ length: slotCount }, (_, k) => {
        const slot = slotsMap.get(k);
        if (slot) {
          const typeTag  = slot.cardType  ? `<span class="sn-det-field">${esc(slot.cardType)}</span>`  : '';
          const pnTag    = slot.partNumber ? `<span class="sn-det-field">PN<strong>${esc(slot.partNumber)}</strong></span>` : '';
          const revTag   = slot.revision   ? `<span class="sn-det-field">Rev<strong>${esc(slot.revision)}</strong></span>`  : '';
          let ioTag = '';
          if (slot.cardType === 'Analog' || slot.cardType === 'Digital') {
            const total = parseInt(slot.ioPointCount) || (slot.ioPoints?.length ?? 0);
            const inUse = (slot.ioPoints || []).filter(p => p.label && p.label !== 'Spare').length;
            ioTag = `<span class="sn-det-field">IO<strong>${inUse}/${total}</strong></span>`;
          }
          return `<div class="sn-det-row rack-slot-row" data-rack-id="${item.id}" data-slot-num="${k}" style="cursor:pointer">
            <div class="rack-slot-hdr">
              <span class="sn-det-name">Slot ${k}</span>
              <button class="rack-slot-clear wiring-rm-btn" data-rack-id="${item.id}" data-slot-num="${k}" aria-label="Clear slot">${clearIcon}</button>
            </div>
            <div class="sn-det-fields"><span class="sn-det-field"><strong>${esc(slot.name || '—')}</strong></span>${typeTag}${pnTag}${revTag}${ioTag}</div>
          </div>`;
        }
        return `<div class="sn-det-row rack-slot-row" data-rack-id="${item.id}" data-slot-num="${k}" style="cursor:pointer">
          <div class="rack-slot-hdr"><span class="sn-det-name">Slot ${k}</span></div>
          <div class="sn-det-fields" style="color:var(--muted)">Empty — tap to add card</div>
        </div>`;
      }).join('');
    }

    rackSlotsCard = `
      <div class="det-card det-collapsible">
        <button class="det-section-toggle" aria-expanded="true">
          <span class="section-label" style="margin:0">${title}</span>
          ${chevron}
        </button>
        <div class="det-section-body">
          <div class="sn-det-list">${slotRows}</div>
        </div>
      </div>`;
  }

  let ioPointsCard = '';

  // Switch/Router network connections and port assignment cards
  let switchNetworksCard = '';
  let switchPortsCard    = '';
  if (type === 'assets') {
    const showTables = item.assetClass === 'Network Switch' &&
                       (item.assetSubclass === 'Managed' || item.assetSubclass === 'Router');
    if (showTables) {
      const snHtml = item.switchNetworks?.length
        ? item.switchNetworks.map(r => {
            const net        = state.refs.networks?.[r.networkId];
            const addrFields = ENTITY.assets.networkTypeFields?.[net?.networkType] || [];
            const fieldPills = addrFields
              .filter(f => r[f.key])
              .map(f => `<span class="sn-det-field">${esc(f.label)}<strong>${esc(r[f.key])}</strong></span>`)
              .join('');
            return `<div class="sn-det-row">
              <div class="sn-det-name">${esc(net?.name || '—')}</div>
              ${fieldPills ? `<div class="sn-det-fields">${fieldPills}</div>` : ''}
            </div>`;
          }).join('')
        : `<div class="wiring-empty">No networks assigned</div>`;
      switchNetworksCard = buildCollapsibleCard('Network Connections', `<div class="sn-det-list">${snHtml}</div>`);

      const spHtml = item.switchPorts?.length
        ? item.switchPorts.map(r => {
            const net   = state.refs.networks?.[r.networkId];
            const asset = state.refs.assets?.[r.assetId];
            const pills = [
              net   ? `<span class="sn-det-field">Network<strong>${esc(net.name)}</strong></span>`   : '',
              `<span class="sn-det-field">Device<strong>${esc(asset?.name || 'No Connection')}</strong></span>`,
            ].filter(Boolean).join('');
            return `<div class="sn-det-row">
              <div class="sn-det-name">${esc(r.portName || '—')}</div>
              <div class="sn-det-fields">${pills}</div>
            </div>`;
          }).join('')
        : `<div class="wiring-empty">No ports assigned</div>`;
      switchPortsCard = buildCollapsibleCard('Port Assignments', `<div class="sn-det-list">${spHtml}</div>`);
    }
  }

  // Related children
  const childSections = await buildChildSections(type, id, item);

  el.detail.innerHTML = `
    <div class="det-header">
      <button class="det-back-btn" id="det-back" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
    </div>
    ${buildDetailCompletenessHtml(type, item)}
    <div class="det-card">
      ${type === 'areas'
        ? `<input class="det-name-input" id="det-name-input" type="text" value="${esc(item.name)}" readonly>`
        : `<div class="det-name-row">
             <div class="det-name">${esc(item.name)}</div>
             <button class="det-edit-btn" id="det-edit" aria-label="Edit">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
             </button>
           </div>`
      }
      <div class="det-badges">
        <span class="badge ${cfg.badgeClass}">${esc(cfg.label)}</span>
        ${assignBadge}
      </div>
      ${generalFields || ''}
    </div>
    ${detailSectionCards}
    ${wiringCards}
    ${rackSlotsCard}
    ${ioPointsCard}
    ${switchNetworksCard}
    ${switchPortsCard}
    ${physicalSectionCards}
    ${requiredPhotosCard}
    ${otherPhotosCard}
    ${childSections}
    <div class="det-save-bar" id="det-save-bar">
      <button class="btn btn-outline btn-sm" id="det-discard">Discard</button>
      <button class="btn btn-primary btn-sm" id="det-save-changes">Save Changes</button>
    </div>
  `;

  state.detailChanges = {};

  el.detail.querySelectorAll('[data-lightbox]').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
  el.detail.querySelector('#det-back').addEventListener('click', closeDetail);

  el.detail.querySelector('#det-edit')?.addEventListener('click', () => openSheet(type, id));

  // Save bar buttons
  el.detail.querySelector('#det-discard')?.addEventListener('click', () => {
    state.detailChanges = {};
    renderDetail();
  });
  el.detail.querySelector('#det-save-changes')?.addEventListener('click', () => {
    saveDetailChanges(type, id);
  });

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
  el.detail.querySelectorAll('.rack-slot-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.rack-slot-clear')) return;
      const rackId  = row.dataset.rackId;
      const slotNum = +row.dataset.slotNum;
      const rack    = state.refs.assets?.[rackId];
      const hasCard = rack?.slots?.some(s => s.slotNumber === slotNum);
      if (hasCard) openSlotDetail(rackId, slotNum);
      else         openSlotForm(rackId, slotNum);
    });
  });
  el.detail.querySelectorAll('.rack-slot-clear').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const rackId  = btn.dataset.rackId;
      const slotNum = +btn.dataset.slotNum;
      const rack    = state.refs.assets?.[rackId];
      if (!rack) return;
      const slot = rack.slots?.find(s => s.slotNumber === slotNum);
      const ok = await confirm('Delete card?', `Remove "${slot?.name || 'card'}" from Slot ${slotNum}? This cannot be undone.`);
      if (!ok) return;
      const slots = (rack.slots || []).filter(s => s.slotNumber !== slotNum);
      await upsert('assets', { ...rack, slots });
      await refreshAll();
      renderDetail({ preserveScroll: true });
    });
  });

  el.detail.querySelectorAll('[data-add-child]').forEach(btn => {
    btn.addEventListener('click', () => {
      const childType    = btn.dataset.addChild;
      const presetField  = btn.dataset.presetField;
      const presetVal    = btn.dataset.presetVal;
      const extraPresets = btn.dataset.extraPresets ? JSON.parse(btn.dataset.extraPresets) : {};
      if ((childType === 'power' || childType === 'safety') && presetField === 'panelId') {
        openAssignOrCreate(childType, presetField, presetVal);
      } else {
        openSheet(childType, null, { field: presetField, value: presetVal, extra: extraPresets });
      }
    });
  });

  // Collapseable section toggles
  el.detail.querySelectorAll('.det-section-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const body = btn.closest('.det-collapsible').querySelector('.det-section-body');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      body.style.display = expanded ? 'none' : 'block';
    });
  });

  el.detail.scrollTop = savedScroll;
}

function buildCollapsibleCard(title, bodyHtml, { expanded = false } = {}) {
  const chevron = `<svg class="det-toggle-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  return `
    <div class="det-card det-collapsible">
      <button class="det-section-toggle" aria-expanded="${expanded}">
        <span class="section-label" style="margin:0">${esc(title)}</span>
        ${chevron}
      </button>
      <div class="det-section-body" style="${expanded ? '' : 'display:none'}"
        ${bodyHtml}
      </div>
    </div>
  `;
}

async function buildChildSections(type, id, item) {
  const cfg = ENTITY[type];
  const allChildren = [
    ...(cfg.getChildren || []),
    ...(cfg.subclassChildren?.[item?.assetSubclass] || []),
  ];
  if (!allChildren.length) return '';

  const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const chevron  = `<svg class="det-toggle-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  let html = '';
  for (const child of allChildren) {
    const all      = state.cache[child.store] || [];
    const filtered = (child.filter
      ? all.filter(i => i[child.field] === id && child.filter(i))
      : all.filter(i => i[child.field] === id)
    ).concat(
      // Also include switch assets connected to this network via switchNetworks
      type === 'networks' && child.store === 'assets'
        ? all.filter(a => a[child.field] !== id && a.switchNetworks?.some(sn => sn.networkId === id))
        : []
    );

    const rows    = filtered.map(ci => cardHTML(child.store, ci)).join('');
    const count   = filtered.length;
    const title   = count > 0 ? `${esc(child.label)} (${count})` : esc(child.label);
    const bodyHtml = rows
      ? `<div class="card-list child-card-list" data-child-store="${child.store}">${rows}</div>`
      : `<div style="font-size:14px;color:var(--muted)">None added yet.</div>`;

    html += `
      <div class="det-card det-collapsible">
        <div class="det-collapsible-hdr">
          <button class="det-section-toggle" aria-expanded="false">
            <span class="section-label" style="margin:0">${title}</span>
            ${chevron}
          </button>
          <button class="det-add-child-btn" data-add-child="${child.store}" data-preset-field="${child.field}" data-preset-val="${id}" data-extra-presets="${esc(JSON.stringify(child.extraPresets || {}))}" aria-label="Add ${esc(child.label)}">${plusIcon}</button>
        </div>
        <div class="det-section-body" style="display:none">
          ${bodyHtml}
        </div>
      </div>
    `;
  }
  return html;
}

/* ============================================================
   DETAIL INLINE EDITING
   ============================================================ */

function showDetailSaveBar() {
  el.detail.querySelector('#det-save-bar')?.classList.add('visible');
}

function activateNameEdit(nameDiv, item) {
  const input = document.createElement('input');
  input.className = 'det-name-input';
  input.value = state.detailChanges['name'] ?? item.name;
  nameDiv.textContent = '';
  nameDiv.appendChild(input);
  input.focus();
  input.addEventListener('input', () => {
    state.detailChanges['name'] = input.value;
    showDetailSaveBar();
  });
  input.addEventListener('blur', () => {
    const val = state.detailChanges['name'] ?? item.name;
    nameDiv.textContent = val || item.name;
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
}

function activateInlineEdit(field, fConfig, item) {
  const fvalEl = field.querySelector('.det-fval');
  const rawVal = state.detailChanges[fConfig.key] !== undefined
    ? state.detailChanges[fConfig.key]
    : (item[fConfig.key] ?? '');

  let control;
  if (fConfig.type === 'text') {
    control = document.createElement('input');
    control.className = 'det-inline-input';
    control.type = 'text';
    control.value = String(rawVal);
  } else if (fConfig.type === 'textarea') {
    control = document.createElement('textarea');
    control.className = 'det-inline-textarea';
    control.value = String(rawVal);
  } else if (fConfig.type === 'enum') {
    control = document.createElement('select');
    control.className = 'det-inline-select';
    control.innerHTML = `<option value="">— Select —</option>` +
      fConfig.options.map(o => `<option value="${esc(o)}"${o === rawVal ? ' selected' : ''}>${esc(o)}</option>`).join('');
  } else if (fConfig.type === 'ref') {
    const refItems = state.cache[fConfig.refStore] || [];
    control = document.createElement('select');
    control.className = 'det-inline-select';
    control.innerHTML = `<option value="">— Unassigned —</option>` +
      refItems.map(i => `<option value="${i.id}"${i.id === rawVal ? ' selected' : ''}>${esc(i.name)}</option>`).join('');
  }

  if (!control) return;

  fvalEl.innerHTML = '';
  fvalEl.classList.remove('det-fval-empty');
  fvalEl.appendChild(control);
  control.focus();

  const markDirty = () => {
    state.detailChanges[fConfig.key] = control.value;
    showDetailSaveBar();
  };
  control.addEventListener('input', markDirty);
  control.addEventListener('change', markDirty);

  control.addEventListener('blur', () => {
    const currentVal = state.detailChanges[fConfig.key] !== undefined
      ? state.detailChanges[fConfig.key]
      : (item[fConfig.key] ?? '');
    let displayVal;
    if (fConfig.type === 'ref') {
      const refItem = state.refs[fConfig.refStore]?.[currentVal];
      displayVal = refItem ? refItem.name : '';
    } else {
      displayVal = currentVal;
    }
    const isEmpty = !displayVal;
    fvalEl.classList.toggle('det-fval-empty', isEmpty);
    fvalEl.textContent = isEmpty ? '—' : String(displayVal);

    // Auto-sync areaId when panelId is changed inline
    if (fConfig.key === 'panelId') {
      const efFields = getEffectiveFields(state.detailType, item);
      if (efFields.some(f => f.key === 'areaId')) {
        const panel = state.refs.panels?.[currentVal];
        if (panel?.areaId) {
          state.detailChanges['areaId'] = panel.areaId;
          showDetailSaveBar();
          const areaField = el.detail.querySelector('.det-field-editable[data-key="areaId"]');
          if (areaField) {
            const areaFval  = areaField.querySelector('.det-fval');
            const areaName  = state.refs.areas?.[panel.areaId]?.name || '';
            areaFval.classList.toggle('det-fval-empty', !areaName);
            areaFval.textContent = areaName || '—';
          }
        }
      }
    }
  });
}

async function saveDetailChanges(type, id) {
  if (!Object.keys(state.detailChanges).length) return;
  const cfg  = ENTITY[type];
  const item = await getById(type, id);
  if (!item) return;
  const updatedItem = { ...item, ...state.detailChanges };
  for (const f of getEffectiveFields(type, updatedItem)) {
    if (f.required && !updatedItem[f.key]) {
      showToast(`${f.label} is required`, 'error');
      return;
    }
  }
  await upsert(type, updatedItem);
  await refreshAll();
  state.detailChanges = {};
  showToast(`${cfg.label} saved`, 'success');
  renderDetail();
}

/* ============================================================
   FORM RENDERING
   ============================================================ */

async function renderForm() {
  const { formType: type, formId: id } = state;
  if (type === '__plant__') return; // already rendered

  if (type === '__plc_slot__') {
    const { rackId, slotNumber } = state.formPreset;
    const rack     = state.refs.assets?.[rackId];
    const existing = rack?.slots?.find(s => s.slotNumber === slotNumber) || null;
    await refreshAll();

    const cardTypeOpts = ['Controller','Communication','Analog','Digital','Specialty']
      .map(t => `<option value="${t}"${existing?.cardType === t ? ' selected' : ''}>${t}</option>`)
      .join('');
    el.formBody.innerHTML = `
      <div class="fg"><label class="f-label">Card Name</label>
        <input class="f-input" id="f-name" type="text" value="${esc(existing?.name || '')}"></div>
      <div class="fg"><label class="f-label">Card Type</label>
        <select class="f-select" id="f-cardType"><option value=""></option>${cardTypeOpts}</select></div>
      <div class="fg"><label class="f-label">Part Number</label>
        <input class="f-input" id="f-partNumber" type="text" value="${esc(existing?.partNumber || '')}"></div>
      <div class="fg"><label class="f-label">Firmware Version</label>
        <input class="f-input" id="f-firmwareVersion" type="text" value="${esc(existing?.firmwareVersion || '')}"></div>
      <div class="fg"><label class="f-label">Revision</label>
        <input class="f-input" id="f-revision" type="text" value="${esc(existing?.revision || '')}"></div>
      <div id="slot-cardtype-container"></div>
      <div id="network-address-container"></div>
      <div id="io-points-wrap" style="display:none">
        <div class="form-section-hdr">IO Points</div>
        <div id="io-points-container"></div>
      </div>
    `;

    const renderSlotNetworkAddressFields = async () => {
      const networkId = $('f-networkId')?.value;
      const network   = state.refs.networks?.[networkId];
      const fields    = ENTITY.assets.networkTypeFields?.[network?.networkType] || [];
      const container = $('network-address-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; return; }
      let ph = `<div class="form-section-hdr">Network Address</div>`;
      for (const f of fields) ph += await buildFormField(f, existing, 'assets');
      container.innerHTML = ph;
    };

    const renderSlotCardTypeFields = async () => {
      const cardType  = $('f-cardType')?.value;
      const fields    = PLC_CARD_TYPE_FIELDS[cardType] || [];
      const container = $('slot-cardtype-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; } else {
        let ph = '';
        for (const f of fields) ph += await buildFormField(f, existing, 'assets');
        container.innerHTML = ph;
        if (cardType === 'Controller') {
          $('f-networkId')?.addEventListener('change', renderSlotNetworkAddressFields);
          await renderSlotNetworkAddressFields();
        }
      }
      const ioWrap = $('io-points-wrap');
      if (ioWrap) {
        const isIo = cardType === 'Analog' || cardType === 'Digital';
        ioWrap.style.display = isIo ? '' : 'none';
        if (isIo) {
          renderIoPointsTable();
          const ioCountEl = $('f-ioPointCount');
          if (ioCountEl) ioCountEl.addEventListener('change', syncIoPointCount);
        }
      }
    };

    $('f-cardType').addEventListener('change', renderSlotCardTypeFields);
    await renderSlotCardTypeFields();
    return;
  }
  const cfg      = ENTITY[type];
  const rawExisting = id ? await getById(type, id) : null;
  // For new forms, synthesize defaults from preset so dropdowns pre-select correctly
  const existing = rawExisting ?? ((!id && state.formPreset)
    ? {
        ...(state.formPreset.extra || {}),
        ...(state.formPreset.field ? { [state.formPreset.field]: state.formPreset.value } : {}),
      }
    : null);
  await refreshAll();

  const FORM_PHYSICAL_SECTIONS = new Set(['Physical Sizing', 'Clearance']);
  let html = '';
  let physicalHtml = '';
  let currentSection = undefined;
  let physicalSection = undefined;
  for (const f of cfg.fields) {
    if (type === 'assets' && FORM_PHYSICAL_SECTIONS.has(f.section)) {
      if (f.section !== physicalSection) {
        physicalSection = f.section;
        physicalHtml += `<div class="form-section-hdr">${esc(f.section)}</div>`;
      }
      physicalHtml += await buildFormField(f, existing, type);
      continue;
    }
    if (f.section !== currentSection) {
      currentSection = f.section;
      if (currentSection) html += `<div class="form-section-hdr">${esc(currentSection)}</div>`;
    }
    html += await buildFormField(f, existing, type);
  }

  if (type === 'networks') {
    html += `<div id="protocol-fields-container"></div>`;
  }

  if (type === 'assets') {
    html += `<div id="class-fields-container"></div>`;
    html += `<div id="subclass-fields-container"></div>`;
    html += `<div id="network-address-container"></div>`;
    html += `
      <div id="switch-networks-wrap" style="display:none">
        <div class="form-section-hdr">Network Connections</div>
        <div id="switch-networks-container"></div>
      </div>
      <div id="switch-ports-wrap" style="display:none">
        <div class="form-section-hdr">Port Assignments</div>
        <div id="switch-ports-container"></div>
      </div>
      <div id="card-type-fields-container"></div>
      <div id="io-points-wrap" style="display:none">
        <div class="form-section-hdr">IO Points</div>
        <div id="io-points-container"></div>
      </div>`;
    html += physicalHtml;
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

  // Wire up protocol-specific fields for networks
  if (type === 'networks') {
    const typeSelect = $('f-networkType');
    const renderProtocolFields = async () => {
      const networkType = typeSelect?.value;
      const protoFields = ENTITY.networks.protocolFields?.[networkType] || [];
      const container   = $('protocol-fields-container');
      if (!container) return;
      if (!protoFields.length) { container.innerHTML = ''; return; }
      let ph = '';
      let lastSection;
      for (const f of protoFields) {
        if (f.section !== lastSection) {
          lastSection = f.section;
          ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
        }
        ph += await buildFormField(f, existing, type);
      }
      container.innerHTML = ph;
    };
    typeSelect?.addEventListener('change', renderProtocolFields);
    await renderProtocolFields();
  }

  // Wire up asset-specific dynamic fields (subclass fields, network address, switch tables)
  if (type === 'assets') {
    const renderNetworkAddressFields = async () => {
      const networkId = $('f-networkId')?.value;
      const network   = state.refs.networks?.[networkId];
      const fields    = ENTITY.assets.networkTypeFields?.[network?.networkType] || [];
      const container = $('network-address-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; return; }
      let ph = `<div class="form-section-hdr">Network Address</div>`;
      for (const f of fields) ph += await buildFormField(f, existing, type);
      container.innerHTML = ph;
      // Prefill IP address with network subnet prefix if field is empty
      const ipInput = $('f-ipAddress');
      if (ipInput && !ipInput.value) {
        const prefix = getIpPrefix(network?.ipRange);
        if (prefix) ipInput.value = prefix;
      }
    };

    const updateSwitchTables = () => {
      const assetClass = $('f-assetClass')?.value;
      const subclass   = $('f-assetSubclass')?.value;
      const showTables = assetClass === 'Network Switch' && (subclass === 'Managed' || subclass === 'Router');
      const snWrap = $('switch-networks-wrap');
      const spWrap = $('switch-ports-wrap');
      if (snWrap) snWrap.style.display = showTables ? '' : 'none';
      if (spWrap) spWrap.style.display = showTables ? '' : 'none';
      if (showTables) {
        renderSwitchNetworksTable();
        renderSwitchPortsTable();
      }
    };

    const renderSubclassFields = async () => {
      const subclass  = $('f-assetSubclass')?.value;
      const fields    = ENTITY.assets.subclassFields?.[subclass] || [];
      const container = $('subclass-fields-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; updateSwitchTables(); return; }
      let ph = '', lastSection;
      for (const f of fields) {
        if (f.section !== lastSection) {
          lastSection = f.section;
          ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
        }
        ph += await buildFormField(f, existing, type);
      }
      container.innerHTML = ph;
      // Re-wire networkId listener and refresh address fields if subclass includes it
      if ($('f-networkId')) {
        $('f-networkId').addEventListener('change', renderNetworkAddressFields);
        await renderNetworkAddressFields();
      }
      // Auto-populate port rows when portCount changes (switch)
      const portCountEl = $('f-portCount');
      if (portCountEl) {
        portCountEl.addEventListener('change', () => {
          const count   = Math.max(0, parseInt(portCountEl.value) || 0);
          const current = state.formSwitchPorts.length;
          if (count > current) {
            for (let i = current + 1; i <= count; i++)
              state.formSwitchPorts.push({ portName: `Port ${i}`, networkId: '', assetId: '' });
          } else if (count < current) {
            state.formSwitchPorts.splice(count);
          }
          renderSwitchPortsTable();
        });
      }
      // Wire card type → card type fields
      const cardTypeEl = $('f-cardType');
      if (cardTypeEl) {
        cardTypeEl.addEventListener('change', renderCardTypeFields);
        await renderCardTypeFields();
      }
      updateSwitchTables();
    };

    const renderCardTypeFields = async () => {
      const cardType  = $('f-cardType')?.value;
      const fields    = ENTITY.assets.cardTypeFields?.[cardType] || [];
      const container = $('card-type-fields-container');
      if (!container) return;
      if (!fields.length) { container.innerHTML = ''; } else {
        let ph = '', lastSection;
        for (const f of fields) {
          if (f.section !== lastSection) {
            lastSection = f.section;
            ph += `<div class="form-section-hdr">${esc(f.section)}</div>`;
          }
          ph += await buildFormField(f, existing, type);
        }
        container.innerHTML = ph;
        if (cardType === 'Controller') {
          $('f-networkId')?.addEventListener('change', renderNetworkAddressFields);
          await renderNetworkAddressFields();
        }
      }
      // Show/hide IO points section and wire ioPointCount for Analog/Digital
      const ioWrap = $('io-points-wrap');
      if (ioWrap) {
        const isIo = cardType === 'Analog' || cardType === 'Digital';
        ioWrap.style.display = isIo ? '' : 'none';
        if (isIo) {
          renderIoPointsTable();
          const ioCountEl = $('f-ioPointCount');
          if (ioCountEl) ioCountEl.addEventListener('change', syncIoPointCount);
        }
      }
    };

    const renderClassSubclassField = async () => {
      const assetClass  = $('f-assetClass')?.value;
      let   subclasses  = ENTITY.assets.classSubclasses?.[assetClass] || [];
      const subclassSel = $('f-assetSubclass');
      if (!subclassSel) return;
      const currentSub = existing?.assetSubclass || '';
      // When editing, keep the item's current subclass even if it's no longer in the standard list
      if (currentSub && id && !subclasses.includes(currentSub)) subclasses = [...subclasses, currentSub];
      subclassSel.innerHTML = '<option value=""></option>' +
        subclasses.map(s => `<option value="${s}"${s === currentSub ? ' selected' : ''}>${esc(s)}</option>`).join('');
      const wrap = subclassSel.closest('.fg');
      if (wrap) wrap.style.display = subclasses.length ? '' : 'none';

      // Hide class selector when locked by preset (adding from PLCs page sets field='assetClass')
      const classIsLocked = !id && (
        state.formPreset?.extra?.assetClass ||
        state.formPreset?.field === 'assetClass'
      );
      const classWrap = $('f-assetClass')?.closest('.fg');
      if (classWrap) classWrap.style.display = classIsLocked ? 'none' : '';
      // Hide subclass selector when locked by extra preset or no subclasses available
      const subclassIsLocked = !id && state.formPreset?.extra?.assetSubclass;
      if (wrap) wrap.style.display = (subclassIsLocked || !subclasses.length) ? 'none' : '';

      // Render class-level fields (e.g. networkId for flat classes)
      const classFieldDefs = ENTITY.assets.classFields?.[assetClass] || [];
      const classCont = $('class-fields-container');
      if (classCont) {
        if (!classFieldDefs.length) {
          classCont.innerHTML = '';
        } else {
          let ph = '';
          for (const f of classFieldDefs) ph += await buildFormField(f, existing, type);
          classCont.innerHTML = ph;
          $('f-networkId')?.addEventListener('change', renderNetworkAddressFields);
          await renderNetworkAddressFields();
        }
      }

      await renderSubclassFields();

    };

    $('f-assetSubclass')?.addEventListener('change', renderSubclassFields);
    $('f-assetClass')?.addEventListener('change', renderClassSubclassField);
    await renderClassSubclassField();
  }

  // Auto-populate areaId from panel when panelId changes
  {
    const panelSel = $('f-panelId');
    const areaSel  = $('f-areaId');
    if (panelSel && areaSel) {
      panelSel.addEventListener('change', () => {
        const panel = state.refs.panels?.[panelSel.value];
        if (panel?.areaId) areaSel.value = panel.areaId;
      });
    }
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
  // For new items, apply preset value if this field matches (primary or extra presets)
  const presetVal = !existing
    ? (state.formPreset?.field === f.key ? state.formPreset.value : (state.formPreset?.extra?.[f.key] ?? null))
    : null;
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
    let items = state.cache[f.refStore] || [];
    if (f.refFilter) items = items.filter(f.refFilter);
    const opts  = items.map(i => `<option value="${i.id}" ${i.id === val ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
    return `<div class="fg">
      <label class="fg-label">${esc(f.label)}${f.required ? '<span class="req">*</span>' : ''}</label>
      <select id="f-${f.key}" class="f-select"${f.readOnly ? ' disabled' : ''}>
        <option value="">— Unassigned —</option>
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

function renderSwitchNetworksTable() {
  const container = $('switch-networks-container');
  if (!container) return;
  const rows = state.formSwitchNetworks;
  const takenNetIds = new Set(rows.map(r => r.networkId).filter(Boolean));
  const makeNetOpts = (selectedId) =>
    (state.cache.networks || [])
      .filter(n => n.networkType === 'Ethernet' && (!takenNetIds.has(n.id) || n.id === selectedId))
      .map(n => `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`).join('');
  const rmIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  const buildAddrFields = (r, i) => {
    const net     = state.refs.networks?.[r.networkId];
    const netType = net?.networkType;
    const fields  = ENTITY.assets.networkTypeFields?.[netType] || [];
    return fields.map(f => {
      let val = r[f.key] || '';
      if (!val && f.key === 'ipAddress') val = getIpPrefix(net?.ipRange);
      if (f.type === 'enum') {
        return `<select class="f-select sn-addr" data-idx="${i}" data-key="${f.key}">
          <option value="">— ${esc(f.label)} —</option>
          ${(f.options || []).map(o => `<option value="${o}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}
        </select>`;
      }
      return `<input class="f-input sn-addr" type="text" placeholder="${esc(f.label)}" data-idx="${i}" data-key="${f.key}" value="${esc(val)}">`;
    }).join('');
  };

  const isRouter = $('f-assetSubclass')?.value === 'Router';
  const atRouterMax = isRouter && rows.length >= 2;

  let html = rows.map((r, i) => `
    <div class="sn-network-row" data-idx="${i}">
      <div class="sn-network-row-top">
        <select class="f-select sn-network" data-idx="${i}">
          <option value="">— Select Network —</option>
          ${makeNetOpts(r.networkId)}
        </select>
        <button type="button" class="wiring-rm-btn sn-rm" data-idx="${i}">${rmIcon}</button>
      </div>
      ${buildAddrFields(r, i)}
    </div>`).join('');
  if (!atRouterMax) html += `<button type="button" class="wiring-add-btn sn-add">+ Add Network</button>`;
  container.innerHTML = html;

  container.querySelectorAll('.sn-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = +sel.dataset.idx;
      // Clear previous address fields when network changes
      const keys = Object.keys(state.formSwitchNetworks[idx]).filter(k => k !== 'networkId');
      keys.forEach(k => delete state.formSwitchNetworks[idx][k]);
      state.formSwitchNetworks[idx].networkId = sel.value;
      renderSwitchNetworksTable();
      renderSwitchPortsTable();
    });
  });

  container.querySelectorAll('.sn-addr').forEach(el => {
    const ev = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      state.formSwitchNetworks[+el.dataset.idx][el.dataset.key] = el.value;
    });
  });

  container.querySelectorAll('.sn-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const removedNetId = state.formSwitchNetworks[+btn.dataset.idx].networkId;
      state.formSwitchNetworks.splice(+btn.dataset.idx, 1);
      if (removedNetId) {
        state.formSwitchPorts.forEach(p => { if (p.networkId === removedNetId) p.networkId = ''; });
      }
      renderSwitchNetworksTable();
    });
  });
  container.querySelector('.sn-add')?.addEventListener('click', () => {
    state.formSwitchNetworks.push({ networkId: '' });
    renderSwitchNetworksTable();
  });
  renderSwitchPortsTable();
}

function renderSwitchPortsTable() {
  const container = $('switch-ports-container');
  if (!container) return;
  const rows = state.formSwitchPorts;
  const rmIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  // Only networks assigned to this switch are available for ports
  const assignedNetIds = new Set(state.formSwitchNetworks.map(r => r.networkId).filter(Boolean));
  const assignedNets   = (state.cache.networks || []).filter(n => assignedNetIds.has(n.id));

  const makeNetOpts = (selectedId) =>
    assignedNets.map(n =>
      `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>${esc(n.name)}</option>`
    ).join('');

  // Devices on the port's network, or unassigned — excluding this switch itself
  const selfId = state.formId;
  const makeDeviceOpts = (networkId, selectedId) =>
    (state.cache.assets || [])
      .filter(a => a.id !== selfId && (!networkId || !a.networkId || a.networkId === networkId))
      .map(a =>
        `<option value="${a.id}"${a.id === selectedId ? ' selected' : ''}>${esc(a.name)}</option>`
      ).join('');

  let html = rows.map((r, i) => `
    <div class="sp-port-row">
      <div class="sp-port-row-top">
        <input class="f-input sp-port" type="text" placeholder="Port ${i + 1}" data-idx="${i}" value="${esc(r.portName || '')}">
        <button type="button" class="wiring-rm-btn sp-rm" data-idx="${i}">${rmIcon}</button>
      </div>
      <select class="f-select sp-network" data-idx="${i}">
        <option value="">— Network —</option>
        ${makeNetOpts(r.networkId)}
      </select>
      <select class="f-select sp-device" data-idx="${i}">
        <option value="">— No Connection —</option>
        ${makeDeviceOpts(r.networkId, r.assetId)}
      </select>
    </div>`).join('');
  html += `<button type="button" class="wiring-add-btn sp-add">+ Add Port</button>`;
  container.innerHTML = html;

  container.querySelectorAll('.sp-port').forEach(inp => {
    inp.addEventListener('change', () => {
      state.formSwitchPorts[+inp.dataset.idx].portName = inp.value;
    });
  });

  container.querySelectorAll('.sp-network').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = +sel.dataset.idx;
      const newNetId = sel.value;
      // Clear device if it's not compatible with the new network
      const currentAssetId = state.formSwitchPorts[idx].assetId;
      if (currentAssetId) {
        const asset = state.refs.assets?.[currentAssetId];
        if (asset?.networkId && asset.networkId !== newNetId) {
          state.formSwitchPorts[idx].assetId = '';
        }
      }
      state.formSwitchPorts[idx].networkId = newNetId;
      // Refresh only the device dropdown for this row
      const row = container.querySelectorAll('.sp-port-row')[idx];
      const deviceSel = row?.querySelector('.sp-device');
      if (deviceSel) {
        deviceSel.innerHTML = `<option value="">— No Connection —</option>${makeDeviceOpts(newNetId, state.formSwitchPorts[idx].assetId)}`;
      }
    });
  });

  container.querySelectorAll('.sp-device').forEach(sel => {
    sel.addEventListener('change', () => {
      state.formSwitchPorts[+sel.dataset.idx].assetId = sel.value;
    });
  });

  container.querySelectorAll('.sp-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.formSwitchPorts.splice(+btn.dataset.idx, 1);
      renderSwitchPortsTable();
    });
  });

  container.querySelector('.sp-add')?.addEventListener('click', () => {
    const num = state.formSwitchPorts.length + 1;
    state.formSwitchPorts.push({ portName: `Port ${num}`, networkId: '', assetId: '' });
    renderSwitchPortsTable();
    const inputs = container.querySelectorAll('.sp-port');
    inputs[inputs.length - 1]?.select();
  });
}


function syncIoPointCount() {
  const count = parseInt($('f-ioPointCount')?.value) || 0;
  while (state.formIoPoints.length < count)
    state.formIoPoints.push({ label: 'Spare', terminal: '', description: '' });
  state.formIoPoints.length = count;
  renderIoPointsTable();
}

function renderIoPointsTable() {
  const container = $('io-points-container');
  if (!container) return;
  const rows = state.formIoPoints;
  const rmIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const rowsHtml = rows.map((r, i) => `
    <div class="wiring-form-row io-point-row">
      <span class="io-point-num">${i}</span>
      <input class="f-input io-tag"  type="text" placeholder="Label"       value="${esc(r.label       || '')}" data-idx="${i}" data-field="label">
      <input class="f-input io-term" type="text" placeholder="Terminal"    value="${esc(r.terminal    || '')}" data-idx="${i}" data-field="terminal">
      <input class="f-input io-desc" type="text" placeholder="Description" value="${esc(r.description || '')}" data-idx="${i}" data-field="description">
    </div>
  `).join('');
  container.innerHTML = rows.length
    ? `<div class="io-point-header">
        <span class="io-point-num">#</span>
        <span>Label</span><span>Terminal</span><span>Description</span>
       </div>${rowsHtml}`
    : '<div style="font-size:14px;color:var(--muted);padding:8px 0">Set IO Point Count to populate rows.</div>';
  container.querySelectorAll('.io-point-row input').forEach(input => {
    input.addEventListener('change', () => {
      state.formIoPoints[Number(input.dataset.idx)][input.dataset.field] = input.value;
    });
  });
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
  if (type === '__picker__') {
    const { childType, parentField, parentId, selected } = state.pickerMeta || {};
    if (!selected?.size) return;
    for (const id of selected) {
      const existing = state.refs[childType]?.[id];
      if (existing) await upsert(childType, { ...existing, [parentField]: parentId });
    }
    await refreshAll();
    const count = selected.size;
    const pcfg  = ENTITY[childType];
    closeSheet();
    showToast(`${count} ${pcfg.label}${count > 1 ? 's' : ''} assigned`, 'success');
    if (state.detailType) renderDetail();
    else renderPage();
    return;
  }

  // PLC slot card save
  if (type === '__plc_slot__') {
    const { rackId, slotNumber } = state.formPreset;
    const rack     = state.refs.assets?.[rackId];
    if (!rack) { showToast('Rack not found', 'error'); return; }
    const cardType = $('f-cardType')?.value || '';
    const slotData = {
      slotNumber,
      name:            $('f-name')?.value.trim()            || '',
      cardType,
      partNumber:      $('f-partNumber')?.value.trim()      || '',
      firmwareVersion: $('f-firmwareVersion')?.value.trim() || '',
      revision:        $('f-revision')?.value.trim()        || '',
    };
    for (const f of PLC_CARD_TYPE_FIELDS[cardType] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) slotData[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
    if (cardType === 'Controller') {
      const linkedNet = state.refs.networks?.[slotData.networkId];
      for (const f of ENTITY.assets.networkTypeFields?.[linkedNet?.networkType] || []) {
        const el2 = $(`f-${f.key}`);
        if (el2) slotData[f.key] = el2.value.trim();
      }
    }
    if (cardType === 'Analog' || cardType === 'Digital') {
      slotData.ioPoints = state.formIoPoints.map(r => ({...r}));
    }
    const slots = [...(rack.slots || [])];
    const idx   = slots.findIndex(s => s.slotNumber === slotNumber);
    if (idx >= 0) slots[idx] = slotData; else slots.push(slotData);
    await upsert('assets', { ...rack, slots });
    await refreshAll();
    closeSheet();
    showToast('Card saved', 'success');
    renderDetail({ preserveScroll: true });
    return;
  }

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

  // Read protocol-specific fields for networks
  if (type === 'networks') {
    const networkType = item.networkType;
    for (const f of ENTITY.networks.protocolFields?.[networkType] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
  }

  // Read subclass and network-type-driven fields for assets
  if (type === 'assets') {
    // Class-level fields (flat classes)
    for (const f of ENTITY.assets.classFields?.[item.assetClass] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
    // Subclass fields
    for (const f of ENTITY.assets.subclassFields?.[item.assetSubclass] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = f.type === 'ref' ? (el2.value || '') : el2.value.trim();
    }
    // Network address fields (driven by linked network's type)
    const linkedNetwork = state.refs.networks?.[item.networkId];
    for (const f of ENTITY.assets.networkTypeFields?.[linkedNetwork?.networkType] || []) {
      const el2 = $(`f-${f.key}`);
      if (el2) item[f.key] = el2.value.trim();
    }
    // Switch/Router tables
    const showTables = item.assetClass === 'Network Switch' &&
                       (item.assetSubclass === 'Managed' || item.assetSubclass === 'Router');
    if (showTables) {
      item.switchNetworks = state.formSwitchNetworks.filter(r => r.networkId);
      item.switchPorts    = state.formSwitchPorts.filter(r => r.portName || r.networkId || r.assetId);
    }
  }

  // Validate IP uniqueness across the network
  if (type === 'assets') {
    const ipAssignments = [];
    if (item.ipAddress && item.networkId)
      ipAssignments.push({ networkId: item.networkId, ipAddress: item.ipAddress });
    for (const sn of item.switchNetworks || []) {
      if (sn.ipAddress && sn.networkId)
        ipAssignments.push({ networkId: sn.networkId, ipAddress: sn.ipAddress });
    }
    for (const { networkId, ipAddress } of ipAssignments) {
      const conflicts = new Set();
      for (const a of state.cache.assets || []) {
        if (a.id === item.id) continue;
        if (a.ipAddress === ipAddress && a.networkId === networkId) conflicts.add(a.name);
        for (const sn of a.switchNetworks || []) {
          if (sn.ipAddress === ipAddress && sn.networkId === networkId) conflicts.add(a.name);
        }
      }
      if (conflicts.size) {
        showToast(`IP ${ipAddress} already used by: ${[...conflicts].join(', ')}`, 'error');
        return;
      }
    }
  }

  // Validate required fields
  for (const f of getEffectiveFields(type, item)) {
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

  // Ensure preset fields are set if not captured from DOM (e.g. fields not yet rendered)
  if (state.formPreset && !state.formId) {
    if (!item[state.formPreset.field]) item[state.formPreset.field] = state.formPreset.value;
    for (const [k, v] of Object.entries(state.formPreset.extra || {})) {
      if (!item[k]) item[k] = v;
    }
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

  // Collect direct children from cache
  const childRels = [];
  for (const rel of ENTITY[type].getChildren) {
    let items = (state.cache[rel.store] || []).filter(i => i[rel.field] === id);
    if (rel.filter) items = items.filter(rel.filter);
    if (items.length > 0) childRels.push({ ...rel, items });
  }

  let deleteChildren = false;
  if (childRels.length > 0) {
    const desc = childRels.map(r => `${r.items.length} ${r.label.toLowerCase()}`).join(', ');
    el.confirmYes.textContent = 'Also Delete';
    el.confirmNo.textContent  = 'Keep';
    deleteChildren = await confirm(
      'Delete associated items?',
      `"${name}" has ${desc}. Delete them too?`
    );
    el.confirmYes.textContent = 'Delete';
    el.confirmNo.textContent  = 'Cancel';
  }

  await remove(type, id);

  if (deleteChildren) {
    for (const rel of childRels) {
      for (const item of rel.items) {
        await cascadeDeleteItem(rel.store, item.id);
      }
    }
  } else {
    for (const rel of childRels) {
      for (const item of rel.items) {
        const updated = { ...item, [rel.field]: '' };
        if (rel.field === 'assignedToId') updated.assignedToType = '';
        await upsert(rel.store, updated);
      }
    }
  }

  await refreshAll();
  state.detailStack = [];
  closeDetail();
  showToast(`${ENTITY[type].label} deleted`);
  renderPage();
}

async function cascadeDeleteItem(type, id) {
  for (const rel of ENTITY[type].getChildren) {
    let children = (state.cache[rel.store] || []).filter(i => i[rel.field] === id);
    if (rel.filter) children = children.filter(rel.filter);
    for (const child of children) {
      await cascadeDeleteItem(rel.store, child.id);
    }
  }
  await remove(type, id);
}

/* ============================================================
   IMPORT / EXPORT
   ============================================================ */

async function exportData() {
  try {
    const stores = ['areas', 'panels', 'power', 'safety', 'networks', 'assets'];
    const payload = {
      appName:    'blueprint',
      version:    1,
      exportedAt: new Date().toISOString(),
      data:       {}
    };
    for (const name of stores) {
      payload.data[name] = await getAll(name);
    }
    payload.data.settings = await getAll('settings');

    const plantName = (await getSetting('plantName')) || 'plant';
    const dateStr   = new Date().toISOString().slice(0, 10);
    const filename  = `${plantName.replace(/[^a-z0-9]/gi, '-')}-export-${dateStr}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  } catch (err) {
    console.error('Export failed:', err);
    showToast('Export failed', 'error');
  }
}

function importData() {
  $('import-file-input').click();
}

async function processImportFile(file) {
  try {
    const text = await file.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      showToast('Invalid file: not valid JSON', 'error');
      return;
    }

    if (
      typeof payload !== 'object' || payload === null ||
      payload.appName !== 'blueprint' ||
      typeof payload.version !== 'number' ||
      typeof payload.data !== 'object'
    ) {
      showToast('Invalid file: unrecognised format', 'error');
      return;
    }

    el.confirmYes.textContent = 'Replace All';
    const ok = await confirm(
      'Replace all data?',
      'This will permanently delete all current data and replace it with the imported file. This cannot be undone.'
    );
    el.confirmYes.textContent = 'Delete';
    if (!ok) return;

    const allStores = ['areas', 'panels', 'power', 'safety', 'networks', 'assets', 'settings'];
    for (const name of allStores) {
      await clearStore(name);
    }
    for (const name of allStores) {
      const items = payload.data[name];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        await upsert(name, item);
      }
    }

    await refreshAll();
    showToast('Data imported successfully', 'success');
    renderPage();
  } catch (err) {
    console.error('Import failed:', err);
    showToast('Import failed: ' + err.message, 'error');
  }
}

/* ============================================================
   UTILITY
   ============================================================ */

function getIpPrefix(ipRange) {
  if (!ipRange) return '';
  const parts = ipRange.split('/')[0].split('.');
  return parts.length >= 3 ? parts.slice(0, 3).join('.') + '.' : '';
}

function getEffectiveFields(type, item) {
  const cfg           = ENTITY[type];
  const base          = cfg.fields || [];
  const proto         = cfg.protocolFields?.[item?.networkType] || [];
  const classF        = cfg.classFields?.[item?.assetClass] || [];
  const subclassF     = cfg.subclassFields?.[item?.assetSubclass] || [];
  const cardTypeF     = cfg.cardTypeFields?.[item?.cardType] || [];
  const linkedNetType = state.refs?.networks?.[item?.networkId]?.networkType;
  const networkTypeF  = type === 'assets' ? (cfg.networkTypeFields?.[linkedNetType] || []) : [];
  return [...base, ...proto, ...classF, ...subclassF, ...cardTypeF, ...networkTypeF];
}

function calcCompleteness(type, item) {
  const cfg = ENTITY[type];
  let total = 0, filled = 0;
  for (const f of getEffectiveFields(type, item)) {
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
    if (state.page === 'plc') {
      openSheet('assets', null, { field: 'assetClass', value: 'PLC' });
    } else if (state.page !== 'home') {
      openSheet(state.page);
    }
  });

  // Form save / cancel
  el.formSave.addEventListener('click', saveForm);
  el.formCancel.addEventListener('click', closeSheet);

  // Backdrop tap closes sheet
  el.backdrop.addEventListener('click', closeSheet);

  // Hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    if (ENTITY[hash] || hash === 'home' || hash === 'plc') {
      if (hash !== state.page) navigate(hash);
    }
  });

  // Import file input
  $('import-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) {
      await processImportFile(file);
      e.target.value = '';
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
    const startPage = (ENTITY[hash] || hash === 'home' || hash === 'plc') ? hash : 'home';
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
    el.innerHTML = `<span>Install blueprint</span>
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
