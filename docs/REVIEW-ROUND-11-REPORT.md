# Review Round 11 — Cross-Pollinated Report

**Date**: 2026-03-08
**Branch**: master (commit f29a775)
**Reviewers**: API Design (api-reviewer), UX Flow & Interaction (ux-reviewer), Security & Input Validation (security-reviewer), Maintainability & Developer Experience (maintainability-reviewer)

---

## Executive Summary

Round 11 reviewed the Grid Sprite Designer codebase across four domains: API design, UX interaction flows, security, and maintainability. Four independent reviewers produced **59 findings total**: 1 critical, 12 high, 26 medium, and 20 low severity. The reviews converge on six systemic themes:

1. **Input validation gaps** — The server accepts unvalidated user input in multiple endpoints (model names, MIME types, image sizes, arbitrary JSON, state keys). Flagged independently by API, Security, and Maintainability reviewers, reinforcing that the validation layer is structurally incomplete.

2. **Inconsistent API contracts** — REST conventions are applied inconsistently (mixed query/path params, mixed PUT/PATCH semantics, divergent error shapes, phantom deletes returning 200). TypeScript types on the client do not match server responses, creating silent contract drift.

3. **Missing user feedback for destructive/async operations** — Destructive actions (reset, sprite type switch) lack confirmation, async operations (re-extract, multi-grid generation) lack progress indicators, and error states are swallowed silently.

4. **Type safety erosion at abstraction boundaries** — The consolidation of duplicated components into generic/unified versions (UnifiedConfigPanel, GenericPresetsTab) traded compile-time type safety for reduced duplication, introducing `Record<string, unknown>`, `as any` casts, and untyped escape hatches. This is the central maintainability tradeoff in the codebase.

5. **Rate limiting is incomplete** — Only `/api/generate-grid` is rate-limited. All write endpoints accept unbounded requests, creating denial-of-service and disk exhaustion vectors.

6. **No centralized API client or validation middleware** — Both the server (no schema validation middleware) and client (no typed fetch wrapper) lack abstraction layers for cross-cutting concerns, causing validation gaps, inconsistent error handling, and duplicated fetch boilerplate.

---

## Critical Findings

### CRIT-1: Real API Key in `.env.local`
**Reviewer**: Security (F1)
**File**: `.env.local:1`

A real Google Gemini API key is present in the working directory. While `.env.local` is in `.gitignore`, the key is exposed to any process with filesystem access, any accidental `git add .` before gitignore evaluation, IDE sync tools, or directory copies.

**Action**: Rotate the key immediately. Add a pre-commit hook scanning for credential patterns (e.g., `AIzaSy` prefix).

---

## High-Severity Findings

### HIGH-1: `model` Parameter Forwarded to Gemini URL Without Allowlist
**Reviewers**: Security (F2), API (F9), Maintainability (M-1)
**Files**: `server/routes/generate.js:10,56-59`, `server/routes/generate.js:135-156`

The `model` parameter from `req.body` is interpolated directly into the Gemini API URL: `` `${GEMINI_BASE}/${model}:generateContent` ``. No allowlist restricts valid model names. This enables URL injection (e.g., `model = "../../other-endpoint"`). The same issue affects `/api/test-connection`, which additionally has no rate limiting.

**Cross-ref**: Maintainability-M1 notes the default model name (`'nano-banana-pro-preview'`) is hardcoded in 3 locations (AppContext, geminiClient, server route) with no centralized constant. API-F9 notes divergent error shapes between the two endpoints.

**Action**: Add `ALLOWED_MODELS` allowlist. Extract default model to a single constant. Apply to both endpoints.

---

### HIGH-2: No Rate Limiting on Write Endpoints
**Reviewers**: Security (F3), API (F9)
**Files**: All route files except `server/routes/generate.js`

Only `POST /api/generate-grid` has rate limiting. All other write endpoints accept unbounded requests. The 50MB body limit on `/api/history` and `/api/archive` with no rate limit means an attacker can flood the server with large payloads, consuming memory and disk.

**Action**: Apply global rate limiting middleware, with tighter limits on large-body endpoints (history, archive).

---

### HIGH-3: Path Traversal Risk in Archive Route
**Reviewer**: Security (F4)
**File**: `server/routes/archive.js:17-22,37-38`

The archive route sanitizes `contentName` via regex (`[^a-z0-9]+`), which is good, but does not verify that the resulting path stays within `outputDir` using `realpath`/`startsWith`. The `poseName` for sprite filenames has the same treatment without boundary verification.

**Cross-ref**: Security-F6 notes that archived files are publicly served via `/output/` with no authentication.

**Action**: Add explicit path boundary check after `join()`.

---

### HIGH-4: GET /api/history/:id Fabricates Empty Fields
**Reviewer**: API (F1)
**Files**: `server/routes/history.js:39-65`, `src/types/api.ts:9-35`

