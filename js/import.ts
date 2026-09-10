import type { DbRecord } from './db.js';
import type { EntityType } from './entity-config.js';

import { getAll, getById, setSetting, upsert } from './db.js';
import { ASSIGN_STORE_MAP, ENTITY } from './entity-config.js';
import { confirm, refreshAll, showToast } from './state.js';
import { renumberSlots } from './utils.js';
import { renderPage } from './app.js';
import { REF_FIELD_MAP, prettifyKey } from './export.js';
// XLSX Import Module for Blueprint App
// Merges data from an exported Excel file back into the database.
// Records not present in the file are left untouched (merge, not replace).
//
// Dependencies: XLSX library, export.js (REF_FIELD_MAP, ENTITY, prettifyKey,
//               getFieldLabel, findFieldDef), db.js, app.js (el, confirm,
//               refreshAll, renderPage, showToast, ASSIGN_STORE_MAP)

export type NameToIdMaps = Record<EntityType, Map<string, string>>;
export type IdExistsSets = Record<EntityType, Set<string>>;
export type ImportStats = { updated: number, added: number, errors: number };

export const KNOWN_SHEET_NAMES: Set<string> = new Set([
  'Areas', 'Panels', 'Power', 'Safety', 'Networks',
  'Network Switch', 'Switch Networks', 'Switch Ports',
  'PLC', 'PLC Slots', 'HMI', 'HMI Network Ports',
  'Field Device', 'Field Device Parameters', 'Field Device Network Ports',
  'Power Wiring', 'Field Device Wiring',
  'Checklist',
]);

