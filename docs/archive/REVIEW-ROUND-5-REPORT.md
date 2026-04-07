# Review Round 5 Report

## Executive Summary

The Grid Sprite Designer codebase is in a **mid-refactor state**: the workflow layer has been successfully consolidated into config-driven patterns (`useGenericWorkflow`, `WORKFLOW_CONFIGS`, `SPRITE_TYPE_CONFIGS`), but the admin UI, database schema, reducer action naming, prompt builders, and state management have not caught up. The absence of a CI pipeline with type checking or linting means all identified issues -- from unsafe type casts to silent state corruption -- have **no automated detection path**. The root cause across all four review domains is the same: incremental sprite type addition without a centralized registration contract or validation layer.

---

## 1. Scalability & Extensibility (scale-reviewer)

### Finding S1 -- CRITICAL: No Central Sprite Type Registry

**Files**: `src/context/AppContext.tsx:13`, `src/lib/promptForType.ts:41`, `src/lib/loadGeneration.ts:39-97`, `src/components/gallery/GalleryPage.tsx:35`, `src/components/admin/AdminPage.tsx:16`, `server/index.js:139`

Adding a 5th sprite type requires **15+ coordinated changes** across the codebase. The `SpriteType` union is a closed string literal type with no central registry driving type system, gallery filters, admin tabs, DB validation, UI controls, and prompt dispatch. Good config-driven patterns exist (`WORKFLOW_CONFIGS` at `useGenericWorkflow.ts:314`, `SPRITE_TYPE_CONFIGS` at `UnifiedConfigPanel.tsx:62`, `PRESET_TABLES` at `server/index.js:129-163`) but they are islands -- no single `SPRITE_TYPE_REGISTRY` connects them.

### Finding S2 -- HIGH: Admin Preset Tabs Are 4 Near-Identical CRUD Components

**Files**: `CharacterPresetsTab.tsx` (~185 lines), `BuildingPresetsTab.tsx` (~192 lines), `TerrainPresetsTab.tsx` (~185 lines), `BackgroundPresetsTab.tsx` (~195 lines)

Each has identical `useState` shape, identical `fetchPresets`/`handleNew`/`handleEdit`/`handleSave`/`handleDelete` handlers, identical JSX structure, and identical `window.alert()` error handling. Total: ~740 lines of near-identical code. The workflow hooks underwent this same consolidation (from 4x ~215-line hooks to 4x ~33-line wrappers around `useGenericWorkflow`) but the admin layer was not refactored.

### Finding S3 -- HIGH: Database Schema Non-Extensibility (8 Tables for 4 Types)

**File**: `server/db.js:81-196`

4 separate content preset tables + 4 separate junction tables for a single logical relationship. Compare to the `generations` table which correctly uses a `sprite_type TEXT` discriminator. Most egregious: `server/index.js:307-311` sums 4 separate COUNT subqueries across all link tables. Adding a type requires a new table, new links table, new seed function, and updating the compound query. Schema inconsistency: `grid_presets.sprite_type` has a CHECK constraint, `generations.sprite_type` does not.

### Finding S4 -- MEDIUM: `loadGeneration.ts` Type-Specific If/Else Chains

**File**: `src/lib/loadGeneration.ts:39-97`, `137-160`

Two separate 4-way if/else chains for loading a generation into state. No fallback dispatcher or type handler registry. Each new sprite type requires 2 coordinated additions in this file alone.

### Finding S5 -- MEDIUM: `promptForType.ts` Non-Extensible Switch Dispatch

**File**: `src/lib/promptForType.ts:41-129`

90-line switch statement that manually constructs type-specific config and calls the appropriate prompt builder. The fix is partially present -- `WORKFLOW_CONFIGS` already captures `buildPrompt` as a callback -- but `promptForType.ts` re-implements the branching separately.

### Positive: Extension Points That Already Work

- `useGenericWorkflow.ts` + `WORKFLOW_CONFIGS` (lines 305-319): adding a new type = one config object entry
- `SPRITE_TYPE_CONFIGS` in `UnifiedConfigPanel.tsx` (lines 62-154): data-driven UI config
- `PRESET_TABLES` in `server/index.js` (lines 129-163): config-driven server CRUD
- `gridConfig.ts:245-279`: generic `getTemplateParams` fallback for arbitrary grid sizes