The history detail endpoint returns hardcoded empty strings for fields (`equipment`, `colorNotes`, `styleNotes`, `rowGuidance`) that are never stored in the database. `filledGridMimeType` is hardcoded to `'image/png'` regardless of actual data. The `HistoryResponse` TypeScript type marks these as optional, masking the fabrication.

**Cross-ref**: UX-F2 notes session restore silently lands users on review with fabricated data. API-F11 notes no `HistoryDetailResponse` type exists. Maintainability-M5 notes `bgMode` is similarly not surfaced from the DB, requiring fragile heuristic inference.

**Action**: Remove fabricated fields or persist actual values at save time. Create a `HistoryDetailResponse` TypeScript interface matching server reality.

---

### HIGH-5: Inconsistent Preset URL Patterns (Query vs Path Param)
**Reviewer**: API (F2)
**Files**: `server/routes/presets.js:9-21,23-33`

`GET /api/presets` uses `?type=` query parameter while all other preset CRUD operations use `:type` as a path parameter. The query-param route has inline validation duplicating the `validatePresetType` middleware.

**Cross-ref**: Security-F8 flags this as a maintenance hazard — the inline validation could diverge from the middleware, creating a security gap.

**Action**: Normalize to `GET /api/presets/:type` for all endpoints.

---

### HIGH-6: Content Preset ID Type Mismatch (TEXT Schema vs Integer Validation)
**Reviewer**: API (F4)
**Files**: `server/db/schema.js:56-107`, `server/routes/presets.js:23-33`

Content preset tables define `id TEXT PRIMARY KEY` but routes call `parseIntParam(req.params.id)`, which rejects non-integer IDs with 400. Grid-link sub-routes (API-F10) use `req.params.id` directly without `parseIntParam`, creating further inconsistency.

**Action**: Normalize all preset IDs to one type (either TEXT with string validation or INTEGER with auto-increment).

---

### HIGH-7: DELETE /api/grid-presets/:id Returns 200 on Phantom Deletes
**Reviewer**: API (F3)
**Files**: `server/routes/gridPresets.js:68-81`

DELETE always returns 200 `{ success: true }` regardless of whether the resource existed. Other DELETE endpoints (history) correctly return 404. Three distinct DELETE response patterns exist across the API.

**Action**: Check `result.changes === 0` and return 404. Standardize DELETE response pattern across all resources.

---

### HIGH-8: Custom Preset Mode Blocks Generation With No Path Forward
**Reviewer**: UX (F1)
**Files**: `src/components/config/UnifiedConfigPanel.tsx:249-252,455-486`, `GridLinkSelector.tsx:71`

When no content preset is selected (custom mode), `GridLinkSelector` renders nothing, but validation requires `selectedGridLinks.length > 0`. Users see "Select a grid preset above" but no grid selector is visible — a dead end.

**Cross-ref**: API reviewer notes the grid preset association model requires Admin setup before the designer is usable, which is an undocumented prerequisite.

**Action**: Render a fallback grid selector in custom mode, or surface a clear message explaining the Admin setup requirement.

---

### HIGH-9: Session Restore Has No Loading Indicator or Success Feedback
**Reviewer**: UX (F2)
**Files**: `src/App.tsx:29-54`

The app silently restores the last session on mount with no loading indicator. Successful restore gives no feedback; failed restore silently clears state. The `/api/state/lastHistoryId` endpoint stores a numeric ID with no session scoping.

**Cross-ref**: Security-F6 notes no authentication, meaning multi-user deployments would leak sessions. API-F7 notes `/api/state/:key` is an open key-value store.

**Action**: Add loading skeleton during restore, success/failure status messages, and document the single-user assumption.

---

### HIGH-10: "New Sprite" Resets All Work Without Confirmation
**Reviewer**: UX (F3)
**Files**: `src/components/layout/AppHeader.tsx:50-53,103-107`

The header's "New Sprite" button dispatches `RESET` immediately with no confirmation dialog, even during review/preview steps where users may have spent significant time tuning settings. The Gallery's `handleLoad` uses `window.confirm()` but the header button does not.

**Cross-ref**: UX-F7 identifies the same issue with sprite type switching. Maintainability-M14 notes `window.confirm()` is non-testable in jsdom environments.

**Action**: Add confirmation before `RESET` when in review/preview steps. Use a React-controlled dialog rather than `window.confirm()`.

---

### HIGH-11: `Record<string, unknown>` Erasure in GenericPresetsTab
**Reviewer**: Maintainability (M-2)
**Files**: `src/components/admin/GenericPresetsTab.tsx:93-94,109-110,123,175`

`GenericPresetsTab` stores and manipulates presets as `Record<string, unknown>[]`, then accesses fields with casts like `p.name as string`, `p.id as number`. This erases all type information from the strongly-typed preset interfaces. Typos in field key strings silently return `undefined` at runtime.

**Cross-ref**: Maintainability-M3 notes 12 `as any` casts in `UnifiedConfigPanel` stem from the same root cause — the data-driven `SpriteTypeConfig` uses generic container types.

