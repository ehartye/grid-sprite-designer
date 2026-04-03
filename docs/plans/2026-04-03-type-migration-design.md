# Type Migration, Config Type Safety & GuidanceAccordion Extraction

Post-review cleanup of the hierarchical guidance migration. Three workstreams
addressing stale types, untyped config patterns, and duplicated UI.

## Workstream 1: Type Migration

### Problem

The 4 preset interfaces in `AppContext.tsx` still reference old field names
(`rowGuidance`, `cellGuidance` as string, `tileGuidance`, `layerGuidance`).
The server already returns `overallGuidance`, `groupGuidance: Record`,
`cellGuidance: Record`. The reducer silently drops guidance on preset load.

### Design

Introduce a `PresetBase` with shared fields and a discriminated union:

```typescript
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

interface CharacterPreset extends PresetBase { spriteType: 'character'; equipment: string; }
interface BuildingPreset extends PresetBase { spriteType: 'building'; details: string; gridSize: BuildingGridSize; cellLabels: string[]; }
interface TerrainPreset extends PresetBase { spriteType: 'terrain'; gridSize: TerrainGridSize; tileLabels: string[]; }
interface BackgroundPreset extends PresetBase { spriteType: 'background'; gridSize: BackgroundGridSize; bgMode: BackgroundMode; layerLabels: string[]; }

type AnyPreset = CharacterPreset | BuildingPreset | TerrainPreset | BackgroundPreset;
```

AppState content fields mirror the same `overallGuidance` / `groupGuidance` /
`cellGuidance` names consistently. Reducer LOAD_*_PRESET cases map directly.
`ContentPreset` in `api.ts` is aligned or replaced by `AnyPreset`.

### Files

- `AppContext.tsx` — interfaces, AppState type, reducer, initial state
- `api.ts` — align or remove ContentPreset
- `loadGeneration.ts` — use new field names
- `UnifiedConfigPanel.tsx` — remove `as any` casts
- `appReducer.test.ts` — update test fixtures

---

## Workstream 2: Config Type Safety

### Problem

`presetTables.js` uses positional tuple arrays `['bodyField', 'dbCol', default, isJson?]`.
`GenericPresetsTab` uses `Record<string, unknown>` with no type checking.

### Design

**Server:** Named objects replace tuples.

```javascript
// Before: ['overallGuidance', 'overall_guidance', '', false]
// After:
{ field: 'overallGuidance', column: 'overall_guidance', default: '', json: false }
```

`extractPresetValues` and `mapPresetRow` use `.field`, `.column`, `.default`, `.json`.

**Client:** `GenericPresetsTab` config declares which `AnyPreset` variant it handles:

```typescript
interface PresetTypeConfig<T extends AnyPreset> {
  spriteType: T['spriteType'];
  label: string;
  emptyDefaults: Omit<T, 'id' | 'spriteType'> & { styleNotes: string };
  fields: FieldSchema[];
}
```

`editing` state typed as `Partial<T>` instead of `Record<string, unknown>`.

### Files

- `server/presetTables.js` — tuple arrays to named objects
- `server/utils.js` — named property destructuring, `||` to `??`
- `GenericPresetsTab.tsx` — typed config
- `UnifiedConfigPanel.tsx` — remove remaining `as any` casts

---

## Workstream 3: GuidanceAccordion Extraction

### Problem

~160 lines of near-identical IIFE-in-JSX accordion code in `LinkedGridPresets.tsx`
and `GridPresetsTab.tsx`. Same grouped/ungrouped logic, same `<details>/<summary>`
structure, different callbacks.

### Design

New `<GuidanceAccordion>` component:

```typescript
interface GuidanceAccordionProps {
  cellGroups: CellGroup[];
  cellLabels: string[];
  cols: number;
  groupGuidance: Record<string, string>;
  cellGuidance: Record<string, string>;
  onGroupChange: (groupName: string, value: string) => void;
  onCellChange: (label: string, value: string) => void;
}
```

Handles grouped/ungrouped computation, `<details>/<summary>` per group,
nested cell textareas with `(row,col)` labels. Standardize on `admin-subsection`
CSS classes.

`GenericPresetsTab` keeps its guidance-pairs editor (different UI pattern).

### Files

- New: `src/components/admin/GuidanceAccordion.tsx`
- `LinkedGridPresets.tsx` — replace IIFE with `<GuidanceAccordion>`
- `GridPresetsTab.tsx` — replace IIFE with `<GuidanceAccordion>`

---

## Bonus Fixes (one-liners in files we're already touching)

- Export `EMPTY_GUIDANCE` from `promptBuilderBase.ts` — eliminates 9 duplicates
- `||` to `??` in `extractPresetValues` — fixes empty string coercion
- `confirm()` to `window.confirm()` — consistency in admin components
