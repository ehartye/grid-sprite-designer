# Conventions & Idioms Review -- Round 1

**Reviewer**: Conventions & Idioms Perspective
**Scope**: Full codebase -- React 18 + Express + better-sqlite3 + TypeScript + Vite
**Date**: 2026-04-08

---

## Finding 1: SpriteReview is a God Component Orchestrating 7+ Hooks and 10+ Local States

**What**: `SpriteReview.tsx` (684 lines) instantiates 7+ custom hooks, manages 10+ pieces of local state, and orchestrates complex multi-effect synchronization with skip guards (`skipNextSaveRef`, `settingsLoaded`). The component is a state management controller, not a view.

**Where**: `src/components/grid/SpriteReview.tsx` -- entire file, but especially lines 37-305 (hook/state setup and effects). The settings save effect at line 307-343 has a 20+ item dependency array. The sprite processing effect at line 157-198 has 15+ items.

**Why**: This violates React's compositional model. The `skipNextSaveRef` / `settingsLoaded` dance (lines 200-305) is a symptom of fighting the rendering model rather than designing correct state flow. The effect ordering matters (load must complete before save can fire), but React effects don't guarantee ordering across separate `useEffect` calls -- the skip ref is a manual workaround for a structural problem. The sprawling dependency arrays make it nearly impossible to reason about when effects fire and make safe modifications extremely difficult.

**Confidence**: High

**Alternative**: Extract a `useEditorPersistence` hook (combines load/save/skip logic), a `useSpriteProcessing` hook (palette detection + processing pipeline), and keep SpriteReview as a layout-only composition. This aligns with the decomposition already partially done via `ReviewActions` and `PostProcessingSidebar`.

---

## Finding 2: Inconsistent State Management -- useReducer vs. Multiple useStates for Equivalent Problems

**What**: The project uses `useReducer` with typed action unions (AppContext, usePostProcessingState) alongside bags of individual `useState` calls (useChromaKeySettings with 5 states, useSpriteSelection with 8 states, usePosterizeSettings with 2 states). These hooks are consumed together in SpriteReview and serialized into a single `EditorSettings` object.

**Where**:
- Reducer pattern: `src/context/AppContext.tsx`, `src/hooks/usePostProcessingState.ts`
- Multi-useState pattern: `src/hooks/useChromaKeySettings.ts`, `src/hooks/useSpriteSelection.ts`, `src/hooks/usePosterizeSettings.ts`

**Why**: `useChromaKeySettings` has 5 states that always change together during restore/reset -- this is the textbook case for `useReducer`. Its `resetChromaKey()` calls 5 setters sequentially; its `restoreChromaKey()` conditionally calls 5 setters. Compare with `usePostProcessingState` where both operations are single dispatch calls. The `useSpriteSelection` hook has 8 interdependent states (eraseHistory drives erasedPixels, displayOrder affects export, etc.) with complex callback logic that would be clearer as reducer actions. The restore logic in SpriteReview (lines 218-263) must speak three different APIs to restore one conceptual settings object.

**Confidence**: High

**Alternative**: Consolidate chroma and posterize settings into the existing `usePostProcessingState` reducer. Convert `useSpriteSelection` to a reducer. This gives one dispatch, one reset, one restore action per subsystem, matching the established pattern.

---

## Finding 3: Type Safety Bypassed via `as Action` Casts in Dynamic Dispatch

**What**: `UnifiedConfigPanel.tsx` builds action objects dynamically using config-driven field names and casts them to `Action` to satisfy the discriminated union. This defeats TypeScript's compile-time safety for the reducer's action/payload contract.

**Where**:
- `src/components/config/UnifiedConfigPanel.tsx:201-205` -- `dispatch({ type: config.setContentAction, [config.contentStateKey]: { ...content, [field]: value } } as Action)`
- `src/components/config/UnifiedConfigPanel.tsx:179,225` -- additional `as Action` casts
- `src/context/AppContext.tsx:265-266` -- `as TerrainGridSize`, `as BackgroundMode` on initial state literals
- `src/context/AppContext.tsx:579-580` -- `as AppState['imageSize']`, `as AppState['thinkingLevel']` in RESTORE_SESSION

**Why**: The `as Action` casts in UnifiedConfigPanel are the most concerning. When you build `{ type: config.setContentAction, [config.contentStateKey]: value }` and cast to `Action`, TypeScript cannot verify the payload matches the action type. If someone renames an action or changes its payload, these casts silently produce malformed actions. The initial state casts (`as TerrainGridSize`, `as BackgroundMode`) are unnecessary -- the literals could be properly typed with `satisfies` or by annotating the containing object. The RESTORE_SESSION casts on API-sourced strings are unsafe trust-boundary crossings.

