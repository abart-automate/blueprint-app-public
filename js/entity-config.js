/* ============================================================
   ENTITY CONFIGURATION
   Single source of truth for all entity schemas, field
   definitions, and shared field/icon constants.
   ============================================================ */

/* ---- PARTS LIBRARY CONSTANTS ---- */
const PART_IO_TYPES      = ['Input', 'Output', 'Combo', 'N/A'];
const PART_SIGNAL_RANGES = ['4-20mA', '0-20mA', '0-10V', '1-5V', 'RTD', 'Thermocouple', 'Other'];
const PART_PLATFORMS     = ['1769', '1768', '5069', '1756', '1734', 'Other'];
const PART_ISOLATION     = ['Non-isolated', 'Isolated', 'Individually-isolated', 'N/A'];
const PART_CARD_TYPES    = ['Controller', 'Analog', 'Digital', 'Communication', 'Specialty', 'Motion'];

/* ---- SHARED FIELD ARRAYS ---- */
const PHYS_SIZE_FIELDS = [
  { key: 'physH', label: 'Height (in)', type: 'text', section: 'Physical Sizing' },
  { key: 'physW', label: 'Width (in)',  type: 'text', section: 'Physical Sizing' },
  { key: 'physD', label: 'Depth (in)', type: 'text', section: 'Physical Sizing' },
];
const CLEARANCE_FIELDS = [
  { key: 'clrTop',    label: 'Top (in)',    type: 'text', section: 'Clearance' },
  { key: 'clrBottom', label: 'Bottom (in)', type: 'text', section: 'Clearance' },
  { key: 'clrFront',  label: 'Front (in)',  type: 'text', section: 'Clearance' },
  { key: 'clrBack',   label: 'Back (in)',   type: 'text', section: 'Clearance' },
  { key: 'clrLeft',   label: 'Left (in)',   type: 'text', section: 'Clearance' },
  { key: 'clrRight',  label: 'Right (in)',  type: 'text', section: 'Clearance' },
];

const SERIAL_FIELDS = [
  { key: 'protocol', label: 'Protocol',   type: 'enum', options: ['RS232','RS422','RS485','Modbus RTU','Other'], required: true },
  { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Serial Configuration',
    options: ['1200','2400','4800','9600','19200','38400','57600','115200'] },
  { key: 'dataBits', label: 'Data Bits', type: 'enum', section: 'Serial Configuration', options: ['7','8'] },
  { key: 'parity',   label: 'Parity',    type: 'enum', section: 'Serial Configuration', options: ['None','Even','Odd'] },
  { key: 'stopBits', label: 'Stop Bits', type: 'enum', section: 'Serial Configuration', options: ['1','2'] },
];

const PLC_CARD_TYPE_FIELDS = {
  // Network connectivity for Controller/Communication is handled per-port via
  // networkPorts[]. Card-level networkId and address fields have been removed.
  Controller:    [],
  Analog:        [{ key: 'ioPointCount', label: 'IO Point Count', type: 'text' }],
  Digital:       [{ key: 'ioPointCount', label: 'IO Point Count', type: 'text' },
                  { key: 'voltageLevel', label: 'Voltage',  type: 'enum',
                    options: ['24VDC','120VAC','240VAC'] }],
  Communication: [],
  Specialty:     [],
};

// Card type classification sets — used across form, detail, and operations to
// decide which sub-panels (IO points/power bus vs. network address) to show.
const CARD_TYPE_IO_TYPES       = new Set(['Analog', 'Digital']);
const CARD_TYPE_NET_TYPES      = new Set(['Controller', 'Communication']);
// Specialty is included here because it has physical terminals even though it
// has no IO points or power bus of its own.
const CARD_TYPE_TERMINAL_TYPES = new Set(['Analog', 'Digital', 'Specialty']);