**Action**: Use discriminated union or typed generic: `GenericPresetsTab<T extends CharacterPreset | BuildingPreset | ...>`.

---

### HIGH-12: Faux Model Name Hardcoded in 3 Locations
**Reviewer**: Maintainability (M-1)
**Files**: `src/context/AppContext.tsx:260`, `src/api/geminiClient.ts:37`, `server/routes/generate.js:137`

The default model value `'nano-banana-pro-preview'` is hardcoded in three locations. Changes require finding and updating all manually. The string is also persisted to database records.

**Cross-ref**: Security-F2 flags the same model parameter as unvalidated for URL injection.

**Action**: Extract to a single named constant. Consider making configurable via environment variable.

---

## Medium-Severity Findings

### MED-1: `/api/state/:key` Is an Open Key-Value Store
**Reviewers**: API (F7), Security (F6)
**Files**: `server/routes/state.js:13-28`

Any key/value pair can be written or deleted. No allowlist, no value validation, no authorization. DELETE returns 200 even if the key didn't exist.

**Action**: Define `VALID_STATE_KEYS` allowlist. Add value validation per key.

---

### MED-2: Unvalidated `mimeType` Stored and Reflected to Client
**Reviewers**: Security (F5), API (F5)
**Files**: `server/routes/history.js:123-125,149-152`, `server/routes/generate.js:68,77`

MIME types from client requests are accepted without allowlist validation. Stored values are used in `data:` URLs in gallery image tags.

**Action**: Add `ALLOWED_MIME_TYPES` allowlist (`image/png`, `image/jpeg`, `image/webp`).

---

### MED-3: `imageSize` and `aspectRatio` Forwarded to Gemini Without Validation
**Reviewer**: Security (F7)
**Files**: `server/routes/generate.js:56,88-92`

These parameters are passed directly to Gemini's `generationConfig` without allowlist validation, potentially triggering unexpected billing or quota usage.

**Action**: Add allowlists for both parameters.

---

### MED-4: No Authentication on Any Endpoint
**Reviewer**: Security (F6)
**Files**: All route files

The entire API surface is unauthenticated. CORS only protects browser-based cross-origin requests, not direct programmatic access.

**Action**: Document the local-only assumption. Bind server to `127.0.0.1` explicitly. If network access is ever planned, add API key authentication.

---

### MED-5: Inconsistent SQL Template Literal vs Middleware Validation
**Reviewer**: Security (F8)
**Files**: `server/routes/presets.js:11-17`

The GET list route uses inline validation while other routes use `validatePresetType` middleware. While not currently exploitable, the inconsistency is a maintenance hazard.

**Action**: Use `validatePresetType` middleware consistently across all preset routes.

---

### MED-6: PUT /api/history/:id/thumbnail Has No Field Validation
**Reviewer**: API (F5)
**Files**: `server/routes/history.js:144-156`

`cellIndex`, `imageData`, and `mimeType` are all accepted without type or format validation.

**Action**: Validate `cellIndex` as non-negative integer, validate `imageData` as non-empty string, validate `mimeType` against allowlist.

---

### MED-7: Mixed PUT/PATCH Partial-Update Patterns
**Reviewer**: API (F6)
**Files**: `server/routes/history.js:144-156,199-214`

`PUT /history/:id/thumbnail` performs a partial update (PUT semantics imply full replacement). `PATCH /history/:id/group` has non-standard idempotency behavior (`alreadySet: true`).

**Action**: Normalize to PATCH for partial updates. Document idempotency behavior.

---

### MED-8: Gallery Pagination Undocumented; No Limit in Response Envelope
**Reviewer**: API (F8)
**Files**: `server/routes/gallery.js:8-9`, `src/components/gallery/GalleryPage.tsx:43`

Server clamps limit between 1-100 (default 24), client hardcodes 24. Neither documents the contract. `GalleryResponse` type omits the applied `limit` from the response.

**Action**: Document pagination contract. Include `limit` in response envelope.

---

### MED-9: `/api/test-connection` Has No Rate Limit, Divergent Error Shape
**Reviewer**: API (F9)
**Files**: `server/routes/generate.js:104-131,135-156`

No rate limiting on an endpoint that calls the Gemini API (billing impact). Success/error response shapes differ from `/api/generate-grid`.

**Action**: Apply rate limiting. Standardize response shapes. Validate model parameter.

---

### MED-10: Grid-Link Sub-Routes Mix Parsed vs Raw ID Handling
**Reviewer**: API (F10)
**Files**: `server/routes/presets.js:80-107`

Grid-link routes use `req.params.id` directly while sibling routes use `parseIntParam`. Related to HIGH-6 (ID type mismatch).

**Action**: Resolve as part of HIGH-6 ID type normalization.

---