// Two-phase import strategy:
// 1. Load current data and build nameToId resolution maps (area/panel/network names → ids).
// 2. Merge sheets in dependency order: areas → panels → networks → assets → sub-data.
//    Records are matched by name; missing records are created, existing ones are updated.
export async function processXlsxImport(file: File): Promise<void> {
  try {
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX library is not loaded');
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    if (!wb.SheetNames.some((n: string) => KNOWN_SHEET_NAMES.has(n))) {
      showToast('Invalid file: no recognisable Blueprint sheets found', 'error');
      return;
    }

    const ok = await confirm(
      'Merge Excel data?',
      'Existing records will be updated with values from the file. Records not in the file will not be deleted.',
      { yesLabel: 'Merge', yesClass: 'btn-primary' }
    );
    if (!ok) return;

    // Load current data to build resolution maps
    const [areas, panels, power, safety, networks, assets] = await Promise.all([
      getAll('areas'), getAll('panels'), getAll('power'),
      getAll('safety'), getAll('networks'), getAll('assets'),
    ]);

    const nameToId: NameToIdMaps = {
      areas:    buildNameMap(areas),
      panels:   buildNameMap(panels),
      power:    buildNameMap(power),
      safety:   buildNameMap(safety),
      networks: buildNameMap(networks),
      assets:   buildNameMap(assets),
    };
    const idExists: IdExistsSets = {
      areas:    new Set(areas.map(a => a.id)) as Set<string>,
      panels:   new Set(panels.map(p => p.id)) as Set<string>,
      power:    new Set(power.map(p => p.id)) as Set<string>,
      safety:   new Set(safety.map(s => s.id)) as Set<string>,
      networks: new Set(networks.map(n => n.id)) as Set<string>,
      assets:   new Set(assets.map(a => a.id)) as Set<string>,
    };

    const stats: ImportStats = { updated: 0, added: 0, errors: 0 };

    await importEntitySheets(wb, nameToId, idExists, stats);
    await importAssetSheets(wb, nameToId, idExists, stats);
    await importSubdataSheets(wb, nameToId, idExists);
    await importChecklistSheet(wb);

    await refreshAll();
    renderPage();

    const msg = `Imported: ${stats.updated} updated, ${stats.added} added` +
      (stats.errors ? `, ${stats.errors} skipped` : '');
    showToast(msg, 'success');

  } catch (err) {
    console.error('XLSX import failed:', err);
    showToast('Import failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
  }
}

// ---------------------------------------------------------------------------
// Entity sheet import (Areas, Panels, Power, Safety, Networks)
// ---------------------------------------------------------------------------

export const ENTITY_SHEET_DEFS: { sheetName: string, store: EntityType }[] = [
  { sheetName: 'Areas',    store: 'areas' },
  { sheetName: 'Panels',   store: 'panels' },
  { sheetName: 'Power',    store: 'power' },
  { sheetName: 'Safety',   store: 'safety' },
  { sheetName: 'Networks', store: 'networks' },
];

export async function importEntitySheets(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets, stats: ImportStats): Promise<void> {
  for (const { sheetName, store } of ENTITY_SHEET_DEFS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headerMap = buildImportHeaderMap(store);

    for (const row of rows) {
      if (isPlaceholderRow(row)) continue;
      try {
        const item = mapRowToItem(row, headerMap, nameToId, idExists);
        if (!item.name && !item.id) continue;
        await mergeUpsert(store, item, idExists[store], stats);
      } catch (e) {
        console.warn(`Import error in ${sheetName}:`, e);
        stats.errors++;
      }
    }

    // Refresh maps so downstream sheets can resolve refs added in this pass
    const refreshed = await getAll(store);
    nameToId[store] = buildNameMap(refreshed);
    idExists[store] = new Set(refreshed.map(i => i.id)) as Set<string>;
  }
}

// ---------------------------------------------------------------------------
// Asset class sheet import (one sheet per asset class)
// ---------------------------------------------------------------------------

export const ASSET_CLASS_SHEET_DEFS: { sheetName: string, assetClass: string }[] = [
  { sheetName: 'Network Switch', assetClass: 'Network Switch' },
  { sheetName: 'PLC',            assetClass: 'PLC' },
  { sheetName: 'HMI',            assetClass: 'HMI' },
  { sheetName: 'Field Device', assetClass: 'Field Device' },
];

export async function importAssetSheets(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets, stats: ImportStats): Promise<void> {
  for (const { sheetName, assetClass } of ASSET_CLASS_SHEET_DEFS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    // See ENTITY.assets.classSubdataKeys (entity-config.js) — these array-valued
    // keys are managed by a dedicated sub-data sheet, so preserve them from the
    // existing record rather than expecting them in this sheet's columns.
    const excludeKeys = ENTITY.assets.classSubdataKeys?.[assetClass] || [];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headerMap = buildImportHeaderMap('assets', assetClass, excludeKeys);

    for (const row of rows) {
      if (isPlaceholderRow(row)) continue;
      try {
        const item = mapRowToItem(row, headerMap, nameToId, idExists);
        if (!item.name && !item.id) continue;

        // Carry over existing sub-arrays that this sheet doesn't manage
        if (item.id && idExists.assets.has(item.id)) {
          const existing = await getById('assets', item.id);
          if (existing) {
            for (const key of excludeKeys) {
              if (existing[key] !== undefined) item[key] = existing[key];
            }
          }
        }

        await mergeUpsert('assets', item, idExists.assets, stats);
      } catch (e) {
        console.warn(`Import error in ${sheetName}:`, e);
        stats.errors++;
      }
    }
  }

  // Refresh asset maps so sub-data sheets can resolve newly-added asset names/IDs
  const refreshed = await getAll('assets');
  nameToId.assets = buildNameMap(refreshed);
  idExists.assets = new Set(refreshed.map(i => i.id)) as Set<string>;
}

// ---------------------------------------------------------------------------
// Sub-data sheet import (Switch Networks, Switch Ports, PLC Slots, Field Device Parameters)
// ---------------------------------------------------------------------------

export async function importChecklistSheet(wb: any): Promise<void> {
  const ws = wb.Sheets['Checklist'];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
  const customItems = rows
    .filter((r: any) => r[1] === 'Custom')
    .map((r: any) => {
      const item: { id: string, label: string, completed: boolean, notes?: string } =
        { id: crypto.randomUUID(), label: String(r[0] ?? '').trim(), completed: r[2] === 'Complete' };
      // Column 6 (index 6) is Notes — absent in older exports, so guard with nullish coalesce
      const notes = String(r[6] ?? '').trim();
      if (notes) item.notes = notes;
      return item;
    })
    .filter((i: any) => i.label);
  if (customItems.length) await setSetting('checklistItems', customItems);
}

export async function importSubdataSheets(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  await importSwitchNetworksSheet(wb, nameToId, idExists);
  await importSwitchPortsSheet(wb, nameToId, idExists);
  await importPlcSlotsSheet(wb, nameToId, idExists);
  await importFieldDeviceParametersSheet(wb, nameToId, idExists);
  await importAssetNetworkPortsSheet(wb, 'Field Device Network Ports', nameToId, idExists);
  await importAssetNetworkPortsSheet(wb, 'HMI Network Ports', nameToId, idExists);
  await importPowerWiringSheet(wb, nameToId, idExists);
  await importAssetWiringSheet(wb, 'Field Device Wiring',  'fieldDeviceWiring', nameToId, idExists);
}

export async function importSwitchNetworksSheet(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets['Switch Networks'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.switchNetworks = assetRows
      .map(row => ({
        networkId: resolveRefId(str(row['Network ID']), str(row['Network Name']), 'networks', nameToId, idExists) || '',
      }))
      .filter(sn => sn.networkId);
    await upsert('assets', asset);
  }
}

export async function importSwitchPortsSheet(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets['Switch Ports'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.switchPorts = assetRows.map(row => ({
      portName:  str(row['Port Name']),
      networkId: resolveRefId(str(row['Network ID']), str(row['Network Name']), 'networks', nameToId, idExists) || '',
      assetId:   resolveRefId(str(row['Connected Asset ID']), str(row['Connected Asset Name']), 'assets', nameToId, idExists) || '',
    }));
    await upsert('assets', asset);
  }
}

// Imports the flat "Field Device Network Ports" / "HMI Network Ports" sheets into
// asset.networkPorts — one row per port, grouped by parent asset. Unlike PLC's
// slot-nested networkPorts (deserialized from a JSON blob column since slots are
// nested inside the PLC asset), these ports live directly on the asset, like
// switchPorts, so a flat sheet is this data's actual round-trip source of truth.
export async function importAssetNetworkPortsSheet(wb: any, sheetName: string, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.networkPorts = assetRows.map(row => {
      const port: { portNumber?: number, networkId: string, ipAddress?: string, subnetMask?: string, gateway?: string, nodeAddress?: string } = {
        portNumber: row['Port #'] !== '' ? Number(row['Port #']) : undefined,
        networkId:  resolveRefId(str(row['Network ID']), str(row['Network Name']), 'networks', nameToId, idExists) || '',
      };
      if (str(row['IP Address']))  port.ipAddress  = str(row['IP Address']);
      if (str(row['Subnet Mask'])) port.subnetMask = str(row['Subnet Mask']);
      if (str(row['Gateway']))     port.gateway    = str(row['Gateway']);
      if (str(row['Node Address'])) port.nodeAddress = str(row['Node Address']);
      return port;
    });
    await upsert('assets', asset);
  }
}

