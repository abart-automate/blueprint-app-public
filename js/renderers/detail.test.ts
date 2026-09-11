import { describe, it, expect, beforeEach } from 'vitest';

/**
 * detail.js's import graph (via operations.js -> export.js/import.js) does a
 * top-level `(window as any).exportToZip = ...` assignment used to expose those
 * functions for the export-progress iframe's fallback path — harmless outside a
 * real browser, but it means simply importing detail.js throws ReferenceError
 * under vitest's default (DOM-free, no jsdom/happy-dom installed) "node"
 * environment. That's the only thing standing between buildDetailItem/
 * validateDetailItem/buildSlotDetailItem (genuinely pure, DOM-free logic, in
 * the spirit of this repo's own testing convention) and being testable, so a
 * minimal `window = {}` stand-in — not a real DOM, just enough for that one
 * property assignment to succeed — is set up here before the dynamic import.
 */
(globalThis as any).window = (globalThis as any).window ?? {};

const { state } = await import('../state.js');
const {
  buildDetailItem,
  validateDetailItem,
  buildSlotDetailItem,
  buildEntityEditSnapshot,
  buildSlotEditSnapshot,
} = await import('./detail.js');

function resetDetailEditState(): void {
  state.detailChanges          = {};
  state.detailItemTables       = {};
  state.detailSwitchNetworks   = [];
  state.detailSwitchPorts      = [];
  state.detailAssetNetworkPorts = [];
  state.detailSlotIoPoints     = [];
  state.detailSlotPowerBus     = [];
  state.detailSlotNetworkPorts = [];
  state.cache.assets = [];
}

describe('buildDetailItem (pure builder — B2)', () => {
  beforeEach(resetDetailEditState);

  it('merges state.detailChanges over the stored item', () => {
    const item = { id: 'a1', name: 'Old Name', assetClass: 'Field Device' };
    state.detailChanges = { name: 'New Name' };
    const built = buildDetailItem('assets', item);
    expect(built.name).toBe('New Name');
    expect(built.id).toBe('a1'); // untouched fields survive
  });

  it('strips the internal _switchDirty/_netPortsDirty sentinels', () => {
    const item = { id: 'a1', name: 'Sw1' };
    state.detailChanges = { name: 'Sw1', _switchDirty: true, _netPortsDirty: true };
    const built = buildDetailItem('assets', item);
    expect(built).not.toHaveProperty('_switchDirty');
    expect(built).not.toHaveProperty('_netPortsDirty');
  });

  it('writes every state.detailItemTables entry onto the item', () => {
    const item = { id: 'p1', name: 'Panel Device' };
    state.detailItemTables = { inputWiring: [{ terminal: '1', label: 'X' }] };
    const built = buildDetailItem('assets', item);
    expect(built.inputWiring).toEqual([{ terminal: '1', label: 'X' }]);
  });

  it('for a managed switch asset, filters switchNetworks/switchPorts down to non-blank rows', () => {
    const item = { id: 'sw1', name: 'Switch1', assetClass: 'Network Switch', assetSubclass: 'Managed' };
    state.detailSwitchNetworks = [{ networkId: 'net1' }, { networkId: '' }];
    state.detailSwitchPorts    = [{ portName: 'P1' }, {}];
    const built = buildDetailItem('assets', item);
    expect(built.switchNetworks).toEqual([{ networkId: 'net1' }]);
    expect(built.switchPorts).toEqual([{ portName: 'P1' }]);
  });

  it('for a Field Device/HMI asset class, writes networkPorts and clears legacy scalar network fields', () => {
    const item = {
      id: 'fd1', name: 'FD1', assetClass: 'Field Device',
      networkId: 'legacyNet', ipAddress: '10.0.0.5', subnetMask: '255.255.255.0',
    };
    state.detailAssetNetworkPorts = [{ portNumber: 1, networkId: 'net2', ipAddress: '10.0.0.9' }];
    const built = buildDetailItem('assets', item);
    expect(built.networkPorts).toEqual([{ portNumber: 1, networkId: 'net2', ipAddress: '10.0.0.9' }]);
    expect(built.networkId).toBeUndefined();
    expect(built.ipAddress).toBeUndefined();
    expect(built.subnetMask).toBeUndefined();
  });

  it('never touches images/namedPhotos — media commits separately via persistDetailMedia', () => {
    const item = { id: 'a1', name: 'A', images: ['existing'] };
    state.detailChanges = { name: 'A2' };
    const built = buildDetailItem('assets', item);
    expect(built.images).toEqual(['existing']);
  });
});