### MED-11: No `HistoryDetailResponse` TypeScript Type
**Reviewer**: API (F11)
**Files**: `src/hooks/useGenericWorkflow.ts:141-194`, `src/types/api.ts:37-40`

`POST /api/history` sends `templateImage` but `GET /api/history/:id` never returns it. No TypeScript interface documents the GET response shape.

**Action**: Create `HistoryDetailResponse` interface. Decide whether `templateImage` should be surfaced in GET.

---

### MED-12: Archive API Returns Folder Name With No URL; No Pagination on GET
**Reviewer**: API (F12)
**Files**: `server/routes/archive.js:8-76`

POST returns `{ folder: folderName }` with no URL. GET returns all directories with no pagination.

**Action**: Include URL in POST response. Add pagination to GET.

---

### MED-13: Bulk Individual Export Triggers Many Downloads Without Warning
**Reviewer**: UX (F5)
**Files**: `src/components/grid/SpriteReview.tsx:383-404`

`handleExportIndividual` triggers `link.click()` in a loop for every sprite (up to 36+ downloads). No pre-warning or selection UI.

**Action**: Show count confirmation dialog. Consider ZIP bundle download.

---

### MED-14: Gallery Delete Armed State Does Not Auto-Reset
**Reviewer**: UX (F6)
**Files**: `src/components/gallery/GalleryPage.tsx:209-241`

The two-click delete pattern has no timeout — armed state persists indefinitely. Pattern is inconsistent with Admin's `window.confirm()`.

**Action**: Auto-reset after 3-5 seconds. Standardize confirmation pattern across app.

---

### MED-15: Sprite Type Switch Silently Discards In-Progress Work
**Reviewer**: UX (F7)
**Files**: `src/context/AppContext.tsx:348-360`

`SET_SPRITE_TYPE` clears `activeGridConfig`, `filledGridImage`, `templateImage`, `sprites`, `historyId` with no warning.

**Action**: Prompt for confirmation when switching types during review/preview steps.

---

### MED-16: Re-Extract Button Has No Loading/Disabled State
**Reviewer**: UX (F8)
**Files**: `src/components/grid/SpriteReview.tsx:806-813`, `src/hooks/useGenericWorkflow.ts:319-347`

Button can be clicked multiple times during operation, triggering overlapping extractions. No visual feedback on completion.

**Action**: Add `isReextracting` state, disable button during operation, add spinner.

---

### MED-17: Animation Preview Has No Path Back to Configure
**Reviewer**: UX (F9)
**Files**: `src/components/preview/AnimationPreview.tsx:165-227`

Only "Back to Review" is available. Returning to configure requires two navigation steps.

**Action**: Add breadcrumb navigation or "Back to Configure" shortcut.

---

### MED-18: Gallery Empty State Hard-Codes "character"
**Reviewer**: UX (F10)
**Files**: `src/components/gallery/GalleryPage.tsx:291-297`

Empty gallery shows "Create your first character!" regardless of active sprite type filter.

**Action**: Make empty state type-aware. Add "Go to Designer" call-to-action.

---

### MED-19: 12 `as any` Casts in UnifiedConfigPanel
**Reviewer**: Maintainability (M-3)
**Files**: `src/components/config/UnifiedConfigPanel.tsx:225-233,257-272`

`content` is typed as `Record<string, unknown>` via `state[config.contentStateKey]`, forcing 12 `(content as any).fieldName` casts. Root cause: the data-driven `SpriteTypeConfig` uses generic container types rather than a discriminated union.

**Cross-ref**: HIGH-11 (same root cause in GenericPresetsTab).

**Action**: Extract typed accessor at branch top: `const buildingContent = content as AppState['building']`.

---

### MED-20: `historyExtras?: Record<string, any>` — Residual `any` in Pipeline
**Reviewer**: Maintainability (M-4)
**Files**: `src/hooks/useGenericWorkflow.ts:47`

The `PipelineParams` interface uses `Record<string, any>` for history extras, bypassing type checking on anything passed through this escape hatch.

**Action**: Type explicitly: `historyExtras?: { contentPresetId?: string | null; groupId?: string; }`.

---

### MED-21: `bgMode` Inference via Fragile Grid Size String Heuristic
**Reviewer**: Maintainability (M-5)
**Files**: `src/lib/loadGeneration.ts:89`

Background mode is inferred via `data.gridSize.startsWith('1x') ? 'parallax' : 'scene'` instead of using the stored `bgMode` field.

**Cross-ref**: HIGH-4 (API fabricates/omits fields from history response).

**Action**: Use `data.bgMode ?? (heuristic fallback)`. Verify API returns `bgMode`.

---

### MED-22: `promptBuilder.ts` Column Calculation Uses Wrong Heuristic
**Reviewer**: Maintainability (M-6)
**Files**: `src/lib/promptBuilder.ts:153-154`

Column count is computed via `Math.ceil(Math.sqrt(totalCells))` instead of using actual grid dimensions. For non-square grids, the prompt describes incorrect cell coordinates.

