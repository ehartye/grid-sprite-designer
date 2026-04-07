# Grid Sprite Designer -- Multi-Perspective Project Review

**Date:** 2026-03-07
**Reviewers:** Architecture (arch-reviewer), Code Quality (quality-reviewer), UX & Accessibility (ux-reviewer), Security & Backend (security-reviewer)
**Compiled by:** report-compiler

---

## Executive Summary

Grid Sprite Designer is a well-conceived creative tool that combines AI-powered image generation (via Google's Gemini API) with a structured grid-based workflow for producing pixel-art sprite sheets. The application has a clear vision -- configure a sprite, generate a grid via AI, extract individual sprites, preview animations, and manage results through a gallery. The codebase demonstrates thoughtful engineering in several areas: the reducer-based state management is well-structured with a clean action vocabulary, the sprite extraction algorithm using divider scoring is clever and robust, and the server-side architecture properly keeps the API key on the backend.

However, the project's primary structural challenge is the "four-way duplication" pattern that has emerged as it expanded from character sprites to buildings, terrain, and backgrounds. Each sprite type has its own workflow hook, config panel, prompt builder, and set of reducer actions -- all following the same template with only minor variations. The quality reviewer measured this at 95%+ code overlap across the four workflow hooks alone, totaling ~870 lines of near-identical code. This duplication inflates the codebase, increases the surface area for bugs (every fix must be applied four times), and makes adding a fifth sprite type require touching 8-10 files.

On the security front, the project is in reasonable shape for a local-use creative tool: the API key is properly server-proxied, SQL queries use parameterized statements for data values, and input validation exists at key endpoints. The main concerns are the absence of authentication (acceptable for local use, problematic if deployed), dynamic SQL table name construction from user input (validated but fragile as a pattern), missing server-side input validation on array sizes and field lengths, and the inherent prompt injection surface area in any user-to-AI pipeline.

---

## 1. Architecture & Structure

### 1.1 Component Hierarchy and Separation of Concerns

The project follows a clean layered architecture:

- **`src/context/AppContext.tsx`** -- Single reducer-based state store with well-typed actions
- **`src/hooks/`** -- Workflow orchestration hooks (one per sprite type + shared utilities)
- **`src/lib/`** -- Pure logic: prompt building, grid configuration, sprite extraction, image processing
- **`src/components/`** -- UI organized by function: config, grid, preview, gallery, admin, shared
- **`src/api/`** -- Thin client for the server-side Gemini proxy
- **`server/`** -- Express backend with SQLite persistence

This separation is generally well-maintained. The `lib/` layer is free of React dependencies and could theoretically be tested independently.

### 1.2 State Management

The `useReducer` + Context pattern in `AppContext.tsx` is appropriate for this application's complexity. Key observations:

- **Well-typed action discriminated union** (`src/context/AppContext.tsx:287-319`): 24 action types with proper payload typing
- **Monolithic state shape**: The `AppState` interface (`src/context/AppContext.tsx:114-218`) carries state for all four sprite types simultaneously, even though only one is active at a time. A discriminated union based on `spriteType` would reduce the state surface area and prevent cross-type field access bugs.
- **Side effect in context**: The `useEffect` for syncing `historyId` to the server (`src/context/AppContext.tsx:549-565`) silently swallows errors with `.catch(() => {})`. While this is pragmatic for a non-critical persistence feature, it means session restore failures are invisible.
- **No selector pattern**: Components receive the entire state via `useAppContext()` and destructure what they need. For a project of this size this is acceptable, but as complexity grows, this causes unnecessary re-renders.

### 1.3 The Four-Way Duplication Problem (Critical)

This is the most significant architectural concern, identified from every review perspective. The quality reviewer's detailed analysis confirmed 95%+ code overlap:

| Layer | Character | Building | Terrain | Background |
|-------|-----------|----------|---------|------------|
| Workflow Hook | `useGridWorkflow.ts` (225 lines) | `useBuildingWorkflow.ts` (216 lines) | `useTerrainWorkflow.ts` (216 lines) | `useBackgroundWorkflow.ts` (~217 lines) |
| Config Panel | `ConfigPanel.tsx` (278 lines) | `BuildingConfigPanel.tsx` (265 lines) | `TerrainConfigPanel.tsx` | `BackgroundConfigPanel.tsx` |
| Prompt Builder | `promptBuilder.ts` (246 lines) | `buildingPromptBuilder.ts` (103 lines) | `terrainPromptBuilder.ts` | `backgroundPromptBuilder.ts` |
| Reducer Actions | SET_CHARACTER, LOAD_PRESET, SET_PRESETS | SET_BUILDING, LOAD_BUILDING_PRESET, SET_BUILDING_PRESETS | SET_TERRAIN, LOAD_TERRAIN_PRESET, SET_TERRAIN_PRESETS | SET_BACKGROUND, LOAD_BACKGROUND_PRESET, SET_BACKGROUND_PRESETS |
| Admin Tab | `CharacterPresetsTab.tsx` | `BuildingPresetsTab.tsx` | `TerrainPresetsTab.tsx` | `BackgroundPresetsTab.tsx` |
| Server Routes | character preset CRUD | building preset CRUD | terrain preset CRUD | background preset CRUD |
| DB Tables | `character_presets`, `character_grid_links` | `building_presets`, `building_grid_links` | `terrain_presets`, `terrain_grid_links` | `background_presets`, `background_grid_links` |

The workflow hooks are ~95% identical. The only differences between them are:
1. Which state field is read (`state.character` vs `state.building` vs `state.terrain` vs `state.background`)
2. Which prompt builder is called
3. Which grid config function is used
4. The `spriteType` string passed to the history API

Everything else -- the abort controller pattern, the generate/extract/save/archive pipeline, the reExtract function, the reset and setStep callbacks -- is copied verbatim. This means bug fixes must be applied four times, new features require four implementations, and there is constant risk of inconsistent behavior between sprite types.

### 1.4 Data Flow: Frontend to Backend

The data flow is straightforward and well-structured:

1. **Configure**: User fills config panel, state updates via reducer
2. **Generate**: Workflow hook builds template image + prompt, sends to `/api/generate-grid`
3. **Server proxies**: Express forwards to Gemini API with the server-side API key
4. **Extract**: Client-side `spriteExtractor.ts` detects grid lines and crops individual sprites
5. **Persist**: Results saved to SQLite via `/api/history` + archived to disk via `/api/archive`

The client-side extraction using canvas APIs is a pragmatic choice -- it avoids server-side image processing dependencies and enables instant re-extraction with different parameters.

### 1.5 Recommendations

- **Extract a generic workflow hook factory** that takes sprite-type-specific configuration (state accessor, prompt builder, grid config builder) and returns the standard generate/extract/save pipeline
- **Consider a discriminated union for the sprite-type state** to make it impossible to accidentally access `state.building` when `spriteType` is 'character'
- **Consolidate server-side preset CRUD** into a single generic handler parameterized by type metadata

---

## 2. Code Quality & Maintainability

*Detailed findings from quality-reviewer, with 16 specific issues identified across the codebase.*

### 2.1 Code Duplication (Critical -- Quality Finding #1, #4, #5)

As detailed in the architecture section, the four-way duplication is the most pressing code quality concern. The quality reviewer measured the total duplicated code and identified three specific layers:

**Workflow Hooks (~870 lines duplicated)**: The four hooks at `src/hooks/useGridWorkflow.ts`, `useBuildingWorkflow.ts`, `useTerrainWorkflow.ts`, and `useBackgroundWorkflow.ts` share identical pipeline logic including abort controller management, template generation, API calls, sprite extraction, history saving, and disk archiving.

**Config Panels (~1,000+ lines duplicated)**: `ConfigPanel.tsx` (278 lines) and `BuildingConfigPanel.tsx` (265 lines) share identical patterns for preset selection logic (compare `ConfigPanel.tsx:55-79` with `BuildingConfigPanel.tsx:50-76`), field update callbacks (compare `ConfigPanel.tsx:45-53` with `BuildingConfigPanel.tsx:40-48`), and UI structure (mode toggle, preset dropdown, name/description, grid link selector, image size, generate button).

**Prompt Builders (~80% overlap)**: `promptBuilder.ts` and `buildingPromptBuilder.ts` share the same field-to-prompt mapping pattern, differing only in field names (`character.equipment` vs `building.details`), template headers, and guidance section labels.

### 2.2 Type Safety Violations (High -- Quality Finding #2)

The `catch (e: any)` pattern appears 12 times across all four workflow hooks:

- `useGridWorkflow.ts`: lines 153, 171, 176
- `useBuildingWorkflow.ts`: lines 147, 165, 170
- `useTerrainWorkflow.ts`: lines 147, 165, 170
- `useBackgroundWorkflow.ts`: lines 148, 166, 171

This disables TypeScript error discrimination and prevents distinguishing between network errors, validation failures, and auth issues. The `tsconfig.json` exacerbates this with `noUnusedLocals: false` and `noUnusedParameters: false` (lines 15-16), allowing dead code and unused parameters to accumulate unnoticed.

### 2.3 Error Handling Inconsistency (High -- Quality Finding #3)

Error handling follows an inconsistent dual pattern within the same workflow:

**Outer try-catch** (generation errors) -- properly dispatches to UI:
```typescript
// useGridWorkflow.ts:176-178
} catch (err: any) {
  dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
}
```

**Inner try-catch** (save/archive errors) -- silently swallowed:
```typescript
// useGridWorkflow.ts:153-156
} catch (e: any) {
  if (e?.name === 'AbortError') return;
  console.warn('Failed to save to history');  // No dispatch, no user feedback
}
```

**Failure scenario**: User generates sprites successfully, sees "Done!" in the UI, but a network error during the `/api/history` POST means sprites are extracted but not persisted. The user has no indication that their work was not saved. Closing the app results in data loss.

### 2.4 No Centralized API Client (Medium -- Quality Finding #16)

The four workflow hooks contain duplicated `fetch()` calls for three endpoints each (`/api/history`, `/api/history/:id/sprites`, `/api/archive`). This means 12 nearly identical fetch blocks spread across the hooks, each with its own error handling (or lack thereof). A centralized API client module would consolidate error handling, enable request logging/monitoring, and make endpoint changes a single-point edit.

### 2.5 Unsafe JSON.parse Without Try-Catch (Medium -- Quality Finding #8)

Several server endpoints parse stored JSON without error handling:

- `server/index.js:304-305`: `JSON.parse(r.cell_labels)` and `JSON.parse(r.cell_groups)` in GET `/api/grid-presets` -- crashes on corrupted data
- `server/index.js:388-389`: Same issue in GET `/api/presets/:type/:id/grid-links`

Compare with `server/index.js:539-543` where `JSON.parse(row.settings)` is correctly wrapped in try-catch with graceful fallback to `null`.

### 2.6 Test Coverage (High -- Quality Finding #10)

The project has critically limited test coverage:

- **One test file**: `tests/extraction.spec.ts` (347 lines) -- Playwright-based sprite extraction validation
- **What IS tested**: Sprite extraction metrics (bleed, dark bands, dimensions), posterization quality
- **What IS NOT tested** (~95% of application):
  - Workflow state machine transitions
  - Reducer logic in `AppContext.tsx`
  - Config panel validation and form submission
  - API endpoints (no server tests at all)
  - Preset loading and application
  - Error recovery and state rollback
  - Gallery, admin, and modal behavior
  - Database operations and archive functionality

There are no Jest/Vitest unit tests, no component tests, and no API mocking. The pure functions in `src/lib/` are ideal candidates for unit testing.

### 2.7 TypeScript vs JavaScript Split

The server code (`server/index.js` at 711 lines, `server/db.js` at 498+ lines, `server/routes/generate.js` at 169 lines) is plain JavaScript while the frontend is fully typed TypeScript. This creates an asymmetric confidence level: frontend changes get compile-time validation, backend changes do not. Given that the server handles sensitive operations (API key management, database queries, file system writes), TypeScript would provide meaningful safety improvements.

### 2.8 Naming and Legacy Issues

- **Legacy database naming**: The `generations` table uses `character_name` and `character_description` for all sprite types. The history API at `server/index.js:67-74` returns data under a `character` key even for buildings and terrain.
- **Well-documented constants**: The `spriteExtractor.ts` uses several magic numbers (`DIVIDER_THRESHOLD = 0.80`, `MIN_CUT_RUN = 1`, `MERGE_GAP = 5`, `MIN_CONTENT_SPAN = 20`) that are properly named and documented with comments.
- **Inconsistent API error responses** (Quality Finding #15): Endpoints return a mix of `400`, `404`, and silent success (`[]`) with `{ error: string }` payloads that are functional but not standardized.

---

## 3. UX & Accessibility

### 3.1 Workflow Design

The configure-generate-review-preview workflow is well-designed and intuitive:

- **Clear visual progression**: Each step is a distinct view managed by the `WorkflowStep` state
- **Run workflow**: The multi-grid batch generation with skip/next/cancel controls (`App.tsx:220-244`) is a good power-user feature
- **Session persistence**: The auto-restore from the last session (`App.tsx:31-156`) provides continuity

### 3.2 Component Composition

- **Shared components**: `GeneratingOverlay`, `StatusBanner`, `GridLinkSelector`, and `SpriteZoomModal` are well-extracted for reuse
- **Config panel duplication**: The four config panels share the same visual structure (mode toggle, preset selector, name/description fields, style notes, grid link selector, image size, generate button) but are separate components. A shared `ConfigPanelLayout` component could reduce duplication while keeping type-specific fields flexible.

### 3.3 Accessibility Concerns (High Impact)

Based on code review (not runtime testing):

- **Labels are present**: Form controls use `<label htmlFor>` consistently (`ConfigPanel.tsx` lines 121, 140, 153, etc.)
- **Missing ARIA attributes**: The segmented controls (`ConfigPanel.tsx:103-114`) use `<button>` elements without `role="radiogroup"` or `aria-pressed` attributes. Screen readers cannot distinguish these from regular buttons.
- **No keyboard navigation for sprite grid**: The `SpriteReview` and `SpriteGrid` components likely rely on click handlers without keyboard equivalents for sprite selection and zoom
- **No skip navigation**: No skip-to-content link for keyboard users
- **Color contrast**: The use of CSS variables (`--text-secondary`, `--text-muted`) is good for theming but contrast ratios need verification
- **Modal focus management**: The zoom modal and add-sheet modal should trap focus and return focus on close -- this needs verification

### 3.4 Loading and Error States

- **GeneratingOverlay**: Provides clear feedback during AI generation with a spinner
- **StatusBanner**: Color-coded status messages (info/success/error/warning) provide good feedback
- **Run progress**: Grid count display ("Grid 2 of 5 -- Walk Cycle") during batch runs is helpful
- **Missing loading states**: Preset fetches on component mount (`ConfigPanel.tsx:30-35`) have no loading indicator -- the UI jumps when presets arrive
- **Silent save failures**: As noted in Section 2.3, users receive no feedback when history/archive saves fail after a successful generation (cross-referenced with quality-reviewer Finding #3)

### 3.5 Responsive Design

- The CSS (`styles/global.css`, `styles/admin.css`) uses a single-column layout that should work on various widths
- No explicit responsive breakpoints were observed in the component code -- the admin page with its tabbed layout may be challenging on mobile

---

## 4. Security & Backend

### 4.1 API Key Management (Good)

The Gemini API key is properly managed:

- Loaded from `.env.local` on the server (`server/index.js:1-2`)
- Server exits if key is missing (`server/index.js:22-25`)
- Passed to Gemini via `x-goog-api-key` header server-side (`server/routes/generate.js:15`)
- Never exposed to the client -- `geminiClient.ts` only calls `/api/generate-grid` on the local server

### 4.2 SQL Identifier Injection Pattern (Critical Pattern Risk -- Quality Finding #7)

Parameterized queries are used consistently for data values, which is good. However, dynamic SQL table/column name construction exists in multiple locations:

- `server/index.js:279`: `` `DELETE FROM ${config.linkTable} WHERE ${config.fk} = ?` ``
- `server/index.js:369-378`: Grid link SELECT with `` FROM ${table} l JOIN ... WHERE l.${fk} = ? ``
- `server/index.js:402-405`: Grid link INSERT with `` INSERT INTO ${table} (${fk}, ...) ``
- `server/index.js:419-420`: Grid link UPDATE with `` UPDATE ${table} SET ... ``

**Current mitigation**: The `type` parameter is validated against `VALID_LINK_TYPES` (line 363) and `PRESET_TABLES` (line 182-187) whitelists before being used. **This means the current code is not exploitable.** However, the pattern is fragile -- future developers may copy this template without adding the whitelist check, or a case-sensitivity issue could bypass validation.

**Better approach**: Use a prepared query mapping where queries are pre-defined per type, eliminating string interpolation entirely.

### 4.3 Missing Server-Side Input Validation (Critical -- Quality Finding #6)

Several endpoints lack validation on request body contents:

**POST `/api/history/:id/sprites`** (`server/index.js:107-128`):
- No check that `sprites` is an array
- No limit on array length (could send 10,000+ sprite objects)
- No limit on `imageData` size per sprite
- No validation that `cellIndex` is within valid range

**POST `/api/presets/:type`** (`server/index.js:189-226`):
- No validation on name, genre, or description field lengths

**POST `/api/archive`** (`server/index.js:593-633`):
- No check on `filledGridImage` size before writing to disk
- The 50MB JSON body limit (`server/index.js:19`) is necessary for base64 images but allows large payloads

### 4.4 Prompt Injection (Inherent Risk)

User input flows directly into AI prompts:
- `promptBuilder.ts:158-161`: Character name and description are interpolated into the prompt string
- `buildingPromptBuilder.ts:29-35`: Same pattern for building fields

This is an inherent risk in any user-to-AI pipeline. For a local creative tool, this is acceptable. If the tool were multi-tenant, prompt injection could be used to generate unintended content or extract system prompt details.

### 4.5 CORS Configuration (Quality Finding #12)

```js
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
```

Appropriately restrictive for local development. Should be environment-variable-driven for production:
```js
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',');
```

### 4.6 Error Information Leakage (Quality Finding #13)

The global error handler (`server/index.js:672-675`) logs `console.error('[Server] Unhandled error:', err)` which includes full stack traces. While the client response is properly sanitized to `{ error: 'Internal server error' }`, the server logs could expose file paths, SQL queries, and environment details in production monitoring systems.

### 4.7 Process Killing Logic (Quality Finding #14)

The EADDRINUSE handler (`server/index.js:681-711`) uses `execSync` to find and kill processes on the conflicting port, including OS-specific code for Windows (`netstat`/`taskkill`) and Unix (`lsof`/`kill`). It uses `SIGKILL` (ungraceful) rather than `SIGTERM` (graceful). This is acceptable for a dev tool but should be replaced by a process manager (PM2, systemd) in production.

### 4.8 Authentication

There is no authentication or authorization. Every endpoint is publicly accessible to anyone who can reach the server. This is acceptable for a local development tool but would be a critical issue for any shared deployment.

### 4.9 Dependency Review

Core dependencies are standard and well-maintained:
- `express@^4.21.0` -- stable, widely audited
- `better-sqlite3@^11.0.0` -- reputable SQLite binding
- `react@^18.3.1` -- current stable
- `vite@^5.4.2` -- current build tool
- `sharp@^0.34.5` -- in devDependencies, used for test image processing

No obviously outdated or vulnerable packages based on version ranges.

---

## 5. Cross-Cutting Themes

These are patterns and concerns identified from multiple review perspectives, representing the strongest signals in the review.

### 5.1 Four-Way Duplication is the Dominant Issue

Every reviewer identified this from their own angle:
- **Architecture**: Unsustainable pattern for adding new sprite types; violates DRY at the structural level
- **Code Quality**: ~2,000+ lines of near-identical code across workflow hooks, config panels, prompt builders, admin tabs, and server routes; bug fixes must be applied 4x
- **UX**: The four config panels have identical layouts with minor field variations, presenting a maintenance burden for consistent UX updates
- **Security**: The duplicated server routes mean security fixes (input validation, error handling) must be applied four times independently

The quality reviewer's cross-pollination matrix confirms this is the single finding that registers as critical across all four review perspectives.

### 5.2 Silent Error Failures Create Data Loss Risk

Three reviewers converged on this from different angles:
- **Code Quality**: `catch (e: any)` with `console.warn()` only -- no state dispatch, no user notification (12 instances across `useGridWorkflow.ts:153,171`, `useBuildingWorkflow.ts:147,165`, `useTerrainWorkflow.ts:147,165`, `useBackgroundWorkflow.ts:148,166`)
- **UX**: Users see "Done!" after generation but have no way to know if their work was actually persisted
- **Security**: Untyped errors make it impossible to discriminate between network failures, validation errors, and auth issues

The specific failure scenario: a user generates sprites successfully, the UI shows success, but a network error during the `/api/history` POST means sprites are lost. The user has no indication until they try to find their work in the gallery.

### 5.3 Backend Code Lacks TypeScript and Input Validation

Two interrelated concerns identified by multiple reviewers:
- **Quality + Security**: The server handles sensitive operations (API key, DB queries, file writes) without compile-time type checking
- **Security + Quality**: POST endpoints accept unbounded arrays and field lengths, with no validation on sprite count, image data size, or text field lengths
- **Architecture**: The 50MB JSON body limit is necessary for base64 images but creates a large attack surface without per-field validation

### 5.4 Test Coverage is a Prerequisite Blocker

Multiple reviewers noted that the test gap blocks safe refactoring:
- **Quality**: Only 1 test file covering ~5% of the application; no unit tests for pure library functions
- **Architecture**: The duplication problem demands refactoring, but refactoring without tests is high-risk
- **Security**: No tests for input validation, error handling paths, or endpoint behavior

The pure logic in `src/lib/` (prompt building, grid config computation, image preprocessing) is ideal for unit testing and would be the highest-ROI testing investment, providing the safety net needed for the consolidation recommended in P1.

### 5.5 Database Schema Uses Legacy Naming

The `generations` table uses `character_name` and `character_description` for all sprite types. The history API at `server/index.js:67-74` returns data under a `character` key even for buildings and terrain. This naming confusion pervades the data layer and was noted by both the architecture and quality reviewers as adding cognitive overhead when working with non-character sprite types.

---

## 6. Prioritized Recommendations

Ranked by impact multiplied by effort, with the highest-value items first.

### P1: Extract Generic Workflow Hook (Critical Impact, Medium Effort)

**What:** Create a `useGenericWorkflow(config)` factory that encapsulates the common generate/extract/save/archive pipeline. Each sprite type provides a small config object specifying its state accessor, prompt builder, grid config builder, and spriteType string.

**Why:** Identified by all four reviewers. Architecture (structural duplication), Quality (DRY violation, 870+ lines -- Finding #1), UX (inconsistent behavior risk), Security (fix-it-four-times problem). This is the single highest-impact change.

**Effort:** Medium
**Impact:** Critical

### P2: Add Unit Tests for Core Library (High Impact, Medium Effort)

**What:** Add Vitest/Jest unit tests for `src/lib/promptBuilder.ts`, `src/lib/gridConfig.ts`, `src/lib/chromaKey.ts`, and `src/lib/imagePreprocess.ts`. These are pure functions with no React or DOM dependencies.

**Why:** Identified by quality-reviewer (Finding #10, test coverage at ~5%), arch-reviewer (refactoring safety net). Tests are a prerequisite for safely executing P1.

**Effort:** Medium
**Impact:** High

### P3: Fix Silent Error Failures (High Impact, Small Effort)

**What:** Replace `console.warn()` in the 12 inner catch blocks across workflow hooks with proper error dispatching:
```typescript
dispatch({ type: 'SET_STATUS', message: 'Sprites generated but save failed. Try exporting manually.', statusType: 'warning' });
```

**Why:** Identified by quality-reviewer (Finding #3), ux-reviewer (user feedback), security-reviewer (error discrimination). Prevents silent data loss. The `StatusBanner` component already supports warning-level messages.

**Effort:** Small
**Impact:** High

### P4: Add Server-Side Input Validation (High Impact, Small Effort)

**What:** Add validation to POST/PUT endpoints: check that `sprites` is an array with bounded length, validate `cellIndex` ranges, add field length limits for text inputs, validate `cols`/`rows` ranges on grid presets.

**Why:** Identified by quality-reviewer (Finding #6) and security-reviewer. Without validation, the `/api/history/:id/sprites` endpoint accepts unlimited sprite arrays with unlimited image data sizes.

**Effort:** Small
**Impact:** High

### P5: Consolidate Server-Side Preset Routes (High Impact, Small Effort)

**What:** Replace the four sets of preset CRUD handlers with a single generic handler parameterized by the `PRESET_TABLES` config map. Extend the existing map (`server/index.js:182-187`) with column mappings and use a data-driven approach.

**Why:** Identified by arch-reviewer (backend duplication), quality-reviewer (DRY), security-reviewer (single point for validation). Reduces ~400 lines to ~100.

**Effort:** Small
**Impact:** High

### P6: Convert Server Code to TypeScript (High Impact, Medium Effort)

**What:** Rename `server/*.js` to `.ts`, add type annotations for request/response shapes and database row types. Use `tsx` or `ts-node` for running.

**Why:** Identified by quality-reviewer (type safety gap, Finding #2), security-reviewer (catch validation errors at compile time). The backend handles the most sensitive operations where type safety has the most security value.

**Effort:** Medium
**Impact:** High

### P7: Add ARIA Attributes to Interactive Controls (Medium Impact, Small Effort)

**What:** Add `role="radiogroup"` to segmented control containers, `aria-pressed` to toggle buttons, keyboard navigation for the sprite grid, and focus trapping in modals.

**Why:** Identified by ux-reviewer (accessibility). Makes the tool usable for keyboard-only and screen reader users.

**Effort:** Small
**Impact:** Medium

### P8: Enable Stricter TypeScript Settings (Medium Impact, Small Effort)

**What:** Set `noUnusedLocals: true` and `noUnusedParameters: true` in `tsconfig.json`. Fix any resulting errors (likely minimal).

**Why:** Identified by quality-reviewer (Finding #9). Prevents dead code accumulation and makes refactoring safer by surfacing unused code.

**Effort:** Small
**Impact:** Medium

### P9: Wrap JSON.parse Calls with Try-Catch (Medium Impact, Small Effort)

**What:** Add error handling to all `JSON.parse()` calls in server endpoints, particularly in GET `/api/grid-presets` (`server/index.js:304-305`) and GET `/api/presets/:type/:id/grid-links` (`server/index.js:388-389`). Fall back to empty arrays on parse failure.

**Why:** Identified by quality-reviewer (Finding #8). Prevents 500 errors from corrupted database data.

**Effort:** Small
**Impact:** Medium

### P10: Rename Legacy Database Fields (Medium Impact, Small Effort)

**What:** Rename `character_name`/`character_description` in the `generations` table to `content_name`/`content_description`. Update the history API response to use a generic `content` key instead of `character`. Add a database migration.

**Why:** Identified by quality-reviewer (naming confusion), arch-reviewer (data model integrity). Prevents confusion as the project grows.

**Effort:** Small
**Impact:** Medium

### P11: Create a Shared Config Panel Layout Component (Medium Impact, Medium Effort)

**What:** Extract the common config panel structure (mode toggle, preset dropdown, name/description, style notes, grid link selector, image size, generate button) into a reusable `ConfigPanelLayout` component that accepts type-specific fields as children or render props.

**Why:** Identified by ux-reviewer (consistent UX), quality-reviewer (Finding #4, UI duplication). Natural companion to P1.

**Effort:** Medium
**Impact:** Medium

### P12: Create Centralized API Client (Medium Impact, Small Effort)

**What:** Extract the duplicated `fetch()` calls from workflow hooks into a centralized `src/api/client.ts` module with methods for `saveHistory()`, `saveSprites()`, `archiveToDisk()`, with consistent error handling and abort signal support.

**Why:** Identified by quality-reviewer (Finding #16). Consolidates 12 nearly identical fetch blocks into 3 reusable functions.

**Effort:** Small
**Impact:** Medium

### P13: Standardize API Error Responses (Low Impact, Small Effort)

**What:** Define a consistent error response format across all endpoints:
```json
{ "status": "error", "code": "INVALID_ID", "message": "User-friendly message" }
```

**Why:** Identified by quality-reviewer (Finding #15). Makes client-side error handling more reliable and consistent.

**Effort:** Small
**Impact:** Low

### P14: Environment-Based CORS Configuration (Low Impact, Small Effort)

**What:** Replace hardcoded CORS origins with `process.env.CORS_ORIGINS`.

**Why:** Identified by quality-reviewer (Finding #12). Required before any non-localhost deployment.

**Effort:** Small
**Impact:** Low

### P15: Add Loading States for Async Operations (Low Impact, Small Effort)

**What:** Add loading indicators for preset fetching, grid link loading, and gallery pagination.

**Why:** Identified by ux-reviewer. Prevents the UI "jump" when async data arrives.

**Effort:** Small
**Impact:** Low

---

## Cross-Pollination Matrix

This matrix shows which findings were independently identified or confirmed by multiple reviewers:

| Finding | Quality | Architecture | UX | Security |
|---------|---------|--------------|----|----|
| 4x Workflow Hook Duplication | CRITICAL | CRITICAL | MEDIUM | CRITICAL |
| `catch (e: any)` Type Safety | HIGH | MEDIUM | HIGH | HIGH |
| Silent Error Failures | HIGH | MEDIUM | HIGH | MEDIUM |
| Config Panel Duplication | HIGH | MEDIUM | HIGH | -- |
| Missing Input Validation | HIGH | MEDIUM | MEDIUM | CRITICAL |
| SQL Identifier Pattern | -- | MEDIUM | -- | CRITICAL |
| Unsafe JSON.parse | HIGH | -- | -- | MEDIUM |
| Limited Test Coverage | HIGH | MEDIUM | HIGH | HIGH |
| No Centralized API Client | HIGH | HIGH | -- | MEDIUM |
| CORS Hardcoded | MEDIUM | -- | -- | HIGH |
| Error Log Leakage | MEDIUM | -- | -- | HIGH |

---

## Appendix: Files Reviewed

### Frontend (45 files)
- `src/App.tsx` -- Root component, workflow routing
- `src/context/AppContext.tsx` -- State management (reducer, actions, types)
- `src/hooks/useGridWorkflow.ts` -- Character generation workflow
- `src/hooks/useBuildingWorkflow.ts` -- Building generation workflow
- `src/hooks/useTerrainWorkflow.ts` -- Terrain generation workflow
- `src/hooks/useBackgroundWorkflow.ts` -- Background generation workflow
- `src/hooks/useRunWorkflow.ts` -- Multi-grid batch workflow
- `src/hooks/useAddSheet.ts` -- Add sheet to existing generation
- `src/hooks/useEditorSettings.ts` -- Per-generation editor settings
- `src/lib/promptBuilder.ts` -- Character prompt construction
- `src/lib/buildingPromptBuilder.ts` -- Building prompt construction
- `src/lib/terrainPromptBuilder.ts` -- Terrain prompt construction
- `src/lib/backgroundPromptBuilder.ts` -- Background prompt construction
- `src/lib/spriteExtractor.ts` -- Grid detection and sprite cropping
- `src/lib/gridConfig.ts` -- Grid dimension and template configuration
- `src/lib/templateGenerator.ts` -- Template image generation
- `src/lib/chromaKey.ts` -- Chroma key processing
- `src/lib/imagePreprocess.ts` -- Image posterization
- `src/lib/poses.ts` -- Default character pose labels
- `src/lib/promptForType.ts` -- Prompt type dispatch
- `src/api/geminiClient.ts` -- Server API client
- `src/components/config/ConfigPanel.tsx` -- Character config UI
- `src/components/config/BuildingConfigPanel.tsx` -- Building config UI
- `src/components/config/TerrainConfigPanel.tsx` -- Terrain config UI
- `src/components/config/BackgroundConfigPanel.tsx` -- Background config UI
- `src/components/grid/SpriteReview.tsx` -- Sprite review/editing
- `src/components/grid/SpriteGrid.tsx` -- Sprite grid display
- `src/components/grid/SpriteZoomModal.tsx` -- Sprite zoom modal
- `src/components/grid/AddSheetModal.tsx` -- Add sheet modal
- `src/components/shared/GeneratingOverlay.tsx` -- Loading overlay
- `src/components/shared/StatusBanner.tsx` -- Status messages
- `src/components/shared/GridLinkSelector.tsx` -- Grid preset selector
- `src/components/preview/AnimationPreview.tsx` -- Animation preview
- `src/components/gallery/GalleryPage.tsx` -- Gallery view
- `src/components/admin/AdminPage.tsx` -- Admin panel
- `src/components/admin/CharacterPresetsTab.tsx` -- Character preset admin
- `src/components/admin/BuildingPresetsTab.tsx` -- Building preset admin
- `src/components/admin/TerrainPresetsTab.tsx` -- Terrain preset admin
- `src/components/admin/BackgroundPresetsTab.tsx` -- Background preset admin
- `src/components/admin/GridPresetsTab.tsx` -- Grid preset admin
- `src/components/admin/LinkedGridPresets.tsx` -- Grid link management
- `src/components/admin/CellRangeSelector.tsx` -- Cell range picker
- `src/components/run/RunBuilderPage.tsx` -- Run configuration
- `src/components/layout/AppHeader.tsx` -- App header/navigation

### Backend (3 files, ~1,400 LOC)
- `server/index.js` (711 lines) -- Express server, all routes
- `server/db.js` (498+ lines) -- SQLite schema, migrations, seed data
- `server/routes/generate.js` (169 lines) -- Gemini API proxy

### Tests (1 file)
- `tests/extraction.spec.ts` (347 lines) -- Playwright sprite extraction tests

### Configuration
- `package.json` -- Dependencies and scripts
- `tsconfig.json` -- TypeScript configuration