describe('validateDetailItem (pure validator — B2/B3, reuses operations.js validators)', () => {
  beforeEach(resetDetailEditState);

  it('passes a valid item with no conflicts', () => {
    state.cache.assets = [{ id: 'a1', name: 'A1' }];
    const result = validateDetailItem('assets', { id: 'a1', name: 'A1', assetClass: 'Field Device' });
    expect(result.ok).toBe(true);
  });

  it('flags a required field left empty (name) as kind "required"', () => {
    const result = validateDetailItem('areas', { id: 'ar1', name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('required');
      expect(result.field?.key).toBe('name');
    }
  });

  it('flags a duplicate name as kind "conflict", pointing at the name field', () => {
    state.cache.areas = [{ id: 'ar1', name: 'North Wing' }];
    const result = validateDetailItem('areas', { id: 'ar2', name: 'North Wing' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('conflict');
      expect(result.field?.key).toBe('name');
      expect(result.message).toMatch(/already in use/i);
    }
  });

  it('flags a duplicate IP on an asset as kind "conflict" (validateUniqueIp reused from operations.js)', () => {
    state.cache.assets = [{ id: 'a1', name: 'A1', ipAddress: '10.0.0.5', networkId: 'net1' }];
    const result = validateDetailItem('assets', {
      id: 'a2', name: 'A2', assetClass: 'Field Device', ipAddress: '10.0.0.5', networkId: 'net1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('conflict');
      expect(result.message).toMatch(/already used by/i);
    }
  });
});

describe('buildSlotDetailItem (pure builder for PLC slot cards — B2)', () => {
  beforeEach(resetDetailEditState);

  it('returns null when the slot number is not found on the rack', () => {
    const rack = { id: 'r1', slots: [{ slotNumber: 0, cardType: 'Controller' }] };
    expect(buildSlotDetailItem(rack, 5)).toBeNull();
  });

  it('merges state.detailChanges over the target slot and leaves other slots untouched', () => {
    const rack = {
      id: 'r1',
      slots: [
        { slotNumber: 0, cardType: 'Controller', name: 'Slot0' },
        { slotNumber: 1, cardType: 'Digital', name: 'Slot1' },
      ],
    };
    state.detailChanges = { name: 'Renamed' };
    const result = buildSlotDetailItem(rack, 1);
    expect(result).not.toBeNull();
    expect(result?.updatedSlot.name).toBe('Renamed');
    expect(result?.slots[0]).toBe(rack.slots[0]); // untouched slot reference preserved
    expect(result?.slots[1].name).toBe('Renamed');
  });

  it('strips the internal dirty sentinels from the updated slot', () => {
    const rack = { id: 'r1', slots: [{ slotNumber: 0, cardType: 'Controller' }] };
    state.detailChanges = { _ioDirty: true, _pbDirty: true, _termWiringDirty: true, _netPortsDirty: true };
    const result = buildSlotDetailItem(rack, 0);
    expect(result?.updatedSlot).not.toHaveProperty('_ioDirty');
    expect(result?.updatedSlot).not.toHaveProperty('_pbDirty');
    expect(result?.updatedSlot).not.toHaveProperty('_termWiringDirty');
    expect(result?.updatedSlot).not.toHaveProperty('_netPortsDirty');
  });

  it('for an IO card type, resizes ioPoints to ioPointCount and filters powerBus to rows with a refId', () => {
    const rack = { id: 'r1', slots: [{ slotNumber: 0, cardType: 'Digital', ioPointCount: 2 }] };
    state.detailChanges = {};
    state.detailSlotIoPoints = [{ label: 'A' }];
    state.detailSlotPowerBus = [{ type: 'Power', refId: 'p1' }, { type: 'Power', refId: '' }];
    const result = buildSlotDetailItem(rack, 0);
    expect(result?.updatedSlot.ioPoints).toHaveLength(2);
    expect(result?.updatedSlot.ioPoints[0]).toEqual({ label: 'A' });
    expect(result?.updatedSlot.ioPoints[1]).toEqual({ label: 'Spare', signalType: '', wiringType: '' });
    expect(result?.updatedSlot.powerBus).toEqual([{ type: 'Power', refId: 'p1' }]);
  });

  it('for a Controller/Communication card, writes networkPorts and clears legacy card-level network fields', () => {
    const rack = {
      id: 'r1',
      slots: [{ slotNumber: 0, cardType: 'Controller', networkId: 'legacy', ipAddress: '10.0.0.1' }],
    };
    state.detailSlotNetworkPorts = [{ portNumber: 1, networkId: 'net1' }];
    const result = buildSlotDetailItem(rack, 0);
    expect(result?.updatedSlot.networkPorts).toEqual([{ portNumber: 1, networkId: 'net1' }]);
    expect(result?.updatedSlot.networkId).toBeUndefined();
    expect(result?.updatedSlot.ipAddress).toBeUndefined();
  });
});

describe('buildEntityEditSnapshot / buildSlotEditSnapshot (undo-history allowlist — B4/Risk 7)', () => {
  it('includes the record\'s own fields but never images/namedPhotos', () => {
    const item = {
      id: 'ar1', name: 'North Wing', notes: 'hi',
      images: ['blob-a'], namedPhotos: { Nameplate: ['blob-b'] },
    };
    const snap = buildEntityEditSnapshot('areas', item);
    expect(snap.name).toBe('North Wing');
    expect(snap).not.toHaveProperty('images');
    expect(snap).not.toHaveProperty('namedPhotos');
  });

  it('includes item-table rows as independent clones (mutating the source does not affect the snapshot)', () => {
    // 'power' is the entity type whose config actually declares an 'inputWiring' itemTable.
    const item = { id: 'p1', name: 'Device', inputWiring: [{ terminal: '1', label: 'X' }] };
    const snap = buildEntityEditSnapshot('power', item);
    (item.inputWiring[0] as any).label = 'MUTATED';
    expect(snap.inputWiring).toEqual([{ terminal: '1', label: 'X' }]);
  });

  it('includes switchNetworks/switchPorts for a managed switch asset', () => {
    const item = {
      id: 'sw1', name: 'Switch1', assetClass: 'Network Switch', assetSubclass: 'Managed',
      switchNetworks: [{ networkId: 'net1' }], switchPorts: [{ portName: 'P1' }],
    };
    const snap = buildEntityEditSnapshot('assets', item);
    expect(snap.switchNetworks).toEqual([{ networkId: 'net1' }]);
    expect(snap.switchPorts).toEqual([{ portName: 'P1' }]);
  });

  it('slot snapshot includes only the fields relevant to its card type', () => {
    const slot = {
      slotNumber: 0, cardType: 'Digital', name: 'Card1', partNumber: 'PN1', firmwareVersion: '1.0',
      ioPointCount: '2', voltageLevel: '24VDC',
      ioPoints: [{ label: 'A' }], powerBus: [{ type: 'Power', refId: 'p1', wiring: [] }],
      terminalWiring: [{ terminal: 'T1', label: 'L1' }],
    };
    const snap = buildSlotEditSnapshot(slot);
    expect(snap.name).toBe('Card1');
    expect(snap.ioPointCount).toBe('2');
    expect(snap.voltageLevel).toBe('24VDC');
    expect(snap.ioPoints).toEqual([{ label: 'A' }]);
    expect(snap.terminalWiring).toEqual([{ terminal: 'T1', label: 'L1' }]);
    expect(snap).not.toHaveProperty('networkPorts'); // Digital isn't a CARD_TYPE_NET_TYPES card
  });
});
