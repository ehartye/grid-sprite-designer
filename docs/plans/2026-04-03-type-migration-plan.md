# Type Migration, Config Safety & GuidanceAccordion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Eliminate stale preset types, add config type safety, and extract the duplicated accordion UI — completing the hierarchical guidance migration cleanup.

**Architecture:** Discriminated union `AnyPreset` replaces 4+1 competing type systems. Named config objects replace positional tuples. Shared `<GuidanceAccordion>` replaces 160+ lines of triplicated IIFE-in-JSX.

**Tech Stack:** TypeScript, React, Express, better-sqlite3

---

## Batch 1: Foundation (must land first)

### Task 1: Export EMPTY_GUIDANCE from promptBuilderBase

**Files:**
- Modify: `src/lib/promptBuilderBase.ts:14` (add export)
- Modify: `src/hooks/useGridWorkflow.ts:11`
- Modify: `src/hooks/useBuildingWorkflow.ts:11`
- Modify: `src/hooks/useTerrainWorkflow.ts:11`
- Modify: `src/hooks/useBackgroundWorkflow.ts:11`
- Modify: `src/components/config/UnifiedConfigPanel.tsx:255`
- Modify: `src/lib/__tests__/promptBuilder.test.ts:6`
- Modify: `src/lib/__tests__/buildingPromptBuilder.test.ts:5`
- Modify: `src/lib/__tests__/terrainPromptBuilder.test.ts:5`
- Modify: `src/lib/__tests__/backgroundPromptBuilder.test.ts:5`

**Step 1:** Add export to promptBuilderBase.ts after the existing imports/types:

```typescript
/** Empty hierarchical guidance — no content at any level. */
export const EMPTY_GUIDANCE: HierarchicalGuidance = { overall: '', groups: {}, cells: {} };
```

**Step 2:** In each of the 9 files above, replace the local `const EMPTY_GUIDANCE` definition with:

```typescript
import { EMPTY_GUIDANCE } from '../lib/promptBuilderBase';
```

(Adjust relative path per file — test files use `../promptBuilderBase`, hooks use `../lib/promptBuilderBase`, UnifiedConfigPanel uses `../../lib/promptBuilderBase`.)

For test files that already import from `promptBuilderBase`, just add `EMPTY_GUIDANCE` to the existing import.

**Step 3:** Run `npx tsc --noEmit` — expect clean.

**Step 4:** Run `npx vitest run` — expect all passing (no behavior change).

**Step 5:** Commit:
```
fix: export EMPTY_GUIDANCE from promptBuilderBase, eliminate 9 duplicates
```

---

### Task 2: Replace preset type interfaces with discriminated union

**Files:**
- Modify: `src/context/AppContext.tsx:62-105` (replace 4 interfaces)

**Step 1:** Replace the 4 preset interfaces (lines 62-105) with:

```typescript
/** Shared fields across all content preset types */
interface PresetBase {
  id: string;
  name: string;
  genre: string;
  description: string;
  colorNotes: string;
  overallGuidance: string;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
}

export interface CharacterPreset extends PresetBase {
  spriteType: 'character';
  equipment: string;
}

export interface BuildingPreset extends PresetBase {
  spriteType: 'building';
  details: string;
  gridSize: BuildingGridSize;
  cellLabels: string[];
}

export interface TerrainPreset extends PresetBase {
  spriteType: 'terrain';
  gridSize: TerrainGridSize;
  tileLabels: string[];
}

export interface BackgroundPreset extends PresetBase {
  spriteType: 'background';
  bgMode: BackgroundMode;
  gridSize: BackgroundGridSize;
  layerLabels: string[];
}

export type AnyPreset = CharacterPreset | BuildingPreset | TerrainPreset | BackgroundPreset;
```

**Step 2:** Run `npx tsc --noEmit` — expect errors in reducer, loadGeneration, tests, UnifiedConfigPanel (old field names). This is expected — Tasks 3-5 fix them.

---

### Task 3: Update AppState content fields and initial state

**Files:**
- Modify: `src/context/AppContext.tsx:128-167` (AppState content fields)
- Modify: `src/context/AppContext.tsx:232-268` (initialState)

**Step 1:** Update the 4 AppState content fields. Replace old guidance fields with the new trio consistently:

```typescript
character: {
  name: string;
  description: string;
  equipment: string;
  colorNotes: string;
  styleNotes: string;
  overallGuidance: string;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
};

building: {
  name: string;
  description: string;
  details: string;
  colorNotes: string;
  styleNotes: string;
  overallGuidance: string;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
  gridSize: BuildingGridSize;
  cellLabels: string[];
};

terrain: {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
  overallGuidance: string;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
  gridSize: TerrainGridSize;
  cellLabels: string[];
};

background: {
  name: string;
  description: string;
  colorNotes: string;
  styleNotes: string;
  overallGuidance: string;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
  bgMode: BackgroundMode;
  gridSize: BackgroundGridSize;
  cellLabels: string[];
};
```