**Confidence**: High

**Alternative**: For UnifiedConfigPanel, create a per-sprite-type dispatch helper (a switch or overloaded function) that maintains type safety. For initial state, remove the casts by using `satisfies` constraints. For RESTORE_SESSION, validate at the boundary: `const imageSize = data.imageSize === '4K' ? '4K' : '2K'`.

---

## Finding 4: Server-Side Code is Untyped JavaScript Despite TypeScript Tooling Being Available

**What**: The entire `server/` directory is plain JavaScript. Route handlers, DB queries, middleware, and utility functions have no type annotations or JSDoc. The project already has `@types/express` installed and TypeScript configured.

**Where**: `server/index.js`, `server/routes/*.js`, `server/utils.js`, `server/middleware.js`, `server/db/*.js`, `server/presetTables.js`

**Why**: This creates an unverified type boundary at the API layer. The client has typed interfaces for API responses (`src/types/api.ts` with `HistoryResponse`, `GalleryEntry`, etc.) but the server that produces those responses has no compile-time enforcement. The `snake_case` to `camelCase` field mapping in history.js (lines 62-88) is a manual process that could silently break. The `presetTables.js` column config is an implicit ORM with no type validation -- adding a field requires matching updates in the config, the seed data, the migration, and the client type.

**Confidence**: High

**Alternative**: Either migrate server to TypeScript (low effort given the tooling is already present) or add JSDoc type annotations to route handlers and utility functions. At minimum, share response type definitions between client and server.

---

## Finding 5: Duplicated Save-to-History + Archive Pipeline in useRegenerateWithFeedback

**What**: `useRegenerateWithFeedback.ts` (lines 139-208) manually reimplements the history POST + sprite POST + archive POST sequence from `runGeneratePipeline` (lines 168-248 in `useGenericWorkflow.ts`). The two implementations have diverged: the archive payload in regeneration omits `poseId`, and the error handling patterns differ.

**Where**:
- `src/hooks/useGenericWorkflow.ts:168-248` -- canonical save pipeline
- `src/hooks/useRegenerateWithFeedback.ts:139-208` -- duplicated, divergent copy

**Why**: `runGeneratePipeline` was designed as the single canonical pipeline that all generation flows use. `useAddSheet` and `useRunWorkflow` both delegate to it correctly. But `useRegenerateWithFeedback` reimplements the save portion because it uses a different Gemini API call (edit vs. generate). The save logic itself is identical and could be shared. The divergence (missing `poseId` in archive) is already a subtle bug. Any future change to the save logic (new fields, different error handling) must be applied in two places.

**Confidence**: High

**Alternative**: Extract a `saveGenerationResult()` function from `runGeneratePipeline` that handles the history + sprites + archive sequence. The regeneration hook calls `editGrid()` for the Gemini call, then delegates to `saveGenerationResult()` for persistence.

---

## Finding 6: Naming Inconsistency -- useGridWorkflow vs. use[Type]Workflow

**What**: The character workflow hook is named `useGridWorkflow` (file: `useGridWorkflow.ts`) while all other sprite types follow `use[Type]Workflow` naming: `useBuildingWorkflow`, `useTerrainWorkflow`, `useBackgroundWorkflow`.

**Where**:
- `src/hooks/useGridWorkflow.ts` -- exports `characterConfig` and `useGridWorkflow`
- `src/hooks/useBuildingWorkflow.ts` -- exports `buildingConfig` and `useBuildingWorkflow`

**Why**: "Grid" was the original concept when characters were the only type. The exported config is correctly named `characterConfig`, but the file and hook name create confusion -- "grid workflow" sounds like it should be about the grid system, not character sprites. This is a legacy naming issue that compounds when searching the codebase or reading imports.

**Confidence**: High

**Alternative**: Rename to `useCharacterWorkflow.ts` / `useCharacterWorkflow`. The exported `characterConfig` is already correct. This is a low-risk rename with `WORKFLOW_CONFIGS` as the only consumer.

---

## Finding 7: `ContentPreset` Type is a Bag of Optionals Instead of a Discriminated Union

**What**: `ContentPreset` in `src/types/api.ts` is a flat interface where every sprite-type-specific field (`equipment`, `details`, `tileLabels`, `layerLabels`, `bgMode`) is optional. This provides no compile-time guarantee that a character preset has `equipment` or a building preset has `details`.

