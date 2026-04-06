# Conventions & Idioms Review

## Scope
Recent ~1900-line change implementing hierarchical guidance across 43 files in a React + TypeScript frontend with Express + better-sqlite3 backend.

---

### Findings

#### F1: IIFE-in-JSX pattern for group rendering

- **What:** Both `LinkedGridPresets.tsx` (line 146) and `GridPresetsTab.tsx` (line 418) use an IIFE `(() => { ... })()` inside JSX to compute intermediate variables (e.g., `groupedIndices`, `ungrouped`) and then return JSX. This is non-idiomatic React -- the standard approach is to extract a sub-component or compute derived values before the return statement.
- **Where:** `src/components/admin/LinkedGridPresets.tsx:146-232`, `src/components/admin/GridPresetsTab.tsx:418-495`
- **Why it matters:** IIFEs inside JSX are harder to read, cannot be individually memoized, break the standard React rendering mental model, and make the render function monolithic. They also break the convention used elsewhere in this codebase where sub-components are extracted for complex rendering logic.
- **Suggested alternative:** Extract a `<GroupedGuidanceEditor>` sub-component that receives the relevant data as props and handles its own grouping logic. Alternatively, compute `groupedIndices` and `ungrouped` with `useMemo` before the return statement, then use simple `.map()` calls in JSX.

---

#### F2: `CharacterPreset.rowGuidance` is a dead field

- **What:** `CharacterPreset` in `AppContext.tsx` (line 69) still defines `rowGuidance: string`, and the `AppState.character` type (line 134) also carries `rowGuidance: string`. The hierarchical guidance system replaced this with `overallGuidance`, `groupGuidance`, and `cellGuidance`. The backend (`server/presetTables.js`) no longer has a `row_guidance` column for character presets. Similarly, `defaultContent` in `UnifiedConfigPanel.tsx` (line 80) still includes `rowGuidance: ''`.
- **Where:** `src/context/AppContext.tsx:69,134`, `src/components/config/UnifiedConfigPanel.tsx:80`, `src/types/api.ts:24` (HistoryResponse still references `rowGuidance`)
- **Why it matters:** Frontend types are out of sync with the backend schema. The field is carried around in state but never written or read by the new guidance system. This creates confusion for anyone reading the types to understand the data model, and could cause subtle bugs if code paths try to use the old field.
- **Suggested alternative:** Remove `rowGuidance` from `CharacterPreset`, `AppState.character`, `UnifiedConfigPanel` defaults, and `HistoryResponse.content`. If backward compatibility with old history entries is needed, handle it in the API layer mapping, not in the type definitions.

---

#### F3: Inconsistent naming between old per-type guidance fields and new unified guidance

- **What:** The `AppState` types for building, terrain, and background retain their old single-string guidance fields (`cellGuidance: string`, `tileGuidance: string`, `layerGuidance: string`) while the preset system and prompt builders now use `HierarchicalGuidance` objects (`overallGuidance: string`, `groupGuidance: Record<string, string>`, `cellGuidance: Record<string, string>`). The name `cellGuidance` is used for two different shapes: a `string` in `AppState.building` and a `Record<string, string>` in `GridPreset`, `ContentPreset`, and `PRESET_TABLES`.
- **Where:** `src/context/AppContext.tsx:81,92,104,143,153,163` vs `src/context/AppContext.tsx:19,39` and `src/types/api.ts:72`
- **Why it matters:** Having `cellGuidance` mean a flat string in one context and a `Record<string, string>` in another is a naming collision that defeats TypeScript's ability to catch misuse. A developer could pass the wrong shape without a type error if the context is loosely typed (as happens with `Record<string, unknown>` in `GenericPresetsTab`).
- **Suggested alternative:** Rename the legacy flat-string fields to `legacyCellGuidance` (or remove them if unused) and ensure `cellGuidance` consistently means `Record<string, string>` throughout.

---

#### F4: Pervasive `as any` casts in UnifiedConfigPanel

- **What:** `UnifiedConfigPanel.tsx` uses 12 `as any` casts (lines 229-237, 262-287) to access fields like `gridSize`, `cellLabels`, and `bgMode` on `content` which is typed as `Record<string, unknown>`.
- **Where:** `src/components/config/UnifiedConfigPanel.tsx:229-237,262-287`
- **Why it matters:** This defeats TypeScript's type safety entirely. The generic `Record<string, unknown>` typing of `content` combined with `as any` means the compiler cannot catch field name typos or shape mismatches. This is fighting the type system rather than using it.
- **Suggested alternative:** Define a per-sprite-type content interface (or a discriminated union) and narrow `content` properly. At minimum, use a typed helper like `getField<T>(content, key): T` with runtime validation rather than raw `as any`.