**Step 2:** Update `initialState` (lines 232-268) to match:
- `character.rowGuidance: ''` → `character.overallGuidance: ''` + `character.groupGuidance: {}` + `character.cellGuidance: {}`
- `building.cellGuidance: ''` → `building.overallGuidance: ''` + `building.groupGuidance: {}` + `building.cellGuidance: {}`
- `terrain.tileGuidance: ''` → `terrain.overallGuidance: ''` + `terrain.groupGuidance: {}` + `terrain.cellGuidance: {}`
- `background.layerGuidance: ''` → `background.overallGuidance: ''` + `background.groupGuidance: {}` + `background.cellGuidance: {}`

---

### Task 4: Update reducer LOAD_*_PRESET cases

**Files:**
- Modify: `src/context/AppContext.tsx:431-508` (4 LOAD_*_PRESET reducer cases)

**Step 1:** Update each LOAD case to use the new field names. The preset interfaces now have the matching fields, so this is direct mapping:

**LOAD_CHARACTER_PRESET (line 431):**
```typescript
case 'LOAD_CHARACTER_PRESET':
  return {
    ...state,
    activeContentPresetIds: { ...state.activeContentPresetIds, character: action.preset.id },
    character: {
      name: action.preset.name,
      description: action.preset.description,
      equipment: action.preset.equipment,
      colorNotes: action.preset.colorNotes,
      styleNotes: '',
      overallGuidance: action.preset.overallGuidance,
      groupGuidance: action.preset.groupGuidance,
      cellGuidance: action.preset.cellGuidance,
    },
  };
```

**LOAD_BUILDING_PRESET (line 446):** Same pattern — replace `cellGuidance: action.preset.cellGuidance` (the old string) with all three:
```typescript
overallGuidance: action.preset.overallGuidance,
groupGuidance: action.preset.groupGuidance,
cellGuidance: action.preset.cellGuidance,
```

**LOAD_TERRAIN_PRESET (line 471):** Replace `tileGuidance: action.preset.tileGuidance` with all three (same as above).

**LOAD_BACKGROUND_PRESET (line 491):** Replace `layerGuidance: action.preset.layerGuidance` with all three (same as above).

**Step 2:** Run `npx tsc --noEmit` — errors should reduce significantly. Remaining errors expected in loadGeneration.ts, UnifiedConfigPanel, tests.

---

### Task 5: Update loadGeneration.ts

**Files:**
- Modify: `src/lib/loadGeneration.ts:54-103`

**Step 1:** Update all 4 state construction blocks to use new field names:

For **building** (line 54-63): replace `cellGuidance: '',` with:
```typescript
overallGuidance: '',
groupGuidance: {},
cellGuidance: {},
```

For **terrain** (line 69-77): replace `tileGuidance: '',` with the same three fields.

For **background** (line 83-92): replace `layerGuidance: '',` with the same three fields.

For **character** (line 95-102): replace `rowGuidance: data.content.rowGuidance || '',` with:
```typescript
overallGuidance: '',
groupGuidance: {},
cellGuidance: {},
```