**Where**: `src/types/api.ts:55-78`

**Why**: The app already has a proper discriminated union for state-side presets (`AnyPreset = CharacterPreset | BuildingPreset | TerrainPreset | BackgroundPreset` in AppContext.tsx, using `spriteType` as discriminator). But the API-side `ContentPreset` doesn't use this pattern. The `fetchContentPreset` function returns an untyped bag, and prompt builders access fields with `|| ''` fallbacks. If the API returns a malformed preset (missing `equipment` for a character), the prompt builder silently uses empty strings instead of erroring.

**Confidence**: Medium

**Alternative**: Use `AnyPreset` at the API boundary by validating and narrowing in `fetchContentPreset`. Or add a `spriteType` discriminator to `ContentPreset` and use conditional types in consumers.

---

## Finding 8: `await new Promise(r => setTimeout(r, 0))` Used to Flush React Dispatches

**What**: `SpriteReview.tsx:489` dispatches model/imageSize/thinkingLevel changes then `await new Promise(r => setTimeout(r, 0))` before calling `regenerate()`, relying on the setTimeout to let React process the dispatches so `stateRef.current` is updated.

**Where**: `src/components/grid/SpriteReview.tsx:485-489`

**Why**: This is a timing-dependent workaround. The code needs to pass updated settings to the regeneration call but takes an indirect route: dispatch to global state, wait for React to flush, then read from a ref. In React 18's automatic batching, dispatches within the same synchronous block are batched and applied on the next render -- the setTimeout forces a microtask boundary. This is fragile in concurrent mode and obscures the actual data dependency. The regeneration function should simply accept the settings as parameters.

**Confidence**: High

**Alternative**: Pass `regenSettings` directly to `regenerate()` as part of the options object instead of dispatching to global state and hoping the ref updates. The hook already accepts `RegenerateOptions` -- extend it to include model/imageSize/thinkingLevel.

---

## Finding 9: `useEffect` Dependency Array Contains Unstable Array Reference

**What**: The sprite processing effect in SpriteReview (line 198) includes `postState.outline.color` as a dependency. This is an RGB tuple (`[number, number, number]`) created fresh by the reducer on every state update, even when the color hasn't changed. This causes the heavy sprite processing pipeline to re-run unnecessarily.

**Where**: `src/components/grid/SpriteReview.tsx:198` -- `postState.outline.color` in dependency array

**Why**: Arrays fail reference equality in dependency arrays. The developer is aware of this problem for `struckColors` (line 97: `const struckKey = JSON.stringify(postState.struckColors)`) but hasn't applied the same treatment to `outline.color`. Every time any post-processing state changes, the reducer returns a new state object with a new `outline` sub-object containing a new `color` array, even if color itself didn't change. This triggers the expensive processing effect unnecessarily.

**Confidence**: High

**Alternative**: Apply the same stringify-and-compare pattern used for `struckColors`, or restructure the reducer to preserve object identity when sub-values haven't changed (`if (action.color[0] === state.outline.color[0] && ...) return state`).

---

## Finding 10: React Context Split is Correctly Implemented

**What**: AppContext correctly splits into three separate contexts (`AppStateContext`, `AppDispatchContext`, `AbortControllerRefContext`) with dedicated hooks (`useAppState()`, `useAppDispatch()`, `useAbortControllerRef()`). Each hook has proper null-check error messages.

**Where**: `src/context/AppContext.tsx:604-669`

**Why**: This is a React best practice. Components that only need `dispatch` (stable reference) won't re-render when state changes. The convenience `useAppContext()` hook returns both for backward compatibility. The implementation is clean.

**Confidence**: High

**Alternative**: No change needed. Well done.

---

## Finding 11: Server Route Factory Pattern is Clean

**What**: Every Express router is created via a factory function that receives dependencies explicitly: `createGenerateRouter(apiKey)`, `createHistoryRouter(db)`, `createGalleryRouter(db)`, etc.

**Where**: `server/routes/*.js`, composed in `server/index.js:56-63`

**Why**: This is idiomatic Express architecture with clean dependency injection. Each router receives exactly what it needs. The mounting paths are clear and consistent. Adding new route modules follows an obvious pattern.

**Confidence**: High

**Alternative**: No change needed. Well done.

---

## Finding 12: Workflow Config Pattern is a Strong Abstraction