---

#### F5: `setCellGroupCells` has a stale closure risk due to `updateCellGroup` not being memoized

- **What:** In `GridPresetsTab.tsx`, `setCellGroupCells` is wrapped in `useCallback` with `[editing, updateCellGroup]` as dependencies (line 182). However, `updateCellGroup` (line 165) is a plain function declaration (not wrapped in `useCallback`), so it creates a new reference on every render, making the `useCallback` on `setCellGroupCells` effectively useless -- it will always produce a new function.
- **Where:** `src/components/admin/GridPresetsTab.tsx:165-176,178-182`
- **Why it matters:** The `useCallback` creates a false sense of stability. Every render creates a new `updateCellGroup` -> new `setCellGroupCells` -> new callback prop to `CellRangeSelector`, defeating memoization. This is a React hooks anti-pattern.
- **Suggested alternative:** Either wrap `updateCellGroup` in `useCallback` too, or remove the `useCallback` from `setCellGroupCells` since it provides no benefit in its current form. Better yet, use a state updater function pattern: `setEditing(prev => ...)` which avoids the stale closure entirely.

---

#### F6: Inconsistent `confirm()` vs `window.confirm()` usage

- **What:** The admin components (`GenericPresetsTab.tsx:163`, `GridPresetsTab.tsx:130`, `LinkedGridPresets.tsx:55`) call bare `confirm()`, while the main app components (`UnifiedConfigPanel.tsx:360`, `GalleryPage.tsx:148`, `AppHeader.tsx:55`) use `window.confirm()`.
- **Where:** Listed above
- **Why it matters:** While functionally equivalent in browsers, bare `confirm()` triggers ESLint's `no-restricted-globals` rule in many React configurations and creates inconsistency. In a strict TypeScript setup or testing environment, `confirm` without `window.` can be flagged or undefined.
- **Suggested alternative:** Standardize on `window.confirm()` throughout, or better yet, use a shared confirmation dialog component for consistent UX.

---

#### F7: `field-sizing: content` is a non-standard CSS property with limited browser support

- **What:** `admin.css` line 200 uses `field-sizing: content` on `.admin-textarea`.
- **Where:** `src/styles/admin.css:200`
- **Why it matters:** `field-sizing: content` is a CSS property that only became available in Chrome 123+ (March 2024) and Firefox 132+ (late 2024). Safari does not support it as of early 2026. There is no fallback. Users on older browsers or Safari will not get auto-sizing textareas, but also won't get a visible error -- the property is simply ignored, and the `min-height: 2.5rem` provides a baseline.
- **Suggested alternative:** Add a comment documenting the progressive-enhancement intent, or add a JS-based auto-resize fallback for broader support. If Safari support matters, consider a `textarea` auto-resize hook.

---

#### F8: Redundant `as const` assertions on inline string literals

- **What:** In `GenericPresetsTab.tsx`, the field config objects use `type: 'guidance-pairs' as const` (lines 43, 44, 56, 57, 68, 69, 85, 86). Since the `FieldSchema` interface already constrains `type` to the union `'input' | 'textarea' | 'select' | 'guidance-pairs'`, the `as const` is unnecessary.
- **Where:** `src/components/admin/GenericPresetsTab.tsx:43-44,56-57,68-69,85-86`
- **Why it matters:** Minor noise. The `as const` was likely added during development to narrow the type before the `FieldSchema` interface was finalized. It's harmless but adds visual clutter.
- **Suggested alternative:** Remove the `as const` assertions since the `FieldSchema` type already handles the narrowing. Use `satisfies PresetTabConfig` on the config objects if additional type checking is desired.

---

#### F9: Inline styles mixed with CSS class system in admin components

- **What:** `LinkedGridPresets.tsx` uses 6 inline `style={}` attributes (e.g., lines 93, 129, 155, 158, 205) for layout properties like `marginLeft`, `marginBottom`, `fontSize`, and `cursor`. These same kinds of styles are handled by CSS classes elsewhere in the admin components (e.g., `.admin-subsection-title` in `GridPresetsTab`).
- **Where:** `src/components/admin/LinkedGridPresets.tsx:93,129,155,158,205`, `src/components/admin/GenericPresetsTab.tsx:253-254,273`
- **Why it matters:** Mixing inline styles with a CSS class system creates two places to look when debugging layout issues and makes it harder to maintain visual consistency. The same patterns (e.g., accordion summary styling) are done with CSS classes in `GridPresetsTab` but with inline styles in `LinkedGridPresets`.
- **Suggested alternative:** Add CSS classes like `.admin-subsection`, `.admin-subsection-title` (which already exist per GridPresetsTab usage) and apply them consistently in `LinkedGridPresets` too.