---

## 2. Code Consistency & Convention Adherence (consistency-reviewer)

### Finding C1 -- MEDIUM: Character Preset Action Naming Inconsistency

**Files**: `AppContext.tsx:287-313`, `UnifiedConfigPanel.tsx:62-153`

Character uses `SET_PRESETS` / `LOAD_PRESET` / `presets` state key. All other types use `SET_BUILDING_PRESETS` / `LOAD_BUILDING_PRESET` / `buildingPresets` etc. Character's fetch URL (`/api/presets`, no `?type=character` filter) is a latent bug: if the server stops defaulting to character, mixed-type presets would silently corrupt state. This naming asymmetry forces the 4x `as any` casts in Finding C5.

### Finding C2 -- HIGH: Admin Preset Tabs Are Copy-Paste CRUD

**Files**: `CharacterPresetsTab.tsx`, `BuildingPresetsTab.tsx`, `TerrainPresetsTab.tsx`, `BackgroundPresetsTab.tsx`

(Confirms and reinforces scale-reviewer's Finding S2.) All 4 tabs use `window.alert()` for errors instead of the app's `SET_STATUS` dispatch system. The workflow hook refactor (`useGenericWorkflow`) proves the pattern works -- the admin layer is the unfinished half of the same refactor.

### Finding C3 -- MEDIUM: Prompt Builder Guidance Fallback Asymmetry

**Files**: `promptBuilder.ts:168`, `buildingPromptBuilder.ts:54`, `terrainPromptBuilder.ts:49`, `backgroundPromptBuilder.ts:52`

Character falls back to `GENERIC_ROW_GUIDANCE` (a 700-line hardcoded 6x6 layout) when `gridGenericGuidance` is absent. Building/terrain/background fall back to `''` (empty string). This means non-character prompts can be semantically incomplete with no error, leading to misplaced sprites in the generated image. Variable naming also diverges: `charBlock`/`characterGuidance` vs `descBlock`/`customGuidance`.

### Finding C4 -- LOW: `promptForType.ts` Duplicated Reference Prefix

**Files**: `promptForType.ts:14-22`, `promptBuilder.ts:234-243`

Two implementations of reference prefix logic. The `promptForType.ts` version hardcodes "character" in the description string even when used for non-character types.

### Finding C5 -- MEDIUM: `as any` Casts in UnifiedConfigPanel

**File**: `UnifiedConfigPanel.tsx:183, 207, 233, 238`

4 `as any` casts bypass the reducer's discriminated union Action type. These are a direct symptom of Finding C1's naming asymmetry. If action types were normalized, a proper discriminated union approach would work without escape hatches.

---

## 3. Data Integrity & State Correctness (integrity-reviewer)

### Finding I1 -- HIGH: `step`/`run` Invariant Not Enforced; Dead `RunState.active`

**Files**: `src/context/AppContext.tsx:101-112, :478-519`; `src/App.tsx:59-70`

`WorkflowStep` and `RunState.active` are redundant signals that can diverge. `SET_STEP` (line 387-388) changes step independently with no guard -- `SET_STEP: 'run-active'` when `state.run === null` is accepted. `RunState.active` is always `true` when set and never toggled -- it is dead state (all guards check `run !== null` instead). The `isGeneratingRef` in `useRunWorkflow.ts:33` has a benign race between `cancelRun` and the `finally` block.

### Finding I2 -- HIGH: Stale `activeGridConfig` Contaminates Re-extraction Across Sprite Types

**Files**: `src/context/AppContext.tsx:169-175, :344-355`; `src/hooks/useGenericWorkflow.ts:257-283`; `src/hooks/useGridWorkflow.ts:25-29`

`activeGridConfig` has no `spriteType` ownership tag and is never cleared on `SET_SPRITE_TYPE`. Concrete scenario: generate a 4x4 terrain grid, switch to character, press "Re-extract Sprites" -- the character 6x6 image is sliced into 16 cells instead of 36. The root cause is that `activeGridConfig` is untagged shared state that outlives sprite type transitions. Similarly, `filledGridImage`, `templateImage`, `sprites`, and `historyId` are all untagged shared state.

### Finding I3 -- MEDIUM-HIGH: Unvalidated Type Casts from Server at Deserialization Boundary

**Files**: `src/lib/loadGeneration.ts:54, 63, 72`; `src/context/AppContext.tsx:410-428, 435-451, 455-472`; `src/types/api.ts:12`

`data.gridSize` (typed as `string | undefined`) is cast to `BuildingGridSize`, `TerrainGridSize`, `BackgroundGridSize` without runtime validation. If the value is unrecognized, `BUILDING_GRIDS[gridSize]` returns `undefined` and `.totalCells` throws an uncaught TypeError. No `zod` or equivalent runtime validation exists at any API response boundary. The `generations.sprite_type` column lacks a CHECK constraint, so invalid values can be persisted and read back through these unchecked casts.

### Finding I4 -- MEDIUM: `displayOrder` Swap/Erase Pixel Ownership Invariant

**Files**: `src/hooks/useSpriteSelection.ts:58-73, :88-99`

`erasedPixels` keys are source cell indices, but `zoomSpriteIndex` is a display slot index. If the zoom modal stays open during a swap (possible via keyboard/programmatic dispatch), erasures apply to the wrong sprite. Currently latent because the zoom modal closes before swaps in normal flow, but the invariant is undocumented and unenforced.

### Finding I5 -- MEDIUM: Stale `lastHistoryId` Persists After Gallery Deletion

**Files**: `src/App.tsx:26-46`; `src/context/AppContext.tsx:546-562`; `src/components/gallery/GalleryPage.tsx:199-221`

After a gallery entry is deleted, the persisted `lastHistoryId` is never cleaned up. Every subsequent page load issues a 404 request. The stale DB entry persists indefinitely because `historyId` in app state was never restored (set to `null` on the failed load), so the `DELETE` triggered by RESET never fires.

### Additional Integrity Observations

- **No formal step transition table**: `SET_STEP` accepts any step value regardless of current state (`AppContext.tsx:387`).
- **`GENERATE_COMPLETE` leaves step at `'generating'`**: Transient state where `filledGridImage` is set but step hasn't advanced (`AppContext.tsx:357-365`). Undocumented.
- **Editor settings debounce race**: `useEditorSettings` debounce timer is not cancelled when `historyId` changes, so stale settings can be written to a new generation's ID.
- **Silent prompt degradation**: Building/terrain/background prompts with no `genericGuidance` produce zero structural cell instructions. Gemini may misplace content, extraction cuts incorrectly, and `EXTRACTION_COMPLETE` fires with wrong sprites -- no error raised.

---

## 4. Dependency & Build Health (deps-reviewer)

### Finding D1 -- MODERATE: Known Vulnerability in esbuild (GHSA-67mh-4wv8-2f99)

**File**: `package-lock.json` (esbuild 0.21.5 via vite 5.4.21)

Origin validation error (CVSS 5.3) allows any website to send requests to esbuild's dev server and read responses (source code exfiltration). Dev-environment only. Fix requires Vite upgrade to 6.3+/7.x (semver major bump from current `^5.4.2`).

### Finding D2 -- LOW: Dead Dependency (`sharp`)

**File**: `package.json` (devDependencies)

`sharp@0.34.5` (~6-10MB native image library) is declared in devDependencies but never imported anywhere. Vestigial from a removed feature.

### Finding D3 -- HIGH: No CI Pipeline Runs Tests or Builds

**Files**: `.github/workflows/claude-code-review.yml`, `.github/workflows/claude.yml`

Both GitHub Actions workflows exist exclusively for AI code review. Neither runs `npm run build`, `npm run test:unit`, `tsc --noEmit`, or any quality gate. Coverage thresholds are nominal (statements: 8%, branches: 10%, functions: 2%, lines: 7% in `vitest.config.ts:12-17`).

### Finding D4 -- MEDIUM: Build Pipeline Skips TypeScript Type Checking

**Files**: `package.json` (scripts), `tsconfig.json:15-16`

`npm run build` = `vite build` only. No `tsc --noEmit` step. `noUnusedLocals: false` and `noUnusedParameters: false` explicitly disabled. No ESLint or Prettier. TypeScript provides IDE feedback only, not CI-enforced correctness.

### Finding D5 -- MEDIUM: Playwright E2E Tests Cannot Self-Start

**File**: `playwright.config.ts`, `server/index.js:623-626`

`webServer` config starts only the Vite frontend. The E2E test fetches from `/test-fixtures/*`, served exclusively by the Express backend. In CI without a pre-started backend, tests fail or pass against stale data. `reuseExistingServer: true` masks the problem locally.

### Finding D6 -- LOW: `vite.config.js` Is Plain JavaScript

**File**: `vite.config.js`

All other config files use TypeScript (`vitest.config.ts`, `playwright.config.ts`). Minor consistency gap.

### Finding D7 -- LOW: No Node.js Engine Constraint

**File**: `package.json`

No `engines` field, `.nvmrc`, or `.node-version`. Server uses Node 22 features. A developer on Node 18 may encounter subtle runtime differences.

---

## Cross-Cutting Themes

### Theme 1: Incremental Type Addition Without a Registration Contract

All four reviewers independently converged on this root cause. The codebase added sprite types incrementally (character -> building -> terrain -> background) without establishing a single source of truth. Evidence surfaces in every layer:

| Layer | Symptom | Reviewers |
|-------|---------|-----------|
| TypeScript types | Closed `SpriteType` union, 15+ change locations | Scale, Integrity |
| Reducer actions | Character uses `SET_PRESETS`, others use `SET_X_PRESETS` | Consistency |
| DB schema | 8 separate preset/link tables vs 1 discriminated `generations` table | Scale, Integrity |
| Admin UI | 4 copy-paste CRUD components (~740 lines) | Scale, Consistency |
| Prompt builders | 4 independent files with divergent naming/fallbacks | Consistency, Integrity |
| Deserialization | Unchecked `as XxxGridSize` casts per type in `loadGeneration.ts` | Integrity, Scale |

### Theme 2: No Automated Safety Net for Refactoring

The most needed refactors (central registry, admin consolidation, DB schema normalization) are also the most dangerous to perform -- and the project has **zero automated quality gates**:

- No `tsc --noEmit` in build or CI (type errors invisible)
- No ESLint (style drift inevitable, `as any` casts undetected)
- No CI test/build step (regressions merge undetected)
- Coverage thresholds at 2-10% (meaningless gates)
- `noUnusedLocals: false` (dead state like `RunState.active` persists)

A developer could add a partial 5th sprite type that compiles in the files they edit but throws `Error: Unknown sprite type` at runtime -- and nothing catches it before merge.

### Theme 3: Untagged Shared State Outlives Context Transitions

Multiple pieces of state (`activeGridConfig`, `filledGridImage`, `templateImage`, `sprites`, `historyId`) are populated by one sprite type's workflow but persist after `SET_SPRITE_TYPE`, creating cross-contamination risks. The type-specific content fields (`state.character`, `state.building`, etc.) are safely separated, but the shared workflow state is not tagged with its owning sprite type.

### Theme 4: Silent Failures at System Boundaries

The codebase consistently swallows errors or produces silently wrong results at boundaries:

- Server -> client: unchecked `as` casts turn bad data into runtime TypeErrors
- DB migrations: `catch (_) {}` silently swallows migration failures (`db.js:216`)
- Prompt generation: empty `genericGuidance` fallback produces incomplete prompts with no warning
- Admin UI: `window.alert()` bypasses the app's `SET_STATUS` notification system
- Gallery deletion: stale `lastHistoryId` causes perpetual 404s with no cleanup

---

## Prioritized Recommendations

### P1 -- Critical (High Impact, Enabling)

| # | Recommendation | Addresses | Effort |
|---|---------------|-----------|--------|
| P1.1 | **Add CI pipeline**: `tsc --noEmit && npm run test:unit && npm run build` on every PR | D3, D4, Theme 2 | Low |
| P1.2 | **Create a central `SPRITE_TYPE_REGISTRY`** driving type system, gallery filters, admin tabs, DB validation, and prompt dispatch | S1, C1, Theme 1 | Medium |
| P1.3 | **Add runtime validation at deserialization boundaries** in `loadGeneration.ts` for `spriteType` and `gridSize` | I3, Theme 4 | Low |
| P1.4 | **Tag `activeGridConfig` with `spriteType`** and clear on `SET_SPRITE_TYPE` to prevent cross-type contamination | I2, Theme 3 | Low |

### P2 -- High (Significant Quality Improvement)

| # | Recommendation | Addresses | Effort |
|---|---------------|-----------|--------|
| P2.1 | **Consolidate 4 admin preset tabs** into a single `GenericPresetsTab` with field schema config | S2, C2 | Medium |
| P2.2 | **Normalize character action naming** (`SET_PRESETS` -> `SET_CHARACTER_PRESETS`, etc.) and add `?type=character` to fetch URL | C1, C5 | Low-Medium |
| P2.3 | **Add CHECK constraint to `generations.sprite_type`** matching `grid_presets` constraint | S3, I3 | Low |
| P2.4 | **Remove dead `RunState.active` field** and enforce step/run invariant in the type system | I1 | Low |
| P2.5 | **Add ESLint** with `no-explicit-any`, `no-restricted-globals` (ban `window.alert`), and `consistent-type-assertions` | D4, C5, Theme 4 | Medium |
| P2.6 | **Fix Playwright E2E self-start**: add Express backend to `webServer` config or `globalSetup` | D5 | Low |
| P2.7 | **Add unit tests** for `promptForType.ts`, `loadGeneration.ts`, and `useGenericWorkflow.ts` | D3, Theme 2 | Medium |

### P3 -- Medium/Low (Cleanup and Hardening)

| # | Recommendation | Addresses | Effort |
|---|---------------|-----------|--------|
| P3.1 | **Consolidate 8 preset/link DB tables** into 2 normalized tables with discriminator column | S3 | High |
| P3.2 | **Align prompt builder fallback behavior** -- add default guidance templates for building/terrain/background | C3, Theme 4 | Medium |
| P3.3 | **Eliminate `promptForType.ts` switch** by delegating to `WORKFLOW_CONFIGS[spriteType].buildPrompt` | S5, C4 | Low |
| P3.4 | **Remove dead `sharp` dependency**: `npm uninstall sharp` | D2 | Trivial |
| P3.5 | **Clean up stale `lastHistoryId`** after 404 on restore (one-line DELETE addition) | I5 | Trivial |
| P3.6 | **Surface migration errors** in `db.js:216` instead of silently swallowing | S3, Theme 4 | Low |
| P3.7 | **Add DB indexes** on `generations(sprite_type)`, `generations(created_at)`, `generations(group_id)` | S1 | Low |
| P3.8 | **Plan Vite upgrade to 7.x** to resolve esbuild vulnerability (GHSA-67mh-4wv8-2f99) | D1 | Medium |
| P3.9 | **Add Node.js engine constraint** in package.json | D7 | Trivial |
| P3.10 | **Add type registration canary test**: assert `WORKFLOW_CONFIGS` keys match `SPRITE_TYPE_CONFIGS` keys match `PRESET_TABLES` keys | S1, Theme 1 | Low |

---

## Positive Observations

1. **`useGenericWorkflow` + `WORKFLOW_CONFIGS`** is a well-designed abstraction that proves the team can execute config-driven consolidation. The 4 workflow wrapper hooks are clean ~33-line delegations.

2. **`SPRITE_TYPE_CONFIGS`** in `UnifiedConfigPanel.tsx` successfully data-drives the designer config panel across all 4 sprite types.

3. **`PRESET_TABLES`** on the server side drives all preset CRUD from a single set of route handlers -- the server is ahead of the client in extensibility.

4. **`gridConfig.ts`** generic `getTemplateParams` fallback (line 245) allows arbitrary grid sizes to work without code changes -- a strong extensibility point.

5. **Error handling in workflow hooks** has been improved: `SET_STATUS` dispatch replaces previous silent `console.warn()` patterns in the consolidated `useGenericWorkflow`.

6. **The `generations` table** uses the correct discriminator pattern (`sprite_type TEXT`) that the preset tables should follow -- the right pattern exists in the codebase.

7. **Graceful degradation on history restore**: `App.tsx:40` correctly handles 404 on stale `historyId` by bailing out silently rather than crashing (though cleanup of the stale reference is missing).

8. **TypeScript adoption is genuine**: the `src/` directory is 100% TypeScript with well-defined interfaces for `AppState`, `Action`, grid configs, and API types. The type safety gaps are at boundaries, not in core logic.