export async function importPlcSlotsSheet(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets['PLC Slots'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    // Rows are read in sheet order (= original slot order). Renumber after mapping
    // so slotNumber always equals array index, filling any gaps from pre-change exports.
    asset.slots = renumberSlots(assetRows.map(row => {
      let ioPoints: any[]       = [];
      let powerBus: any[]       = [];
      let terminalWiring: any[] = [];
      let networkPorts: any[]   = [];
      try { ioPoints       = row['IO Points']            ? JSON.parse(row['IO Points'])            : []; } catch {}
      try { powerBus       = row['Power Bus']            ? JSON.parse(row['Power Bus'])            : []; } catch {}
      try { terminalWiring = row['Terminal Block Wiring'] ? JSON.parse(row['Terminal Block Wiring']) : []; } catch {}
      try { networkPorts   = row['Network Ports']        ? JSON.parse(row['Network Ports'])        : []; } catch {}
      return {
        slotNumber:      0, // placeholder — renumberSlots overwrites this immediately
        name:            str(row['Name']),
        cardType:        str(row['Card Type']),
        partNumber:      str(row['Part Number']),
        firmwareVersion: str(row['Firmware Version']),
        ioPointCount:    str(row['IO Point Count']),
        voltageLevel:    str(row['Voltage']),
        // networkId, protocol, ipAddress, nodeAddress removed — per-port address details
        // are deserialized from the Network Ports JSON column via networkPorts above.
        ioPoints,
        powerBus,
        terminalWiring,
        networkPorts,
      };
    }));
    await upsert('assets', asset);
  }
}

export async function importFieldDeviceParametersSheet(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets['Field Device Parameters'];
  if (!ws) return;

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);

  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset.fieldDeviceParameters = assetRows
      .map(row => ({ terminal: str(row['Parameter']), label: str(row['Value']) }))
      .filter(p => p.terminal);
    await upsert('assets', asset);
  }
}