**Action**: Accept `cols` and `rows` parameters directly from callers (already available via `GridConfig`).

---

### MED-23: `SpriteReview.tsx` is 865-Line Mega-Component
**Reviewer**: Maintainability (M-7)
**Files**: `src/components/grid/SpriteReview.tsx` (865 lines)

Mixes image processing functions (`processSprite`, `detectPalette`), all export logic, and complex UI. Export name derivation is literally duplicated at lines 368-372 and 388-392.

**Action**: Extract `processSprite`/`detectPalette` to `src/lib/spriteProcessing.ts`. Extract shared `getExportBaseName(state)` helper.

---

### MED-24: No Centralized Fetch/Error Boundary for API Calls
**Reviewer**: Maintainability (M-11)
**Files**: Multiple hooks and components

Every component performs raw `fetch()` calls with manually specified headers and individual catch blocks. No shared timeout, retry, or request interception. API base URL changes require updates in 10+ locations.

**Cross-ref**: Security-F6 notes a centralized client would be the natural place for auth headers. API-F11 notes typed response interfaces are not enforced at the fetch boundary.

**Action**: Create `src/api/client.ts` with `apiGet<T>`, `apiPost<T>` typed fetch wrappers, following the existing `geminiClient.ts` pattern.

---

### MED-25: `loadGeneration.ts` Duplicates Config Construction from `AppContext.tsx`
**Reviewer**: Maintainability (M-12)
**Files**: `src/lib/loadGeneration.ts:50-103`, `src/context/AppContext.tsx:437-499`

Both files contain parallel if/else chains for building sprite-type-specific config objects from flat API data.

**Action**: Extract `buildConfigForType(spriteType, data)` pure function shared by both call sites.

---

### MED-26: No Tests for Async Pipeline or Workflow Hooks
**Reviewer**: Maintainability (M-13)
**Files**: `src/hooks/useGenericWorkflow.ts`, `src/hooks/useRunWorkflow.ts`

The most complex async orchestration code (generate pipeline, multi-grid sequencing, abort controller) has zero test coverage. `runGeneratePipeline` is exported as a standalone async function and is straightforwardly testable.

**Cross-ref**: Maintainability-M17 notes the module-level `sharedAbortController` is a hidden global that could leak if not tested for concurrent usage.

**Action**: Add vitest tests for `runGeneratePipeline` with mocked fetch. Test abort controller lifecycle.

---

### MED-27: `tsconfig.json` Disables Unused Symbol Detection
**Reviewer**: Maintainability (M-8)
**Files**: `tsconfig.json:15-16`

`noUnusedLocals: false` and `noUnusedParameters: false` allow dead code to accumulate silently.

**Action**: Enable both flags. Address violations. Prefix intentionally unused params with `_`.

---

### MED-28: Module-Level Mutable `sharedAbortController` Is a Hidden Global
**Reviewer**: Maintainability (M-17)
**Files**: `src/hooks/useGenericWorkflow.ts:228,234`

Module-level mutable variable used for cross-component cancellation. If two workflow instances run concurrently, the second overwrites the controller and the first becomes un-cancellable.

**Cross-ref**: UX reviewer notes rapid sprite type switching during generation could trigger this edge case.

**Action**: Store AbortController in AppContext state (as a ref). Document single-active-workflow invariant.

---

## Low-Severity Findings

### LOW-1: No API Versioning Prefix
**Reviewer**: API (F13)
**File**: `server/index.js:47-55`

All routes at `/api/*` with no version prefix. Acceptable for local tool but limits future evolution.

---

### LOW-2: PUT /api/history/:id/settings Accepts Any JSON Shape
**Reviewer**: API (F14)
**File**: `server/routes/history.js:160-185`

`JSON.stringify(req.body)` stored verbatim with no schema validation.

---

### LOW-3: GalleryResponse Type Duplicated; Both Missing `contentDescription`
**Reviewer**: API (F15)
**Files**: `src/types/api.ts:77-92`, `src/components/gallery/GalleryPage.tsx:11-21`

Type defined in both files, neither includes `contentDescription` which the server returns.

---

### LOW-4: PUT /api/grid-presets/:id Silently Ignores `spriteType`
**Reviewer**: API (F16)
**File**: `server/routes/gridPresets.js:52-65`

`spriteType` excluded from UPDATE. Client sending a different type gets 200 with no indication.

---

### LOW-5: Zoom Modal Tool Buttons Lack Accessible Labels
**Reviewer**: UX (F12)
**Files**: `src/components/grid/SpriteZoomModal.tsx:361-375`

Emoji-based tool buttons lack `aria-label` and `aria-pressed` attributes.

---

### LOW-6: Generating Overlay Time Estimate Hardcoded at 60 Seconds
**Reviewer**: UX (F13)
**File**: `src/components/shared/GeneratingOverlay.tsx:36`

Hardcoded text disconnected from any actual timeout configuration.