(Note: history restore doesn't carry guidance — these are just placeholder defaults.)

---

### Task 6: Update UnifiedConfigPanel defaultContent

**Files:**
- Modify: `src/components/config/UnifiedConfigPanel.tsx:80,103,126,147`

**Step 1:** Update the 4 `defaultContent` objects in `SPRITE_TYPE_CONFIGS`:

- Line 80 (character): `rowGuidance: ''` → `overallGuidance: '', groupGuidance: {}, cellGuidance: {}`
- Line 103 (building): `cellGuidance: ''` → `overallGuidance: '', groupGuidance: {}, cellGuidance: {}`
- Line 126 (terrain): `tileGuidance: ''` → `overallGuidance: '', groupGuidance: {}, cellGuidance: {}`
- Line 147 (background): `layerGuidance: ''` → `overallGuidance: '', groupGuidance: {}, cellGuidance: {}`

---

### Task 7: Update api.ts HistoryResponse

**Files:**
- Modify: `src/types/api.ts:18-25`

**Step 1:** In the `HistoryResponse.content` type, remove the stale `rowGuidance` field:

```typescript
content?: {
  name?: string;
  description?: string;
  equipment?: string;
  colorNotes?: string;
  styleNotes?: string;
};
```

**Step 2:** Run `npx tsc --noEmit` — expect clean compilation.

---

### Task 8: Update appReducer.test.ts

**Files:**
- Modify: `src/context/__tests__/appReducer.test.ts` (18 references to old field names)

**Step 1:** Replace all old field names in test fixtures:

- `rowGuidance: ''` → `overallGuidance: '', groupGuidance: {}, cellGuidance: {}`  (and `spriteType: 'character'` where CharacterPreset fixtures appear)
- `cellGuidance: ''` (string) → `overallGuidance: '', groupGuidance: {}, cellGuidance: {}` + `spriteType: 'building'` for BuildingPreset fixtures
- `tileGuidance: ''` → same pattern + `spriteType: 'terrain'`
- `layerGuidance: ''` → same pattern + `spriteType: 'background'`

Every preset fixture must also gain the `spriteType` discriminant field.

**Step 2:** Run `npx vitest run src/context/__tests__/appReducer.test.ts` — all passing.

**Step 3:** Run full `npx vitest run` — all passing.

**Step 4:** Commit all of Tasks 2-8 together:
```
feat: migrate preset types to discriminated union with hierarchical guidance fields
```

---

## Batch 2: Config Type Safety

### Task 9: Convert presetTables.js to named objects

**Files:**
- Modify: `server/presetTables.js`

**Step 1:** Replace tuple arrays with named objects:

```javascript
export const PRESET_TABLES = {
  character: {
    table: 'character_presets', linkTable: 'character_grid_links', fk: 'character_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'equipment', column: 'equipment', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
  building: {
    table: 'building_presets', linkTable: 'building_grid_links', fk: 'building_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'details', column: 'details', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'gridSize', column: 'grid_size', default: '3x3' },
      { field: 'cellLabels', column: 'cell_labels', default: [], json: true },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
  terrain: {
    table: 'terrain_presets', linkTable: 'terrain_grid_links', fk: 'terrain_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'gridSize', column: 'grid_size', default: '4x4' },
      { field: 'tileLabels', column: 'tile_labels', default: [], json: true },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
  background: {
    table: 'background_presets', linkTable: 'background_grid_links', fk: 'background_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'gridSize', column: 'grid_size', default: '1x4' },
      { field: 'bgMode', column: 'bg_mode', default: 'parallax' },
      { field: 'layerLabels', column: 'layer_labels', default: [], json: true },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
};
```

---

### Task 10: Update utils.js to use named properties + fix || to ??

**Files:**
- Modify: `server/utils.js:9-25`

**Step 1:** Update `extractPresetValues`:

```javascript
export function extractPresetValues(body, columns) {
  return columns.map(({ field, default: defaultVal, json }) => {
    const raw = body[field];
    if (json) return JSON.stringify(raw ?? defaultVal);
    return raw ?? defaultVal;
  });
}
```

Note: `||` → `??` fixes the empty-string coercion bug.

**Step 2:** Update `mapPresetRow`:

```javascript
export function mapPresetRow(row, columns) {
  const obj = { id: row.id };
  for (const { field, column, default: defaultVal, json } of columns) {
    obj[field] = json
      ? JSON.parse(row[column] || JSON.stringify(defaultVal ?? []))
      : (row[column] ?? defaultVal ?? '');
  }
  return obj;
}
```

**Step 3:** Check all server routes that use column configs. Search for destructuring patterns:

```bash
grep -n "columns.map\|for.*of columns\|\.columns\[" server/routes/*.js
```

Update any that use positional destructuring `[bodyField, dbCol, ...]` to named destructuring `{ field, column, ... }`.

**Step 4:** Run `npm test` — all server-side tests should pass.

**Step 5:** Commit:
```
refactor: named objects in presetTables, fix || to ?? in extractPresetValues
```

---

## Batch 3: GuidanceAccordion Extraction

### Task 11: Create GuidanceAccordion component

**Files:**
- Create: `src/components/admin/GuidanceAccordion.tsx`

**Step 1:** Create the component:

```typescript
import React, { useMemo } from 'react';
import type { CellGroup } from '../../context/AppContext';

export interface GuidanceAccordionProps {
  cellGroups: CellGroup[];
  cellLabels: string[];
  cols: number;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
  onGroupChange: (groupName: string, value: string) => void;
  onCellChange: (label: string, value: string) => void;
}

export function GuidanceAccordion({
  cellGroups, cellLabels, cols,
  groupGuidance, cellGuidance,
  onGroupChange, onCellChange,
}: GuidanceAccordionProps) {
  const ungrouped = useMemo(() => {
    const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));
    return cellLabels
      .map((label, idx) => ({ label, idx }))
      .filter(({ label, idx }) => label && !groupedIndices.has(idx));
  }, [cellGroups, cellLabels]);

  return (
    <>
      {cellGroups.map((group) => (
        <details key={group.name} className="admin-subsection">
          <summary className="admin-subsection-title" style={{ cursor: 'pointer' }}>
            {group.name}
          </summary>
          <label className="admin-label" style={{ marginTop: '0.5rem' }}>
            Group guidance
            <textarea
              className="admin-textarea"
              value={groupGuidance[group.name] || ''}
              onChange={e => onGroupChange(group.name, e.target.value)}
              placeholder={`Guidance for ${group.name} group...`}
            />
          </label>
          {group.cells.map((cellIdx) => {
            const label = cellLabels[cellIdx];
            if (!label) return null;
            const row = Math.floor(cellIdx / cols);
            const col = cellIdx % cols;
            return (
              <label key={cellIdx} className="admin-label">
                {label} ({row},{col})
                <textarea
                  className="admin-textarea"
                  value={cellGuidance[label] || ''}
                  onChange={e => onCellChange(label, e.target.value)}
                  placeholder={`Guidance for "${label}"...`}
                />
              </label>
            );
          })}
        </details>
      ))}
      {ungrouped.length > 0 && (
        <details className="admin-subsection">
          <summary className="admin-subsection-title" style={{ cursor: 'pointer' }}>
            Ungrouped cells ({ungrouped.length})
          </summary>
          {ungrouped.map(({ label, idx }) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            return (
              <label key={idx} className="admin-label">
                {label} ({row},{col})
                <textarea
                  className="admin-textarea"
                  value={cellGuidance[label] || ''}
                  onChange={e => onCellChange(label, e.target.value)}
                  placeholder={`Guidance for "${label}"...`}
                />
              </label>
            );
          })}
        </details>
      )}
    </>
  );
}
```

---

### Task 12: Replace IIFE in LinkedGridPresets with GuidanceAccordion

**Files:**
- Modify: `src/components/admin/LinkedGridPresets.tsx:146-231`

**Step 1:** Add import at the top:
```typescript
import { GuidanceAccordion } from './GuidanceAccordion';
```

**Step 2:** Replace the entire IIFE block (lines 146-231) with:

```typescript
{link.cellGroups && link.cellGroups.length > 0 && (
  <GuidanceAccordion
    cellGroups={link.cellGroups}
    cellLabels={link.cellLabels}
    cols={link.cols}
    groupGuidance={link.linkGuidance.groups}
    cellGuidance={link.linkGuidance.cells}
    onGroupChange={(groupName, value) => {
      const groups = { ...link.linkGuidance.groups, [groupName]: value };
      updateGuidance(link.id, link.linkGuidance.overall, groups, link.linkGuidance.cells, link.sortOrder);
    }}
    onCellChange={(label, value) => {
      const cells = { ...link.linkGuidance.cells, [label]: value };
      updateGuidance(link.id, link.linkGuidance.overall, link.linkGuidance.groups, cells, link.sortOrder);
    }}
  />
)}
```

**Step 3:** Also fix `confirm(` → `window.confirm(` on line 55.

---

### Task 13: Replace IIFE in GridPresetsTab with GuidanceAccordion

**Files:**
- Modify: `src/components/admin/GridPresetsTab.tsx:418-495`

**Step 1:** Add import at the top:
```typescript
import { GuidanceAccordion } from './GuidanceAccordion';
```

**Step 2:** Replace the IIFE block (lines 418-495) with:

```typescript
{editing.cellGroups && editing.cellGroups.length > 0 && (
  <GuidanceAccordion
    cellGroups={editing.cellGroups}
    cellLabels={editing.cellLabels}
    cols={editing.cols || 1}
    groupGuidance={editing.groupGuidance}
    cellGuidance={editing.cellGuidance}
    onGroupChange={(groupName, value) =>
      setEditing(prev => prev ? {
        ...prev,
        groupGuidance: { ...prev.groupGuidance, [groupName]: value },
      } : null)
    }
    onCellChange={(label, value) =>
      setEditing(prev => prev ? {
        ...prev,
        cellGuidance: { ...prev.cellGuidance, [label]: value },
      } : null)
    }
  />
)}
```

**Step 3:** Also fix `confirm(` → `window.confirm(` on line 130.

---

### Task 14: Fix confirm() in GenericPresetsTab

**Files:**
- Modify: `src/components/admin/GenericPresetsTab.tsx:163`

**Step 1:** Change `confirm(` → `window.confirm(` on line 163.

---

### Task 15: Final verification and commit

**Step 1:** Run `npx tsc --noEmit` — expect clean.

**Step 2:** Run `npx vitest run` — expect all passing.

**Step 3:** Commit:
```
refactor: extract GuidanceAccordion, fix confirm() consistency
```

**Step 4:** Run full `npm test` (includes Playwright e2e) to verify nothing regressed.
