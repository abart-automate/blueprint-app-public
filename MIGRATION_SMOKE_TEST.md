# TypeScript Migration Smoke Test

Manual verification checklist, re-run after each file's conversion (or
JSDoc-typing pass) lands. There are no automated tests for the app's UI —
see the TS migration plan's Verification section for why, and for the
narrower Vitest coverage that *does* exist for pure logic. Run this against
`npm run typecheck` passing first; this checklist is for behavior the type
checker can't see.

## Core CRUD

- [ ] Create one record of every entity type: Area, Panel, Power, Safety
      Circuit, Network, Asset.
- [ ] For Assets specifically, create one of each `assetClass` (Network
      Switch, PLC, HMI, Field Device) and, for Network Switch, one of each
      subclass (Managed, Unmanaged, Router). For PLC, add one slot of each
      `cardType`.
- [ ] Edit an existing record of each type above; confirm changes persist
      after closing and reopening its detail view.
- [ ] Delete a record of each type; confirm it's removed from its list and
      no longer appears in any parent's child list/count.

## Media

- [ ] Add a photo to a required photo slot; reload the page; confirm it's
      still there (exercises `freshenMediaItems` / IndexedDB blob re-store).
- [ ] Add an "Other Media" item (image and, separately, a video); confirm
      both display correctly and the lightbox opens for each.
- [ ] Open a record that predates the `{blob,mimeType}` media format (a
      legacy base64 `_legacySrc` item), if one exists in test data; confirm
      it still displays and can be replaced/removed.

## Export / Import

- [ ] Export to XLSX; open the file in real Excel or LibreOffice (not just
      a re-import) — confirm every sheet is present and readable.
- [ ] Export to ZIP/JSON.
- [ ] Re-import both the XLSX and the ZIP/JSON exports; confirm no
      duplicate or orphaned refs are created (check a record's ref fields
      still point at the same logical target, not a newly-minted duplicate).

## Offline / PWA

- [ ] Go offline (devtools Network tab or airplane mode) and reload; confirm
      the app shell and previously-loaded IndexedDB data still work.
- [ ] Install as a PWA; confirm it launches standalone.
- [ ] With an older version already installed, load a new build and confirm
      the "Update Now" banner appears and updates cleanly.

## Layout

- [ ] Resize the window across all three responsive tiers (mobile <768px,
      tablet 768–1199px, desktop >=1200px); confirm the layout switches
      correctly at each breakpoint and the desktop detail pane shows the
      placeholder when nothing is selected.

## Network Ports (PLC / HMI / Field Device / Switch)

- [ ] Add a network port to a PLC Controller/Communication slot; confirm it
      appears in that Network's connected-assets list.
- [ ] Add a network port to an HMI or Field Device asset; same check.
- [ ] Confirm a Network Switch's port device picker offers PLC
      Controller/Communication slots, HMIs, and Field Devices as selectable
      devices.