---

### LOW-7: Slider Values Lack Contextual Explanations
**Reviewer**: UX (F14)
**File**: `src/components/grid/SpriteReview.tsx:509-535`

Speed and Scale sliders lack range annotations or descriptions for first-time users.

---

### LOW-8: Admin Form Has No Unsaved Changes Warning
**Reviewer**: UX (F15)
**Files**: `src/components/admin/GenericPresetsTab.tsx:107-116,268-279`

Clicking another preset replaces editing state without warning about unsaved changes.

---

### LOW-9: Add Sheet Modal Shows No Error State for Failed Fetch
**Reviewer**: UX (F11)
**Files**: `src/components/grid/AddSheetModal.tsx:37-60`

Grid links fetch failure caught silently; UI shows fallback with no error indication.

---

### LOW-10: Multi-Grid Run Has No Progress Bar or ETA
**Reviewer**: UX (F4)
**Files**: `src/App.tsx:118-133,169-187`

Multi-grid generation shows "Grid 1 of N" text but no visual progress bar or ETA.

---

### LOW-11: Test Files Served in Any Non-Production Environment
**Reviewer**: Security (F9)
**File**: `server/index.js:61-64`

`NODE_ENV !== 'production'` check is too broad; should be `=== 'development'`.

---

### LOW-12: Dependency Vulnerability in esbuild/vite (Dev Only)
**Reviewer**: Security (F10)
**File**: `package.json`

GHSA-67mh-4wv8-2f99 in esbuild <= 0.24.2 via vite 5.4.x. Dev server only.

---

### LOW-13: `_gridConfig` Unused Parameter Without Enforced Convention
**Reviewer**: Maintainability (M-9)
**File**: `src/hooks/useGridWorkflow.ts:18`

Underscore-prefixed unused parameter is convention only, not compiler-enforced (related to MED-27).

---

### LOW-14: `DEPRECATED` Constants Still in Active Use Paths
**Reviewer**: Maintainability (M-10)
**Files**: `src/lib/poses.ts:22,97`, `src/lib/spriteExtractor.ts:17`, `src/lib/gridConfig.ts:34-35`

`CELL_LABELS` and `ANIMATIONS` marked `@deprecated` but still imported and used as defaults in the extraction pipeline.

**Action**: Use DB values as primary source, fall back to constants only when unavailable.

---

### LOW-15: `GenericPresetsTab` Uses `window.confirm()` for Deletion
**Reviewer**: Maintainability (M-14)
**Files**: `src/components/admin/GenericPresetsTab.tsx:155`

`window.confirm()` is synchronous, non-styleable, and non-testable in jsdom environments.

---

### LOW-16: Missing `.env.example` File
**Reviewer**: Maintainability (M-15)
**File**: Referenced in `DEVELOPERS.md:38`

Developer guide says `cp .env.example .env.local` but the file may not be committed to the repo.

---

### LOW-17: `3x3-scene` Grid Key Inconsistency
**Reviewer**: Maintainability (M-16)
**Files**: `src/lib/gridConfig.ts:213`, `src/context/AppContext.tsx`

The `-scene` suffix on `'3x3-scene'` is unexplained and inconsistent with other grid keys.

---

### LOW-18: `UnifiedConfigPanel` Re-Imports All 4 Prompt Builders
**Reviewer**: Maintainability (M-18)
**Files**: `src/components/config/UnifiedConfigPanel.tsx:21-27`

All four prompt builder functions imported directly instead of using the existing `buildPromptForType` dispatcher.

---

### LOW-19: `historyExtras` Type Erasure Propagates Untyped Data to API
**Reviewer**: Maintainability (M-4)
**File**: `src/hooks/useGenericWorkflow.ts:47`

Noted also as MED-20. The `Record<string, any>` type is spread directly into the POST body.

---

### LOW-20: Add Sheet Modal Grid Fetch Error Silently Swallowed
**Reviewer**: UX (F11)
**File**: `src/components/grid/AddSheetModal.tsx:37-60`

Duplicate of LOW-9 from UX perspective; Maintainability impact: silent catch blocks mask integration failures.

---

## Cross-Pollination Matrix