export async function importPowerWiringSheet(wb: any, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets['Power Wiring'];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Power ID', 'Power Name', nameToId, idExists, 'power');
  for (const [powerId, powerRows] of grouped) {
    const item = await getById('power', powerId);
    if (!item) continue;
    item.inputWiring = powerRows
      .filter(r => str(r['Section']) === 'Input Wiring')
      .map(r => ({ terminal: str(r['Terminal']), label: str(r['Label']) }))
      .filter(r => r.terminal || r.label);
    item.outputWiring = powerRows
      .filter(r => str(r['Section']) === 'Output Wiring')
      .map(r => ({ terminal: str(r['Terminal']), label: str(r['Label']) }))
      .filter(r => r.terminal || r.label);
    await upsert('power', item);
  }
}

export async function importAssetWiringSheet(wb: any, sheetName: string, wiringKey: string, nameToId: NameToIdMaps, idExists: IdExistsSets): Promise<void> {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const grouped = groupByParentAsset(rows, 'Asset ID', 'Asset Name', nameToId, idExists);
  for (const [assetId, assetRows] of grouped) {
    const asset = await getById('assets', assetId);
    if (!asset) continue;
    asset[wiringKey] = assetRows
      .map(r => ({ terminal: str(r['Terminal']), label: str(r['Label']) }))
      .filter(r => r.terminal || r.label);
    await upsert('assets', asset);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildNameMap(items: DbRecord[]): Map<string, string> {
  const map = new Map();
  for (const item of items) {
    if (item.name) map.set(item.name.trim().toLowerCase(), item.id as string);
  }
  return map;
}

export function resolveRefId(rawId: string, name: string, store: EntityType, nameToId: NameToIdMaps, idExists: IdExistsSets): string | null {
  if (rawId && idExists[store]?.has(rawId)) return rawId;
  if (name) {
    const found = nameToId[store]?.get(name.trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

export function groupByParentAsset(rows: any[], idCol: string, nameCol: string, nameToId: NameToIdMaps, idExists: IdExistsSets, store: EntityType = 'assets'): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    if (isPlaceholderRow(row)) continue;
    const id = resolveRefId(str(row[idCol]), str(row[nameCol]), store, nameToId, idExists);
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    (grouped.get(id) as any[]).push(row);
  }
  return grouped;
}

export function isPlaceholderRow(row: Record<string, any>): boolean {
  const vals = Object.values(row);
  if (!vals.length) return true;
  if (vals.every(v => v === '' || v == null)) return true;
  const first = String(vals[0] ?? '').trim();
  if (first === 'No records') return true;
  return false;
}

// Build a header-label → { key, isRawId } map for a given store/class.
// Uses the same ENTITY field definitions and prettifyKey as the exporter so
// the mapping stays in sync automatically.
export function buildImportHeaderMap(store: EntityType, assetClass: string | null = null, excludeKeys: string[] = []): Record<string, { key: string, isRawId?: boolean }> {
  const excludeSet = new Set(excludeKeys);
  const entity = ENTITY[store];
  if (!entity) return {};

  const map: Record<string, { key: string, isRawId?: boolean }> = {};

  // Common auto-fields not in ENTITY.fields
  for (const key of ['id', 'createdAt', 'updatedAt']) {
    if (excludeSet.has(key)) continue;
    map[prettifyKey(key)] = { key };
  }
  // assignedTo pair
  if (!excludeSet.has('assignedToType')) map[prettifyKey('assignedToType')] = { key: 'assignedToType' };
  if (!excludeSet.has('assignedToId')) {
    map['Assigned To'] = { key: 'assignedToId' };
    map['Assigned To ID'] = { key: 'assignedToId', isRawId: true };
  }

  // Collect all relevant field definition sets
  const fieldSets = [entity.fields || []];
  if (store === 'assets') {
    if (assetClass) {
      fieldSets.push(entity.classFields?.[assetClass] || []);
      const subclasses = entity.classSubclasses?.[assetClass] || [];
      subclasses.forEach(sub => fieldSets.push(entity.subclassFields?.[sub] || []));
      Object.values(entity.networkTypeFields || {}).forEach(f => fieldSets.push(f));
    } else {
      Object.values(entity.classFields || {}).forEach(f => fieldSets.push(f));
      Object.values(entity.subclassFields || {}).forEach(f => fieldSets.push(f));
      Object.values(entity.networkTypeFields || {}).forEach(f => fieldSets.push(f));
    }
  }
  if (store === 'networks') {
    Object.values(entity.protocolFields || {}).forEach(f => fieldSets.push(f));
  }

  for (const fieldDefs of fieldSets) {
    for (const fd of fieldDefs) {
      if (excludeSet.has(fd.key)) continue;
      if (!map[fd.label]) map[fd.label] = { key: fd.key };

      const isRef = (fd.type === 'ref' ? fd.refStore : undefined) || REF_FIELD_MAP[fd.key];
      if (isRef) {
        const idLabel = fd.label + ' ID';
        if (!map[idLabel]) map[idLabel] = { key: fd.key, isRawId: true };
      }
    }
  }

  return map;
}

// Convert a sheet row (keys = column headers) into a plain field-key object.
// Ref fields are resolved via resolveRefId using the dual name+rawId columns.
export function mapRowToItem(row: Record<string, any>, headerMap: Record<string, { key: string, isRawId?: boolean }>, nameToId: NameToIdMaps, idExists: IdExistsSets): Record<string, any> {
  const refAccum: Record<string, { name?: string, rawId?: string }> = {}; // key → { name, rawId }
  const item: Record<string, any> = {};

  for (const [colHeader, value] of Object.entries(row)) {
    const spec = headerMap[colHeader];
    if (!spec) continue;
    const { key, isRawId } = spec;

    if (isRawId) {
      if (!refAccum[key]) refAccum[key] = {};
      refAccum[key].rawId = str(value);
    } else if (REF_FIELD_MAP[key] || key === 'assignedToId') {
      if (!refAccum[key]) refAccum[key] = {};
      refAccum[key].name = str(value);
    } else {
      // Every non-ref field reachable here comes from an ENTITY field def of type
      // 'text' | 'textarea' | 'enum' (see buildImportHeaderMap) — i.e. always scalar,
      // never an array/object. Previously this speculatively JSON.parse'd any cell
      // string that merely looked array/object-like ("[...]"/"{...}"), which could
      // silently turn ordinary hand-typed text (e.g. a note starting with "[TODO]")
      // into an unintended array/object if it happened to also be valid JSON. The
      // structured sub-data fields that genuinely are arrays/objects (slot IO points,
      // power bus, switch ports/networks, etc.) are excluded from this generic field
      // set entirely (see ENTITY.assets.classSubdataKeys / excludeSet) and parsed explicitly,
      // with their own try/catch, at their own dedicated call sites — so no field
      // reaching this branch should ever need re-hydrating from a JSON string.
      item[key] = value;
    }
  }

  // Resolve ref fields
  for (const [key, { name = '', rawId = '' }] of Object.entries(refAccum)) {
    let refStore: EntityType | null | undefined = REF_FIELD_MAP[key];
    if (key === 'assignedToId') {
      refStore = (ASSIGN_STORE_MAP as Record<string, EntityType | null>)[item.assignedToType || ''] || null;
    }
    if (refStore) {
      item[key] = resolveRefId(rawId, name, refStore, nameToId, idExists) || '';
    } else {
      item[key] = rawId || name || '';
    }
  }

  return item;
}

// Upsert with merge semantics:
//   known id  → load existing record, overwrite only fields present in item
//   unknown id → insert as new (drop unrecognised id so db.js generates one)
export async function mergeUpsert(store: EntityType, item: Record<string, any>, idSet: Set<string>, stats: ImportStats): Promise<void> {
  const itemId = str(item.id);

  if (itemId && idSet.has(itemId)) {
    const existing = await getById(store, itemId) || {};
    const merged: Record<string, any> = { ...existing };
    for (const [k, v] of Object.entries(item)) {
      if (k === 'id' || k === 'createdAt') continue;
      if (v !== undefined) merged[k] = v;
    }
    await upsert(store, merged);
    stats.updated++;
  } else {
    // New record — drop id if it was unrecognised, require a name
    if (itemId && !idSet.has(itemId)) delete item.id;
    if (!item.name) { stats.errors++; return; }
    await upsert(store, item);
    stats.added++;
  }
}

export function str(value: any): string {
  return String(value ?? '').trim();
}

(window as any).processXlsxImport = processXlsxImport;