/* ---- ICON SVG CONSTANTS ---- */
const ICON_RM      = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_TRASH   = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const ICON_BACK    = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const ICON_EDIT    = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_PLUS    = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_CHEVRON = `<svg class="det-toggle-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const ICON_CHECK   = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
const ICON_CIRCLE  = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
// Notes/attachments indicator for checklist detail toggle
const ICON_NOTE      = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
// Duplicate/copy icon — shared between the entity "Duplicate" button and the slot duplicate action
const ICON_DUPLICATE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
// Drag-handle grip (6-dot) for drag-to-reorder slot rows
const ICON_GRIP      = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`;
// Plain up/down chevrons — no embedded class so they work as generic action button icons
const ICON_CHEVRON_UP   = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

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
      { key: 'areaId',      label: 'Area',             type: 'ref',      refStore: 'areas', filterChip: true },
      { key: 'location',    label: 'Location',         type: 'text' },
      { key: 'manufacturer',label: 'Manufacturer',     type: 'text' },
      { key: 'description', label: 'Description',      type: 'textarea' },
      // Nameplate Data
      { key: 'voltageLevel', label: 'Voltage',  type: 'enum', section: 'Nameplate Data',
                    options: ['24VDC','120VAC','240VAC', '480VAC','600VAC'] },
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
      { key: 'bpH', label: 'Backpanel Height', type: 'text', section: 'Backpanel Sizing' },
      { key: 'bpW', label: 'Backpanel Width',  type: 'text', section: 'Backpanel Sizing' },
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
    itemTables: [
      { key: 'inputWiring',  label: 'Input Wiring'  },
      { key: 'outputWiring', label: 'Output Wiring' },
    ],
    fields: [
      { key: 'name',         label: 'Name',         type: 'text',     required: true },
      { key: 'panelId',      label: 'Panel',        type: 'ref',      refStore: 'panels', filterChip: true },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'partNumber',   label: 'Part Number',  type: 'text' },
      { key: 'description',  label: 'Description',  type: 'textarea' },
      { key: 'drawingRef', label: 'Drawing Reference', type: 'text'},
      ...PHYS_SIZE_FIELDS,
      ...CLEARANCE_FIELDS,
      // Input Power
      { key: 'inVoltage',           label: 'Voltage',            type: 'enum',                      section: 'Input Power',
        options: ['24VDC','120VAC','240VAC', '480VAC','600VAC','Other'],},
      { key: 'inAmperage',          label: 'Amperage',           type: 'text',                       section: 'Input Power' },
      { key: 'inPhase',             label: 'Phase',              type: 'enum', options: ['1', '3'],  section: 'Input Power' },
      { key: 'inCircuitProtection', label: 'Circuit Protection', type: 'text',                       section: 'Input Power' },
      // Output Power
      { key: 'outVoltage',  label: 'Voltage',  type: 'enum',                      section: 'Output Power',
        options: ['5VDC','24VDC','24VAC','120VAC','240VAC', '480VAC','600VAC', 'Other'],},
      { key: 'outAmperage', label: 'Amperage', type: 'text',                      section: 'Output Power' },
      { key: 'outPhase',    label: 'Phase',    type: 'enum', options: ['1', '3'], section: 'Output Power' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.panels?.[item.panelId]?.name || '—',
    getChildren: [
      { label: 'Safety Circuits', store: 'safety', field: 'powerId' },
      { label: 'Assets', store: 'assets', field: 'powerId',
        countFn: (all, id) => all.filter(a => a.powerId === id || (a.assetClass === 'PLC' && a.slots?.some(s => s.powerBus?.some(pb => pb.type === 'Power' && pb.refId === id)))).length },
    ],
  },

  safety: {
    label: 'Safety Circuit', plural: 'Safety Circuits', store: 'safety',
    color: '#dc2626', bgColor: '#fee2e2', badgeClass: 'badge-safety',
    fields: [
      { key: 'name',           label: 'Name',             type: 'text',     required: true },
      { key: 'panelId',        label: 'Panel',            type: 'ref',      refStore: 'panels', filterChip: true },
      { key: 'powerId',        label: 'Power (optional)', type: 'ref',      refStore: 'power',   required: false },
      { key: 'safetyCategory', label: 'Safety Category',  type: 'enum',     options: ['CAT B','CAT 1','CAT 2','CAT 3','CAT 4','PLa','PLb','PLc','PLd','PLe','SIL 1','SIL 2','SIL 3'] },
      { key: 'description',    label: 'Description',      type: 'textarea' },
      { key: 'drawingRef', label: 'Drawing Reference', type: 'text'},
      { key: 'notes',          label: 'Notes',            type: 'textarea' },
    ],
    getSubtitle: (item, refs) => refs?.panels?.[item.panelId]?.name || '—',
    getChildren: [
      { label: 'Assets', store: 'assets', field: 'safetyId',
        countFn: (all, id) => all.filter(a => a.safetyId === id || (a.assetClass === 'PLC' && a.slots?.some(s => s.powerBus?.some(pb => pb.type === 'Safety Circuit' && pb.refId === id)))).length },
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
      'ControlNet': [],
      'DeviceNet': [
        { key: 'powerId', label: 'Power Supply', type: 'ref', refStore: 'power', section: 'Network Configuration' },
        { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Network Configuration',
          options: ['125K','250K','500K'] },
      ],
      'DH+': [
        { key: 'dhChannel', label: 'Channel', type: 'enum', section: 'Network Configuration',
          options: ['A','B'] },
        { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Network Configuration',
          options: ['57.6K','115.2K','230.4K'] },
      ],
      'Remote-IO': [
        { key: 'baudRate', label: 'Baud Rate', type: 'enum', section: 'Network Configuration',
          options: ['57.6K','115.2K','230.4K'] },
      ],
      'Serial': SERIAL_FIELDS,
    },
    getSubtitle: (item, refs) => {
      const panel = item.panelId ? refs?.panels?.[item.panelId]?.name : null;
      const area  = item.areaId  ? refs?.areas?.[item.areaId]?.name  : null;
      if (panel && area) return `${area} / ${panel}`;
      return panel || area || 'Plant-wide';
    },
    getChildren: [
      { label: 'Assets', store: 'assets', field: 'networkId',
        countFn: (all, id) => all.filter(a => a.networkId === id || a.switchNetworks?.some(sn => sn.networkId === id) || (a.assetClass === 'PLC' && a.slots?.some(s => CARD_TYPE_NET_TYPES.has(s.cardType) && s.networkPorts?.some(p => p.networkId === id)))).length },
    ],
  },

  assets: {
    label: 'Asset', plural: 'Assets', store: 'assets',
    color: '#475569', bgColor: '#f1f5f9', badgeClass: 'badge-asset',
    requiredPhotoSlots: ['Device Front', 'Part Number'],
    fields: [
      { key: 'name',          label: 'Name',          type: 'text', required: true },
      { key: 'assetClass',    label: 'Device Class',  type: 'enum', options: ['Network Switch','PLC','HMI','Device'], required: true, enumFilterChip: true },
      { key: 'assetSubclass', label: 'Subtype',       type: 'enum', options: [] },
      { key: 'areaId',       label: 'Area',         type: 'ref',  refStore: 'areas' },
      { key: 'panelId',       label: 'Panel',         type: 'ref',  refStore: 'panels' },
      { key: 'powerId',        label: 'Power', type: 'ref',      refStore: 'power'},
      { key: 'manufacturer',  label: 'Manufacturer',  type: 'text' },
      { key: 'partNumber',    label: 'Part Number',   type: 'text' },
      { key: 'description',   label: 'Description',   type: 'textarea' },
      { key: 'drawingRef', label: 'Drawing Reference', type: 'text'},
      ...PHYS_SIZE_FIELDS,
      ...CLEARANCE_FIELDS,
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    getSubtitle: item => {
      if (!item.assetClass) return '';
      return item.assetSubclass ? `${item.assetClass} — ${item.assetSubclass}` : item.assetClass;
    },
    networkTypeFields: {
      'Ethernet': [
        { key: 'ipAddress',  label: 'IP Address',  type: 'text', section: 'Network Address' },
        { key: 'subnetMask', label: 'Subnet Mask', type: 'text', section: 'Network Address' },
        { key: 'gateway',    label: 'Gateway',     type: 'text', section: 'Network Address' },
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
      'DH+': [
        { key: 'nodeAddress', label: 'Node Address', type: 'text', section: 'Network Address' },
      ],
      'Remote-IO': [
        { key: 'nodeAddress', label: 'Node Address', type: 'text', section: 'Network Address' },
      ],
    },
    cardTypeFields: PLC_CARD_TYPE_FIELDS,
    classFields: {
      // PLC slots are managed dynamically via the Add Slot / reorder / duplicate controls
      // in the detail panel — no fixed slot count field is needed.
      'PLC': [],
      'HMI': [
        { key: 'networkId', label: 'Network', type: 'ref', refStore: 'networks' },
      ],
      'Device': [
        { key: 'safetyId',  label: 'Safety Circuit', type: 'ref', refStore: 'safety' },
        { key: 'networkId', label: 'Network',         type: 'ref', refStore: 'networks' },
      ],
    },
    classItemTables: {
      'Device': [
        { key: 'deviceWiring', label: 'Wiring',      placeholder1: 'Terminal',  placeholder2: 'Label' },
        { key: 'parameters',   label: 'Parameters',  placeholder1: 'Parameter', placeholder2: 'Value' },
      ],
    },
    subclassChildren: {},
    classSubclasses: {
      'Network Switch': ['Managed', 'Unmanaged', 'Router'],
      'PLC':            [],
      'HMI':            [],
    },
    subclassFields: {
      Managed: [
        { key: 'macAddress',      label: 'MAC Address',      type: 'text', section: 'Switch Details' },
        { key: 'firmwareVersion', label: 'Firmware Version', type: 'text', section: 'Switch Details' },
      ],
      Unmanaged: [
        { key: 'macAddress',      label: 'MAC Address',      type: 'text', section: 'Switch Details' },
        { key: 'firmwareVersion', label: 'Firmware Version', type: 'text', section: 'Switch Details' },
      ],
      Router: [
        { key: 'macAddress',      label: 'MAC Address',      type: 'text', section: 'Router Details' },
        { key: 'firmwareVersion', label: 'Firmware Version', type: 'text', section: 'Router Details' },
      ],
    },
    getChildren: [],
  },
};

const ASSIGN_STORE_MAP = {
  Plant: null,
  Area: 'areas',
  Panel: 'panels',
  Power: 'power',
  'Safety Circuit': 'safety',
  Network: 'networks',
};