**What**: The `useGenericWorkflow` + per-type config + `WORKFLOW_CONFIGS` map pattern cleanly separates sprite-type-specific behavior (prompt building, grid config, content access) from shared pipeline logic (template generation, Gemini call, extraction, save).

**Where**: `src/hooks/useGenericWorkflow.ts`, `src/hooks/use*Workflow.ts`

**Why**: Each sprite type provides a thin config object (`WorkflowConfig`) with pure functions. The shared pipeline consumes these configs polymorphically. Adding a new sprite type means creating one config object and adding it to the map. The `buildGenerationRequest` utility further centralizes parameter construction. This is well-designed.

**Confidence**: High

**Alternative**: No change needed, aside from the naming issue (Finding 6).

---

## Finding 13: ESLint Disables `no-explicit-any` and Two react-hooks Rules Globally

**What**: The ESLint config sets `@typescript-eslint/no-explicit-any: 'off'` and disables `react-hooks/set-state-in-effect` and `react-hooks/refs` (v7 rules). Comments explain these are tracked for cleanup.

**Where**: `eslint.config.js:20-24`

**Why**: Disabling `no-explicit-any` means new code can introduce `any` without friction. The `set-state-in-effect` rule catches a real bug class (setting derived state in effects instead of computing it). The `refs` rule catches ref mutations during render. Setting these to `'off'` means new violations accumulate silently.

**Confidence**: Medium

**Alternative**: Set all three to `'warn'` instead of `'off'`. This surfaces violations in new code without breaking the build and allows gradual cleanup.

---

## Finding 14: `loadGenerationIntoState` Has Repetitive Type-Branching That Could Use Existing Abstractions

**What**: `loadGenerationIntoState` has four near-identical branches for building/terrain/background/character config construction (lines 50-111) and three near-identical branches for extraction grid override (lines 140-163). Each branch validates gridSize, calls a type-specific function, and builds the same-shaped output.

**Where**: `src/lib/loadGeneration.ts:50-163`

**Why**: The `WORKFLOW_CONFIGS` pattern was designed to eliminate exactly this kind of sprite-type switching. Adding a new sprite type requires adding branches in two places in this file (config construction and extraction override), plus the grid config functions, plus WORKFLOW_CONFIGS. The extraction branches all produce `{ cols, rows, totalCells, cellLabels }` -- this is already `getReExtractGridConfig` from the workflow config.

**Confidence**: Medium

**Alternative**: Add a `buildRestoreConfig` method to `WorkflowConfig` or use the existing `getReExtractGridConfig`. Create a lookup from sprite type to the `get*GridConfig` function to eliminate the repeated if-else chains.

---

## Summary

**Strengths**:
1. **Workflow config pattern** -- Clean abstraction separating type-specific behavior from shared pipeline logic.
2. **React Context split** -- State/dispatch/ref in separate contexts, correctly preventing unnecessary re-renders.
3. **Server route factories** -- Idiomatic Express DI pattern with explicit dependencies.
4. **Domain type system** -- Well-structured discriminated unions for actions and presets in the state layer.
5. **Prompt builder hierarchy** -- `promptBuilderBase.ts` shared utilities eliminate duplication effectively.
6. **PostProcessingState reducer** -- Good model for how all settings hooks should work.

**Key Concerns**:
1. **SpriteReview god component** (Finding 1) -- 684 lines, 7+ hooks, 10+ states, 20-item dependency arrays. The most impactful decomposition target.
2. **Inconsistent state management** (Finding 2) -- useReducer and useState-bags for equivalent complexity, requiring multi-API orchestration in consumers.
3. **Type safety bypassed** (Finding 3) -- `as Action` casts defeat discriminated union safety; `as` casts at trust boundaries bypass validation.
4. **Untyped server** (Finding 4) -- API boundary has no server-side type enforcement despite client types existing.
5. **Duplicated save pipeline** (Finding 5) -- Regeneration reimplements the generation save logic with divergent behavior.
6. **setTimeout flush hack** (Finding 8) -- Timing-dependent dispatch flushing instead of passing data directly.

**Overall Assessment**: The codebase demonstrates strong architectural judgment in its core abstractions (workflow configs, context splitting, prompt builder hierarchy). The conventions are well-established within each subsystem but inconsistent across subsystems (reducer vs. useState, typed vs. untyped). The primary maintenance risk is SpriteReview's orchestration complexity. The most actionable quick wins are: (1) extract save pipeline from regeneration, (2) pass regen settings as parameters instead of dispatch+setTimeout, (3) set ESLint rules to warn.