| Theme | API | UX | Security | Maintainability | Notes |
|-------|-----|-----|----------|-----------------|-------|
| **Input validation gaps** | F4, F5, F7, F9, F14 | -- | F2, F5, F7 | M-1 | Model, mimeType, imageSize, state keys, settings JSON all lack validation |
| **Rate limiting gaps** | F9 | -- | F3 | -- | Only generate-grid is rate-limited; test-connection and all write endpoints unprotected |
| **Inconsistent REST patterns** | F2, F3, F6 | -- | F8 | -- | Mixed query/path params, mixed PUT/PATCH, divergent DELETE, inline vs middleware |
| **Client-server type drift** | F1, F4, F11, F15 | -- | -- | M-5, M-12 | Fabricated fields, ID type mismatch, missing response types, duplicated types |
| **Type safety erosion** | -- | -- | -- | M-2, M-3, M-4, M-18 | Generic abstractions trade compile-time safety for reduced duplication |
| **Destructive actions without confirmation** | -- | F3, F7 | -- | M-14 | Reset and sprite type switch discard work; inconsistent confirm patterns |
| **Missing async feedback** | -- | F2, F4, F8 | -- | M-17 | No loading states for restore, multi-grid, re-extract; abort controller edge cases |
| **No centralized API client** | F11 | -- | F6 | M-11, M-24 | Raw fetch everywhere; no typed wrappers; auth/headers require 10+ file changes |
| **Session/state management** | F7 | F2 | F6 | -- | Open state store + no auth + no session scoping = session bleed risk |
| **Archive security surface** | F12 | -- | F4, F6 | -- | Path traversal + no auth + no pagination + public static serving |
| **Credential hygiene** | -- | -- | F1 | M-1 | Real API key in working directory; model names hardcoded across codebase |
| **Dead-end UX flows** | -- | F1, F9, F10 | -- | -- | Custom mode blocked, no back-navigation, type-unaware empty states |
| **Test coverage gaps** | -- | -- | -- | M-13 | No tests for async pipeline, abort controller, workflow hooks |
| **Mega-component complexity** | -- | -- | -- | M-7 | SpriteReview.tsx at 865 lines with duplicated export logic |
| **Prompt accuracy** | -- | -- | -- | M-6 | Square-root column heuristic produces wrong coordinates for non-square grids |

---

## Root Cause Analysis

### 1. Missing Centralized Validation Layer
The server lacks a unified validation middleware. Each route independently validates (or fails to validate) input parameters. This produces the pattern seen across API-F2/F4/F5/F7/F9/F14 and Security-F2/F5/F7/F8: some endpoints validate, some don't, and the patterns are inconsistent. A schema validation middleware (e.g., Zod, Joi, or express-validator) applied per-route would eliminate this entire class of findings.

### 2. No Formal API Contract Documentation
There are no OpenAPI/Swagger specs, no shared TypeScript interfaces for all request/response shapes, and no documented invariants (pagination limits, valid enum values, immutable fields). This causes client-server type drift (API-F1/F4/F11/F15), undocumented behavior (API-F16, UX-F1), and security maintenance hazards (Security-F8). The Maintainability review (M-5, M-12) independently confirms that the client must infer API contracts from implementation.

### 3. Confirmation/Feedback Patterns Not Standardized
Each component independently decides whether to confirm destructive actions and how to show async feedback. Gallery uses two-click confirm, Admin uses `window.confirm()`, Header uses neither. Some async operations show loading state (Admin save), others don't (re-extract). A shared pattern library (`useAsyncButton`, `useConfirmAction`) would standardize these.

### 4. Type Safety vs. Duplication Tradeoff Unresolved
The codebase has successfully reduced component duplication (4 config panels to 1, 4 workflow hooks to 1) but the generic abstractions use `Record<string, unknown>` and `as any` casts, losing compile-time safety. This is the central architectural tension: the data-driven approach (`SpriteTypeConfig`, `PresetTabConfig`) eliminates code duplication but introduces runtime type errors. A typed generic approach (`GenericPresetsTab<T>`) or discriminated union pattern would preserve both.

### 5. Security Posture Assumes Single Local User
The application has no authentication, no session scoping, no rate limiting on most endpoints, and serves archived files publicly. These are acceptable for a single-user local tool but create cascading risks if the deployment assumption changes. The assumption itself is undocumented.

### 6. No Client-Side API Abstraction
Every component and hook performs raw `fetch()` with manual headers and individual catch blocks. This means API URL changes, auth headers, timeout policies, or response type enforcement all require changes in 10+ files. The existing `geminiClient.ts` proves the pattern works but it's applied to only one endpoint.

---

## Recommended Action Priority

### Immediate (This Sprint)
| Priority | Action | Findings |
|----------|--------|----------|
| P0 | **Rotate the Gemini API key** in `.env.local` | CRIT-1 |
| P0 | **Add pre-commit hook** scanning for credential patterns (`AIzaSy` prefix) | CRIT-1 |
| P1 | **Add model allowlist** to `/api/generate-grid` and `/api/test-connection` | HIGH-1 |
| P1 | **Add MIME type allowlist** to history and generate endpoints | MED-2 |
| P1 | **Add imageSize/aspectRatio allowlists** | MED-3 |
| P1 | **Extract DEFAULT_MODEL constant** to single config location | HIGH-12 |