---

#### F10: `GenericPresetsTab` uses `Record<string, unknown>` instead of typed preset objects

- **What:** The component stores presets and editing state as `Record<string, unknown>[]` and `Record<string, unknown> | null` (lines 101-102), then uses string-key access with `as string` and `as number` casts throughout.
- **Where:** `src/components/admin/GenericPresetsTab.tsx:101-102,209,213,248,299,325`
- **Why it matters:** This is the "stringly-typed" anti-pattern in TypeScript. The entire purpose of TypeScript is lost when the primary data structure is `Record<string, unknown>`. Field access is unchecked, and any typo in a field key (e.g., `editing.colour` instead of `editing.colorNotes`) would silently return `undefined`.
- **Suggested alternative:** Define a `BasePreset` interface with common fields (`id`, `name`, `genre`, `overallGuidance`, `groupGuidance`, `cellGuidance`) and use a generic parameter `GenericPresetsTab<T extends BasePreset>` to maintain type safety while keeping the config-driven approach.

---

#### F11: `decomposeGuidance.js` uses ESM `export` syntax but is untyped JavaScript

- **What:** The seed utility `decomposeGuidance.js` uses `export function` (ESM syntax) but has no TypeScript types. The function signature `decomposeGuidanceBlob(blob, renameMap = {})` has no type annotations, and the return type `{ overall, groups, cells }` matches the `HierarchicalGuidance` interface on the frontend but is not formally connected.
- **Where:** `server/db/seeds/decomposeGuidance.js:13-56`
- **Why it matters:** The function produces objects that must match `HierarchicalGuidance` on the frontend, but there is no compile-time check ensuring they stay in sync. If someone adds a field to `HierarchicalGuidance`, this file would silently produce incompatible objects. The regex parsing (`cellHeaderRegex` on line 23) is also complex enough that type annotations on the internal state would aid comprehension.
- **Suggested alternative:** Either convert to TypeScript (`.ts`) or add JSDoc type annotations that reference the shared `HierarchicalGuidance` shape. At minimum, add a `@returns {{ overall: string, groups: Record<string, string>, cells: Record<string, string> }}` JSDoc.

---

#### F12: Duplicated group-rendering logic across three files

- **What:** The pattern of computing `groupedIndices`, filtering `ungrouped` cells, and rendering group/cell guidance textareas is implemented three times with slight variations: in `LinkedGridPresets.tsx` (lines 146-232), `GridPresetsTab.tsx` (lines 418-495), and `GenericPresetsTab.tsx` (lines 247-292, as key-value pairs). Each has its own copy of the `groupedIndices = new Set(cellGroups.flatMap(g => g.cells))` computation and the ungrouped-cells filter.
- **Where:** All three admin component files listed above
- **Why it matters:** This violates DRY and means bug fixes or UX changes to group-cell rendering must be applied in three places. The slight differences between implementations (e.g., `LinkedGridPresets` uses inline styles while `GridPresetsTab` uses CSS classes for the same UI) suggest they've already drifted.
- **Suggested alternative:** Extract a shared `<GuidanceEditor>` component that accepts `cellGroups`, `cellLabels`, `cols`, and the current guidance values, and exposes `onChange` callbacks. Each consumer passes different props but gets consistent rendering.

---

#### F13: Unused `_rows` parameter in `buildGridFillPrompt`

- **What:** `buildGridFillPrompt` accepts `_rows: number` (line 28 in `promptBuilder.ts`) but never uses it. The underscore prefix indicates intentional disuse.
- **Where:** `src/lib/promptBuilder.ts:28`
- **Why it matters:** Low severity, but unused parameters in public API functions are a code smell. The `buildGridFillPromptWithReference` wrapper does pass `rows` through, suggesting the parameter was kept for API symmetry with other builders.
- **Suggested alternative:** If the parameter exists for API consistency across all prompt builders, document that with a comment. Otherwise, remove it and adjust callers.

---

### Summary

The hierarchical guidance implementation introduces a well-structured data model (`HierarchicalGuidance` type, `buildGuidanceBlock` utility, data-driven `PRESET_TABLES`) but leaves significant type-safety gaps where the old and new systems intersect. The most impactful issues are the `rowGuidance` dead field creating a false data model, the `cellGuidance` naming collision (string vs Record), and the pervasive `as any` / `Record<string, unknown>` patterns that prevent TypeScript from catching field mismatches. The IIFE-in-JSX and triplicated group-rendering logic are React anti-patterns that will impede maintainability as the guidance UI evolves.