### Short-Term (Next 2-4 Weeks)
| Priority | Action | Findings |
|----------|--------|----------|
| P2 | **Apply global rate limiting** middleware with per-route overrides | HIGH-2, MED-9 |
| P2 | **Add path boundary check** to archive route | HIGH-3 |
| P2 | **Normalize preset ID types** (TEXT vs INTEGER) and URL patterns | HIGH-5, HIGH-6, MED-10 |
| P2 | **Add confirmation dialogs** for Reset, sprite type switch | HIGH-10, MED-15 |
| P2 | **Add loading indicators** for session restore | HIGH-9 |
| P2 | **Fix custom mode dead-end** in UnifiedConfigPanel | HIGH-8 |
| P2 | **Define VALID_STATE_KEYS** allowlist for `/api/state/:key` | MED-1 |
| P2 | **Fix promptBuilder column calculation** to use actual grid dimensions | MED-22 |
| P3 | **Remove fabricated fields** from GET /history/:id or persist real values | HIGH-4 |
| P3 | **Standardize DELETE responses** (404 on missing resource) | HIGH-7 |
| P3 | **Add typed generics to GenericPresetsTab** | HIGH-11, MED-19 |
| P3 | **Type historyExtras explicitly** | MED-20 |

### Medium-Term (1-3 Months)
| Priority | Action | Findings |
|----------|--------|----------|
| P3 | **Create `src/api/client.ts`** typed fetch wrapper | MED-24 |
| P3 | **Create schema validation middleware** (Zod/Joi) for all routes | Multiple |
| P3 | **Create HistoryDetailResponse** and other missing TypeScript types | MED-11, LOW-3 |
| P3 | **Add pagination** to GET /api/archive | MED-12 |
| P3 | **Add vitest tests** for `runGeneratePipeline` and abort controller | MED-26 |
| P3 | **Extract processSprite/detectPalette** from SpriteReview.tsx | MED-23 |
| P3 | **Enable noUnusedLocals/noUnusedParameters** in tsconfig | MED-27 |
| P3 | **Standardize confirmation patterns** across the app | MED-14, LOW-8, LOW-15 |
| P3 | **Add breadcrumb navigation** to workflow steps | MED-17 |
| P3 | **Normalize PUT/PATCH semantics** for partial updates | MED-7 |
| P3 | **Extract buildConfigForType** shared utility | MED-25 |
| P4 | **Store AbortController in AppContext** ref instead of module global | MED-28 |
| P4 | **Add async button state hook** (`useAsyncButton`) | MED-16 |
| P4 | **Make gallery empty states type-aware** | MED-18 |
| P4 | **Add bulk export confirmation** and ZIP bundle option | MED-13 |
| P4 | **Document local-only deployment assumption** | MED-4 |
| P4 | **Bind server to 127.0.0.1** explicitly | MED-4 |
| P4 | **Use bgMode from DB** instead of grid size heuristic | MED-21 |
| P4 | **Upgrade vite** to address esbuild CVE | LOW-12 |

---

## Positive Findings

The codebase demonstrates several strong practices that should be maintained:

1. **SQL injection prevention** — All SQL queries use parameterized statements (`?` placeholders) throughout. The `PRESET_TABLES` whitelist + `validatePresetType` middleware pattern is architecturally sound. (Security)

2. **CORS configuration** — CORS is restricted to a configurable allowlist defaulting to localhost origins. (Security)

3. **Body size limits** — Appropriately scoped per route (50MB for image routes, 1MB fallback). (Security)

4. **Gemini error sanitization** — Error responses from the Gemini API are sanitized before forwarding to the client (generic 502), preventing upstream error leakage. (Security)

5. **No client-side injection vectors** — No `dangerouslySetInnerHTML` usage in React components, no `eval()` or dynamic code execution in client-side code. (Security)

6. **Rate limiting on the costliest endpoint** — `express-rate-limit` is correctly applied to `/api/generate-grid`, the most expensive operation. (Security/API)

7. **Integer ID validation utility** — `parseIntParam` correctly validates integer IDs where applied. (API)

8. **Unified workflow abstraction** — The recent `useGenericWorkflow` refactor consolidated four duplicated workflow hooks into a single generic implementation, eliminating a major source of duplication flagged in previous rounds. (Maintainability)

9. **Editor settings with safe defaults** — `useEditorSettings` merges stored settings with `DEFAULTS`, gracefully handling missing or partial stored data. (UX/API)

10. **`.env.local` is gitignored** — The credential is not in the repository; the `.env.example` template correctly uses placeholder values. (Security)

11. **Comprehensive reducer test coverage** — `appReducer.test.ts` provides thorough testing of state management logic, serving as living documentation for the reducer's behavior. (Maintainability)

12. **Well-structured prompt builders** — Each sprite type has a dedicated prompt builder with clear, readable template logic. The prompt builder tests provide good coverage. (Maintainability)

13. **Effective `SpriteTypeConfig` pattern** — Despite the type safety tradeoff, the config-driven approach in `UnifiedConfigPanel` successfully eliminates four separate component files and makes adding new sprite types a config-only change. (Maintainability)

---

*Report compiled from 59 findings across 4 review domains (API: 16, UX: 15, Security: 10, Maintainability: 18).*
