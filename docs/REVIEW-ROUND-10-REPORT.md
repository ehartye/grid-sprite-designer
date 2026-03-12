# Review Round 10 Report

## 1. Executive Summary

This report consolidates independent findings from four specialized reviewers examining the Grid Sprite Designer codebase: **Performance & Rendering**, **Accessibility (a11y) Compliance**, **State Architecture & Data Flow**, and **Error Resilience & Recovery**. A total of **57 findings** were identified across **21 HIGH**, **27 MEDIUM**, and **9 LOW** severity items.

The most critical convergence point is the **monolithic AppContext**, independently flagged by performance (P-1), state (S-1), and accessibility (A11Y cross-notes) reviewers. Every state change -- regardless of which field changed -- triggers a full component tree re-render, causing unnecessary canvas redraws, stale screen reader announcements, and wasted CPU cycles on sprite reprocessing. This single architectural decision is the root cause or amplifying factor behind at least 12 other findings.

The second major theme is **missing user-facing error communication**. The error-resilience reviewer found that sprite save, gallery delete, session sync, and migration failures are all silently swallowed or logged only to console. Meanwhile, the accessibility reviewer found that the one place errors *are* shown (StatusBanner) uses `aria-live="polite"` for all severities, meaning screen reader users are not interrupted for critical failures. These findings compound: errors that are already hard to notice visually are invisible to assistive technology users.

The third theme is **expensive synchronous image processing on the main thread**. The performance reviewer identified that every settings slider change triggers 36 full PNG re-encodes synchronously (P-4), animation frames redraw checkerboard patterns from scratch (P-3), and gallery loads re-extract sprites from raw grid images even when pre-extracted sprites exist in the database (P-14). The accessibility reviewer notes that these blocking operations freeze the UI with no `aria-busy` indicator (A11Y-08), making the app appear broken to assistive technology users.

The codebase shows positive patterns in several areas: the recent `useGenericWorkflow` consolidation eliminated four duplicated workflow hooks, the `UnifiedConfigPanel` reduced config panel duplication, and the `ErrorBoundary` component exists (even if it needs granularity improvements). The `useModalFocus` hook implements focus trapping correctly where applied.

---

## 2. High-Severity Findings

### H1. Monolithic AppContext causes full-tree re-renders on every state change
**Reviewers**: Performance (P-1), State (S-1)
**File**: `src/context/AppContext.tsx:577-583`
**Details**: The entire app state -- sprites[], base64 image strings, all 4 type configs, 5 preset arrays, workflow fields -- lives in a single context value. Every `dispatch` re-renders ALL consumers including `SpriteGrid` (up to 36 cells), `AnimationPreview` canvas loop, `UnifiedConfigPanel`, `GalleryPage`, and `AppHeader`, even when only an unrelated field like `status` changes. The state reviewer additionally notes that `loadGenerationIntoState` fires 6-8 sequential `dispatch()` calls (lines 42-196), each triggering a separate reducer pass.
**Cross-refs**: P-10 (validationMessage memo depends on entire state), A11Y cross-note (unnecessary re-renders can trigger stale screen reader announcements)

### H2. Module-level mutable singletons for AbortController shared across hook instances
**Reviewers**: State (S-2), Error (E-4 related)
**File**: `src/hooks/useGenericWorkflow.ts:207-221`
**Details**: `activeAbortController` and `activeGenerating` are module-level variables shared across all `useGenericWorkflow` instances. A race between concurrent callers could leave `activeGenerating = true` permanently, blocking all future generations (line 246 silently returns). In React 18 Strict Mode, the cleanup effect aborts the controller on the first unmount; the second mount cannot abort a stale controller. If `activeGenerating` is stuck, subsequent generation attempts fail silently with no user-visible error.
**Cross-refs**: E-4 (preset fetch failure aborts entire run silently), P-1 (module-level state bypasses React reconciliation)

### H3. Gallery thumbnails transferred as full base64 in list response; N+1 query pattern
**Reviewer**: Performance (P-2)
**File**: `server/routes/gallery.js:29-35`
**Details**: The gallery list API fetches `thumbnail_image` (full base64 PNG) for every entry in every page request. With PAGE_SIZE=24, each response carries 24 thumbnail images inline (1.2-4.8MB JSON per page). The subquery `SELECT s.image_data FROM sprites WHERE ... LIMIT 1` runs per row when `thumbnail_image` is NULL -- 24 extra sprite fetches per gallery page load.
**Cross-refs**: E-5 (gallery delete has no error response handling), P-7 (history endpoint also returns multi-MB images)

### H4. History endpoint returns 2-4MB filled_grid_image on every load
**Reviewer**: Performance (P-7)
**File**: `server/routes/history.js:25-65`
**Details**: `GET /api/history/:id` returns `filled_grid_image` (1-3MB base64) in every response. This fires on session restore, gallery entry load, and redundantly when loading editor settings. Loading from gallery fires this endpoint twice in parallel.
**Cross-refs**: P-14 (the image is then re-extracted instead of using stored sprites), E-11 (partial dispatch on load failure leaves stuck state)

### H5. Full sprite re-extraction on every gallery load even when sprites exist in DB
**Reviewer**: Performance (P-14)
**File**: `server/routes/history.js:56-63`, `src/lib/loadGeneration.ts:139-178`
**Details**: Sprites loaded from the database have `width: 0, height: 0`. `loadGenerationIntoState` re-runs full extraction from `filledGridImage` on every gallery load and session restore: decoding a 2-4MB base64 image, running O(width x height) cut-detection, creating 36 canvases, and PNG-encoding them -- all synchronously on the main thread. Sprites are already stored in the DB; re-extraction is unnecessary.
**Cross-refs**: E-11 (extraction failure during load leaves app in stuck `generating` state), A11Y-08 (no aria-busy during synchronous processing)

### H6. Animation canvas recreated and checkerboard redrawn every frame
**Reviewer**: Performance (P-3)
**File**: `src/hooks/useAnimationLoop.ts:91-143`, `src/components/preview/AnimationPreview.tsx:83-128`
**Details**: Every frame (every 150ms): a new `Image()` is created, `img.onload` is awaited, canvas is resized (forcing GPU reset), and the checkerboard background is redrawn pixel-by-pixel via nested for-loops (256+ `fillRect` calls). Setting `canvas.width` on every frame forces a canvas clear even when dimensions haven't changed. Image objects are never cached.
**Cross-refs**: P-8 (checkerboard could be a single `createPattern` call), A11Y-18 (canvas has no aria-label)

### H7. All 36 sprites re-encoded to PNG on every settings slider change with no debounce
**Reviewer**: Performance (P-4)
**File**: `src/components/grid/SpriteReview.tsx:202-238`
**Details**: `processSprite` creates 36 Image objects, 36 canvases, 36 `drawImage` calls, and 36 `toDataURL('image/png')` calls (expensive synchronous PNG encoding) every time any chroma/posterize/struckColors setting changes. Slider `onChange` fires ~30 times/second during drag. Palette detection adds 12 more canvas+image cycles.
**Cross-refs**: E-8 (extraction throw loses the generated image), A11Y-14 (sliders lack programmatic labels), S-7 (editor state lost on unmount)

### H8. Sprite save after extraction is fire-and-forget without surfacing failure
**Reviewer**: Error (E-2)
**File**: `src/hooks/useGenericWorkflow.ts:169-197`
**Details**: After extraction, the `/api/history/:id/sprites` POST has **no response status check** -- a 4xx/5xx never reaches the catch block. The archive call is also fire-and-forget. Users receive no "sprites were not saved" warning. `historyId` is set in state even when sprite save fails, creating an inconsistent DB record (generation exists, but with 0 sprites).
**Cross-refs**: S-1 (historyId set despite hollow record), P-7 (the large image was downloaded but sprites weren't persisted)

### H9. Migration failure is non-fatal -- silent schema corruption risk
**Reviewer**: Error (E-3)
**File**: `server/db/migrations.js:36-50`
**Details**: If a migration fails with an unrecognized error (not "duplicate column" / "already exists" / "no such column"), the code logs but does not throw. Subsequent migrations run against a partially-applied schema. The server starts and accepts requests against a broken schema, producing opaque SQLITE_ERROR responses at runtime.
**Cross-refs**: P-12 (synchronous file I/O already blocks event loop; broken schema generates errors at high volume)

### H10. Side effects in AppProvider; session restore has no loading state
**Reviewer**: State (S-3)
**File**: `src/context/AppContext.tsx:554-571`, `src/App.tsx:29-53`
**Details**: `AppProvider` has a `useEffect` making fetch calls to `/api/state/lastHistoryId` on every `historyId` change, with errors silently logged. Session restore is an async IIFE with no loading state -- the app renders the `configure` step immediately, then "jumps" to `review` once restoration completes. Users see a flash of empty config before their session appears.
**Cross-refs**: A11Y (content shift violates WCAG 3.2.2), E-6 (session restore doesn't check `stateRes.ok`)

### H11. Single top-level ErrorBoundary with non-functional recovery
**Reviewer**: Error (E-1)
**File**: `src/App.tsx:190-198`, `src/components/shared/ErrorBoundary.tsx`
**Details**: One `ErrorBoundary` wraps the entire app. Any sub-tree render error replaces the whole UI. `handleReset` clears `hasError` without resetting state, so "Try Again" re-renders into the same broken state -- functionally a no-op for most render errors. No `aria-live` region on the error screen.
**Cross-refs**: A11Y (screen readers don't announce the error or recovery), S-1 (no RESET dispatched on render error)

### H12. `loadGenerationIntoState` partial dispatch leaves app in stuck state on extraction failure
**Reviewer**: Error (E-11)
**File**: `src/lib/loadGeneration.ts:178-188`
**Details**: If `extractSprites` throws during load, dispatches 1-5 have already fired (SET_SPRITE_TYPE, SET_BUILDING, GENERATE_COMPLETE, etc.) but EXTRACTION_COMPLETE and SET_HISTORY_ID have not. The app is stuck in `step: 'generating'` with no sprites and no historyId. The generating overlay shows with no cancel button.
**Cross-refs**: S-1 (multi-dispatch hydration is fragile), S-8 (GENERATE_COMPLETE is semantically misused during load), P-14 (re-extraction is the cause)

### H13. Sprite cells completely inaccessible via keyboard
**Reviewer**: A11y (A11Y-03)
**File**: `src/components/grid/SpriteGrid.tsx:79-134`
**Details**: Sprite cells are `<div>` elements with `onClick` but no `role`, `tabIndex`, or keyboard event handling. Users cannot tab to or activate cells using Enter/Space. The `title` attribute on `<div>` is not reliably read by screen readers. This is the primary interactive surface of the review step.
**WCAG**: 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**Cross-refs**: P-1 (36+ interactive elements will need careful tabIndex management), S-7 (selection state is local)

### H14. Tab navigation missing ARIA tab semantics across header and admin
**Reviewer**: A11y (A11Y-01, A11Y-09)
**Files**: `src/components/layout/AppHeader.tsx:60-79`, `src/components/admin/AdminPage.tsx:35-45`
**Details**: Both navigations use `<button>` in `<nav>` without `role="tab"`, `role="tablist"`, or `aria-selected`. Screen readers cannot identify which tab is selected or that this is a tab interface. The pattern is identical in both locations.
**WCAG**: 4.1.2 Name, Role, Value (Level A)

### H15. StatusBanner uses polite announcement for error messages
**Reviewer**: A11y (A11Y-02)
**File**: `src/components/shared/StatusBanner.tsx:79-88`
**Details**: `role="status"` with `aria-live="polite"` is used for all message types. Error messages should use `role="alert"` with `aria-live="assertive"` to interrupt screen readers. Currently, critical generation failures and data loss warnings are announced at the same priority as "Settings saved."
**WCAG**: 4.1.3 Status Messages (Level AA)
**Cross-refs**: E-2 (errors that are already hard to notice are invisible to AT), E-10 (admin errors auto-dismiss)

### H16. Icon-only buttons in SpriteZoomModal lack accessible names
**Reviewer**: A11y (A11Y-04)
**File**: `src/components/grid/SpriteZoomModal.tsx:361-381`
**Details**: Eyedropper, eraser, zoom, and close buttons use raw Unicode emoji or symbols as their entire content. No `aria-label` attributes. `title` attributes are tooltip-only and not reliably announced. Struck color swatches (A11Y-05) are clickable `<div>` elements with no role, tabIndex, or keyboard handlers.
**WCAG**: 4.1.2 Name, Role, Value (Level A), 2.1.1 Keyboard (Level A)

### H17. Segmented controls throughout app missing group roles and aria-pressed
**Reviewer**: A11y (A11Y-06)
**File**: `src/components/config/UnifiedConfigPanel.tsx:296-310`
**Details**: The sprite type toggle, image size selector, aspect ratio selector, and 5+ other segmented controls use bare `<button>` elements with no `role="group"`, no `aria-label` on containers, and no `aria-pressed` on active buttons. Screen readers cannot determine which option is selected. This is a systematic pattern across 8+ controls.
**WCAG**: 4.1.2 Name, Role, Value (Level A)

### H18. Gallery cards have nested interactive elements; entries without thumbnails have no representation
**Reviewer**: A11y (A11Y-07)
**File**: `src/components/gallery/GalleryPage.tsx:299-337, 381-419`
**Details**: Delete button is nested inside a `role="button"` `<div>`, creating invalid DOM nesting (interactive inside interactive). Inner button is unreachable by some AT. The two-click delete confirmation has no AT announcement. Gallery entries without thumbnails have no visual or text fallback.
**WCAG**: 4.1.2 Name, Role, Value (Level A), 1.3.1 Info and Relationships (Level A)
**Cross-refs**: E-5 (delete has no error response handling)

### H19. GeneratingOverlay has no aria-busy, no live region
**Reviewer**: A11y (A11Y-08)
**File**: `src/components/shared/GeneratingOverlay.tsx:27-44`
**Details**: The overlay has no `role="status"`, no `aria-live`, no `aria-busy`. Screen readers will not announce generation start. The spinner has no accessible label. There is no progress indication for AT users.
**WCAG**: 4.1.3 Status Messages (Level AA)
**Cross-refs**: P-4 (UI freezes during processing), P-14 (UI freezes during re-extraction), E-12 (partial dispatch can leave overlay stuck)

### H20. Fragile ref-based skip guard between load/save effects in SpriteReview
**Reviewer**: State (S-4)
**File**: `src/components/grid/SpriteReview.tsx:248-297`
**Details**: A `skipNextSaveRef` flag coordinates three effects to prevent a save effect from writing defaults after a load effect restores settings. This side-channel mutable state is fragile under React concurrent features. If `settingsLoaded` is set by another path, the skip guard will be wrong. The load effect also calls `resetSelection` and `resetChromaKey`, triggering child hook effects before load completes.
**Cross-refs**: E-14 (loadSettings failure leaves user with defaults and no error), P-4 (load effect calls multiple state setters sequentially)

### H21. `extractSprites` throw on cell count mismatch loses the generated image
**Reviewer**: Error (E-8)
**File**: `src/lib/spriteExtractor.ts:397-401`
**Details**: If cut detection finds a different number of cells than expected, `extractSprites` throws. This propagates to `GENERATE_ERROR` which resets step to `configure`. But a valid `filledGridImage` exists in state from `GENERATE_COMPLETE`. The user loses the image and must re-generate (costing an API call and ~30 seconds). The re-extract UI in SpriteReview already exists but is unreachable after the error resets state.
**Cross-refs**: P-14 (re-extraction is expensive), S-8 (GENERATE_COMPLETE is misused), A11Y-08 (no error announcement)

---

## 3. Medium-Severity Findings

### M1. Inconsistent action type naming and payload conventions
**Reviewer**: State (S-5)
**File**: `src/context/AppContext.tsx:286-318`
**Details**: Actions mix imperative event style (`GENERATE_START`, `GENERATE_COMPLETE`) with declarative setter style (`SET_SPRITE_TYPE`, `SET_MODEL`). Some use `payload` wrappers, others spread properties directly. `SET_MODEL` accepts any `string` with no validation.

### M2. Preset cache never invalidated after admin edits
**Reviewer**: State (S-6)
**File**: `src/components/config/UnifiedConfigPanel.tsx:183-198`
**Details**: Preset fetch is skipped if `presetList.length > 0`. After editing presets in Admin, returning to Designer shows stale data. No cache invalidation, timestamp check, or cross-tab signal exists.
**Cross-refs**: E-6 (if initial fetch fails, effect retries on every render -- potential fetch storm)

### M3. Editor display state lost on unmount; fragile erasedKey
**Reviewer**: State (S-7)
**Files**: `src/hooks/useSpriteSelection.ts:37-159`, `src/components/grid/SpriteReview.tsx:153-165`
**Details**: Display order, mirrored cells, erased pixels, and zoom state are local `useState`. Navigating away loses all edits. The `erasedKey` (total count of erased pixels) is used as an effect dependency -- two different erased-pixel sets with the same count produce a false cache hit.
**Cross-refs**: E-7 (data loss if user navigates before 500ms debounce fires)

### M4. State hydration from server is asymmetric; GENERATE_COMPLETE misused during load
**Reviewer**: State (S-8)
**File**: `src/lib/loadGeneration.ts:33-197`
**Details**: `loadGenerationIntoState` silently defaults missing fields to empty strings. It dispatches `GENERATE_COMPLETE` during loads, which is semantically wrong -- the status message "Grid received! Extracting sprites..." is briefly shown when loading gallery entries.
**Cross-refs**: A11Y-02 (spurious "Grid received!" announcement confuses AT users), E-11 (partial dispatch on failure)

### M5. Non-deterministic ID generation inside reducer
**Reviewer**: State (S-9)
**File**: `src/context/AppContext.tsx:495`
**Details**: The `START_RUN` reducer case generates `groupId` using `Date.now()` and `Math.random()` -- a reducer purity violation. This breaks time-travel debugging and makes reducer tests non-reproducible.

### M6. Gallery delete has no error response handling
**Reviewer**: Error (E-5)
**File**: `src/components/gallery/GalleryPage.tsx:218-229`
**Details**: `handleDelete` does not check `res.ok`. If the server returns 404 or 500, the gallery still refetches as if delete succeeded. No warning is shown. The `deleteConfirm` state is cleared regardless.
**Cross-refs**: A11Y-07 (delete confirmation has no AT announcement)

### M7. Session restore doesn't check `stateRes.ok` before parsing JSON
**Reviewer**: Error (E-6)
**File**: `src/App.tsx:34-53`
**Details**: A 500 response with an HTML body causes a JSON parse exception. The user sees a generic "Failed to restore last session" instead of the root HTTP error. If restore throws, `restoredRef.current` is already `true`, so restore never retries.

### M8. No timeout on server-side Gemini API calls
**Reviewer**: Error (E-7)
**File**: `server/routes/generate.js:9-31`
**Details**: Server-side `callGemini` uses native fetch with no AbortSignal or timeout. A hung Gemini connection holds the Node.js event loop indefinitely. The client-side abort only cancels the client-to-server request; the server's outbound Gemini call continues.
**Cross-refs**: P-12 (synchronous file I/O already blocks event loop)

### M9. `extractSprites` throw resets to configure -- user loses generated image
**Reviewer**: Error (E-8)
**File**: `src/lib/spriteExtractor.ts:397-401`
**Details**: When extraction fails, the app resets to `configure` step even though a valid grid image exists. The re-extract UI in SpriteReview is unreachable because state was reset.

### M10. `historyId` sync to server silently fails
**Reviewer**: Error (E-9)
**File**: `src/context/AppContext.tsx:562-570`
**Details**: The PUT to `/api/state/lastHistoryId` uses `.catch(console.error)`. Client believes historyId is persisted; server has no record. Next startup, session restore finds nothing.
**Cross-refs**: S-3 (side effects in provider)

### M11. Admin preset save errors auto-dismiss too quickly
**Reviewer**: Error (E-10)
**Files**: `src/components/admin/GenericPresetsTab.tsx`, `src/components/admin/GridPresetsTab.tsx`
**Details**: Failed saves dispatch `SET_STATUS` warnings that appear in the global status banner and auto-dismiss in 5 seconds. Admin users in long form sessions may not notice.
**Cross-refs**: A11Y-02 (polite announcement for errors), A11Y-10 (admin list items not keyboard accessible)

### M12. 36 separate canvases created per extraction; no reuse
**Reviewer**: Performance (P-5)
**File**: `src/lib/spriteExtractor.ts:406-433`
**Details**: The extraction loop creates a fresh `document.createElement('canvas')` for each cell (up to 36), then encodes each to PNG via `toDataURL` synchronously. A single reused canvas would suffice.
**Cross-refs**: E-8 (canvas allocation failure on mobile/low-memory throws with no recovery)

### M13. Checkerboard drawn as 1024 fillRect calls per frame
**Reviewer**: Performance (P-8)
**Files**: `src/hooks/useAnimationLoop.ts:113-119`, `src/components/preview/AnimationPreview.tsx:105-111`
**Details**: Both preview locations redraw the checkerboard using nested for-loops. A `CanvasPattern` with `createPattern()` on a 2-tile canvas would reduce this to a single draw call.

### M14. No code splitting or lazy loading
**Reviewer**: Performance (P-9)
**File**: `vite.config.js`
**Details**: No `React.lazy()`, no `Suspense`, no `manualChunks`. AdminPage, GalleryPage, and AnimationPreview all load in the initial bundle despite being infrequently visited.

### M15. `defringeRecolor` uses `Math.sqrt` in inner loop
**Reviewer**: Performance (P-11)
**File**: `src/lib/chromaKey.ts:265`
**Details**: Inverse-distance weighting in nested loop over 48 neighbors per pixel, applied to every pink-classified pixel across multiple passes. Neighbor weights at radius 3 are constant and should be precomputed.

### M16. Archive route uses synchronous file I/O
**Reviewer**: Performance (P-12)
**File**: `server/routes/archive.js:21-43`
**Details**: Up to 37 `writeFileSync` calls in a single request handler. At 4K image sizes, the grid PNG alone can be 2-5MB, blocking the Node.js event loop for the duration.
**Cross-refs**: E-7 (no timeout on Gemini calls compounds event loop blocking)

### M17. Gallery typeLabel uses linear scan per card
**Reviewer**: Performance (P-6)
**File**: `src/components/gallery/GalleryPage.tsx:72-111, 249-252`
**Details**: `SPRITE_TYPES.find()` runs a linear scan for every rendered gallery card. Converting to a `Map` provides O(1) lookup.

### M18. Admin tab navigation missing ARIA tab semantics
**Reviewer**: A11y (A11Y-09)
**File**: `src/components/admin/AdminPage.tsx:35-45`
**Details**: Same pattern as header tabs (H14). No `role="tab"`, `role="tablist"`, or `aria-selected`.
**WCAG**: 4.1.2 Name, Role, Value (Level A)

### M19. Admin list items not keyboard accessible
**Reviewer**: A11y (A11Y-10)
**Files**: `src/components/admin/GenericPresetsTab.tsx:199-208`, `src/components/admin/GridPresetsTab.tsx:210-220`
**Details**: List items are `<div>` elements with `onClick` but no `role`, `tabIndex`, or keyboard handlers.
**WCAG**: 2.1.1 Keyboard (Level A)

### M20. Cell label inputs have no associated label
**Reviewer**: A11y (A11Y-11)
**File**: `src/components/admin/GridPresetsTab.tsx:336-346`
**Details**: Inputs have only `placeholder` and `title`. No `<label>` or `aria-label`.
**WCAG**: 1.3.1 Info and Relationships (Level A)

### M21. Orphan labels for button groups in config panel
**Reviewer**: A11y (A11Y-12)
**File**: `src/components/config/UnifiedConfigPanel.tsx:413-445`
**Details**: `<label>` elements wrap button groups rather than inputs. Not programmatically associated with any control.
**WCAG**: 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value (Level A)

### M22. 7 sliders across SpriteReview lack programmatic label associations
**Reviewer**: A11y (A11Y-14)
**File**: `src/components/grid/SpriteReview.tsx:511-536`
**Details**: Speed, Scale, Posterize, Chroma Key Tolerance, Defringe, Edge Recolor, and Recolor Sensitivity sliders have no `id`/`htmlFor` pairing. Visual labels use `<h3>` headings with no programmatic association.
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Cross-refs**: P-4 (these sliders trigger expensive reprocessing with no debounce)

### M23. Color striker swatches: 72-item tab trap, no struck/unstruck status in accessible name
**Reviewer**: A11y (A11Y-13)
**File**: `src/components/grid/SpriteReview.tsx:706-775`
**Details**: 72 color buttons in a row create an impractical Tab sequence. Accessible names are `rgb(r,g,b)` with no indication of struck/unstruck state.
**WCAG**: 2.4.3 Focus Order (Level A), 4.1.2 Name, Role, Value (Level A)
**Cross-refs**: P-1 (144 DOM buttons re-render on every struckColors change)

### M24. Focus indicator too low opacity (12%)
**Reviewer**: A11y (A11Y-16)
**File**: `src/styles/global.css:330-340`
**Details**: `--accent-glow` is `rgba(200, 255, 0, 0.12)`. The 12% opacity box-shadow likely fails the 3:1 minimum contrast ratio for focus indicators.
**WCAG**: 2.4.11 Focus Appearance (Level AA)

### M25. --text-secondary and --text-muted fail contrast minimums
**Reviewer**: A11y (A11Y-17)
**File**: `src/styles/global.css:20-25`
**Details**: `--text-secondary: #9c9cb0` on `--bg-panel: #151520` is ~3.8:1 (needs 4.5:1). `--text-muted: #8585a0` on `--bg-base: #0e0e18` is ~3.1:1. Used extensively for field labels, slider values, and section headings.
**WCAG**: 1.4.3 Contrast (Minimum) (Level AA)

### M26. Orphan labels in AddSheetModal
**Reviewer**: A11y (A11Y-15)
**File**: `src/components/grid/AddSheetModal.tsx:136-198`
**Details**: "Grid Layout" and "Reference Image" labels are not associated with their controls via `htmlFor`/`id`.
**WCAG**: 1.3.1 Info and Relationships (Level A)

### M27. `fetchContentPreset` throws opaque error that silently aborts multi-grid runs
**Reviewer**: Error (E-4)
**Files**: `src/lib/promptForType.ts:25-29`, `src/hooks/useRunWorkflow.ts:52`
**Details**: `fetchContentPreset` throws "Content preset X not found." The catch in `useRunWorkflow` dispatches `GENERATE_ERROR` which sets `step: 'configure'` and `run: null` -- silently aborting the entire multi-grid run mid-execution with no explanation.

---

## 4. Low-Severity Findings

### L1. Unnecessary useMemo wrapping of stable dispatch
**Reviewer**: State (S-10)
**File**: `src/context/AppContext.tsx:573-575`
**Details**: `useMemo(() => dispatch, [])` adds no value since React guarantees dispatch stability.

### L2. `callGemini` retry logic only handles 429, not network errors
**Reviewer**: Error (E-12)
**File**: `server/routes/generate.js:9-32`
**Details**: Transient network errors (ECONNRESET, ETIMEDOUT) propagate immediately. Worth retrying once or twice before giving up.

### L3. `parseGeminiResponse` has no validation of response structure
**Reviewer**: Error (E-13)
**File**: `server/utils.js:27-46`
**Details**: If Gemini returns `finishReason === 'MAX_TOKENS'`, parts may be empty and image null. Client shows generic "Generation failed" rather than actionable "Prompt is too long."

### L4. `detectPalette` silent image load failure
**Reviewer**: Error (E-14)
**File**: `src/components/grid/SpriteReview.tsx:87-89`
**Details**: `img.onerror` is not set in the Promise wrapper. Corrupt sprite base64 data causes the promise to never resolve (hangs).

### L5. validationMessage memo depends on entire state object
**Reviewer**: Performance (P-10)
**File**: `src/hooks/useGenericWorkflow.ts:319-326`
**Details**: `[state, config]` as dependencies means the memo recomputes on every state change, even though `getContent` only reads one slice.

### L6. SpriteGrid inline style object created on every render
**Reviewer**: Performance (P-13)
**File**: `src/components/grid/SpriteGrid.tsx:63-66`
**Details**: Style object recreated each render. Should be wrapped in `useMemo`.

### L7. Gallery page re-fetches on every tab switch (no client-side cache)
**Reviewer**: Performance (P-15)
**File**: `src/components/gallery/GalleryPage.tsx:147-151`
**Details**: `GalleryPage` unmounts on tab switch. No caching; full refetch on return.
**Cross-refs**: S-6 (preset cache also has no invalidation)

### L8. History API returns zero-width/height sprites
**Reviewer**: Performance (P-14 sub-finding)
**File**: `server/routes/history.js:56-63`
**Details**: Sprite `width` and `height` are set to 0 from the DB, breaking the normalization fast-path.

### L9. Canvas missing aria-label in AnimationPreview
**Reviewer**: A11y (A11Y-18)
**File**: `src/components/preview/AnimationPreview.tsx:178, 193-205`
**Details**: `<canvas>` has no `aria-label` or `role`. Speed slider has same label gap as M22. Arrow key instruction text has no semantic emphasis.
**WCAG**: 1.1.1 Non-text Content (Level A)

---

## 5. Cross-Pollination Matrix

The following matrix shows where findings from different reviewers reinforce, amplify, or connect to each other. An "X" indicates a direct cross-reference; "(i)" indicates an indirect/amplifying relationship.

| Theme | Performance | A11y | State | Error |
|-------|:-----------:|:----:|:-----:|:-----:|
| **Monolithic context / re-render blast radius** | P-1, P-10 | (i) stale announcements | S-1 | (i) E-11 partial dispatch |
| **Expensive synchronous image processing** | P-4, P-5, P-14 | A11Y-08 no aria-busy | S-4 skip guard | E-8, E-11 extraction failures |
| **Silent error swallowing** | (i) P-12 blocks event loop | A11Y-02 polite errors | S-3 provider effects | E-2, E-5, E-9, E-10 |
| **Session restore fragility** | P-7, P-14 large payloads | A11Y-08, (i) 3.2.2 | S-3, S-8 multi-dispatch | E-6, E-11 partial state |
| **Missing keyboard accessibility** | (i) 144 DOM buttons | A11Y-03, 04, 05, 10 | S-7 selection state local | (i) E-1 boundary recovery |
| **Canvas animation inefficiency** | P-3, P-8 | A11Y-18 no canvas label | -- | -- |
| **Server I/O blocking** | P-12, P-2 N+1 | -- | -- | E-3, E-7 no timeout |
| **Inconsistent label/role semantics** | -- | A11Y-06, 11-15, 17 | S-5 action naming | -- |
| **Data loss / persistence gaps** | -- | (i) no save warning | S-7 editor state lost | E-2 sprite save, E-9 sync |
| **Gallery payload bloat** | P-2, P-7 | A11Y-07 missing alt | S-6 stale cache | E-5 delete unhandled |

---

## 6. Root Cause Analysis

### Root Cause 1: Monolithic State Architecture
**Scope of impact**: H1, H2, H5, H10, H12, H20, M1, M2, M3, M4, M5, L1, L5
**Explanation**: All application state -- server-fetched data (presets, history), workflow state (step, sprites, run), and ephemeral UI state (editor settings, display order) -- lives in a single React context. This single decision cascades into: (a) full-tree re-renders on any change, (b) inability to split high-frequency and low-frequency state, (c) multi-dispatch hydration fragility, (d) module-level escape hatches for state that should be per-instance, and (e) no mechanism for rollback on partial failure.

### Root Cause 2: No Abstraction Layer Between Client and Server State
**Scope of impact**: H3, H4, H5, H8, H12, M2, M4, M6, M7, M8, M10, L2, L3, L7
**Explanation**: The app treats server data (presets, gallery entries, generation history) as client state in the reducer rather than as cached server state with its own lifecycle. This means: (a) no cache invalidation strategy, (b) no stale-while-revalidate pattern, (c) inline `fetch` calls with no response validation, (d) multi-MB payloads fetched unnecessarily, and (e) no retry/timeout logic. A data-fetching library (TanStack Query, SWR) or at minimum a centralized API client would address most of these issues.

### Root Cause 3: Synchronous Image Processing on Main Thread
**Scope of impact**: H5, H6, H7, M12, M13, M15, M16
**Explanation**: All canvas operations -- sprite extraction, PNG encoding, chroma key processing, checkerboard rendering, animation frames -- run synchronously on the main thread. The codebase has no Web Worker usage, no OffscreenCanvas, no requestAnimationFrame for animation, and no debouncing of expensive reprocessing pipelines. This blocks the UI during generation, extraction, and any slider interaction.

### Root Cause 4: Missing Systematic Accessibility Patterns
**Scope of impact**: H13-H19, M18-M26, L9
**Explanation**: The codebase lacks shared accessible primitives: no `<AccessibleTabNav>`, no `<LabeledSlider>`, no `<AccessibleToggleGroup>`, no centralized focus management. Each component independently implements (or omits) ARIA attributes, resulting in 8+ segmented controls without `aria-pressed`, 7+ sliders without label associations, and multiple navigations without tab semantics. The absence of reusable patterns means every new component must independently solve these problems.

### Root Cause 5: Fire-and-Forget Error Philosophy
**Scope of impact**: H8, H9, H11, M6, M7, M10, M11, M27, L2, L3, L4
**Explanation**: Error handling follows a consistent anti-pattern: catch, log to console, continue. Sprite saves, gallery deletes, session sync, preset fetches, and migration failures all silently swallow errors. The few places that surface errors use a single auto-dismissing status banner with polite announcement. There is no distinction between "informational" and "critical" errors in either visual or AT presentation.

---

## 7. Recommended Action Priority

### Immediate (addresses data loss, stuck states, and blocking issues)

| Priority | Action | Addresses |
|----------|--------|-----------|
| 1 | Add response status checks to sprite save POST and gallery delete | H8, M6 |
| 2 | Use stored sprites from DB instead of re-extracting on load; store sprite width/height | H5, H12, L8 |
| 3 | Make migration failures fatal (throw or process.exit) | H9 |
| 4 | Add granular ErrorBoundaries around major sections with resetKeys | H11 |
| 5 | Keep step at `review` when extraction fails (preserve filledGridImage) | H21 |
| 6 | Add `if (!stateRes.ok) return` guard in session restore | M7 |
| 7 | Move AbortController into useRef per hook instance | H2 |
| 8 | Consolidate `loadGenerationIntoState` into a single RESTORE_SESSION action | H1/H12 partial fix |

### Short-Term (performance, UX, and accessibility foundations)

| Priority | Action | Addresses |
|----------|--------|-----------|
| 9 | Split AppContext into workflow/status/presets slices | H1, L5, P-10 |
| 10 | Debounce slider onChange (100-200ms) before triggering reprocessing | H7 |
| 11 | Cache decoded Image objects; use CanvasPattern for checkerboard; guard canvas.width assignment | H6, M13 |
| 12 | Serve gallery thumbnails via dedicated endpoint with HTTP caching | H3 |
| 13 | Add `?fields=` parameter to history endpoint to omit filled_grid_image when not needed | H4 |
| 14 | Use `role="alert"` + `aria-live="assertive"` for error-severity status messages | H15 |
| 15 | Add `role="tab"`, `aria-selected`, `role="tablist"` to header and admin nav | H14, M18 |
| 16 | Add `role="button"`, `tabIndex={0}`, keyboard handlers to sprite grid cells | H13 |
| 17 | Add `aria-label` to all icon-only buttons in SpriteZoomModal | H16 |
| 18 | Add server-side timeout (120s) for Gemini API calls | M8 |
| 19 | Create shared `<AccessibleToggleGroup>` component for segmented controls | H17 |
| 20 | Create shared `<LabeledSlider>` component for all range inputs | M22 |

### Medium-Term (architecture, optimization, and polish)

| Priority | Action | Addresses |
|----------|--------|-----------|
| 21 | Add React.lazy() + Suspense for GalleryPage, AdminPage, AnimationPreview | M14 |
| 22 | Move sprite processing to Web Worker with OffscreenCanvas | H7, M12 |
| 23 | Reuse single canvas for extraction loop | M12 |
| 24 | Convert archive route to async fs.promises.writeFile | M16 |
| 25 | Add stale-while-revalidate caching for gallery and preset fetches | M2, L7 |
| 26 | Precompute neighbor weights table for defringeRecolor | M15 |
| 27 | Add `callGemini` retry for transient network errors | L2 |
| 28 | Return `finishReason` from Gemini response parsing for actionable error messages | L3 |
| 29 | Fix nested interactive elements in gallery cards | H18 |
| 30 | Lighten --text-secondary to >= #ababc0 and --text-muted to >= #9898b5 | M25 |
| 31 | Increase focus indicator opacity to meet 3:1 contrast | M24 |
| 32 | Move editor settings into AppState to survive step transitions | M3 |
| 33 | Generate groupId before dispatching START_RUN (reducer purity) | M5 |
| 34 | Add `aria-busy` and live region to GeneratingOverlay | H19 |
| 35 | Add loading/skeleton state for session restore | H10 |

---

## 8. Positive Findings

The codebase demonstrates several strong patterns that should be preserved and extended:

1. **Consolidated workflow hooks**: The recent `useGenericWorkflow` refactor eliminated four duplicated workflow hooks, establishing a single source of truth for the generate-extract-save pipeline. This is a significant architectural improvement over the prior codebase state.

2. **Unified config panel**: `UnifiedConfigPanel` consolidates four separate config panels behind a sprite-type-driven interface, reducing component duplication substantially.

3. **Correct focus trapping in modals**: The `useModalFocus` hook implements proper focus trapping with `MutationObserver`-based focusable element tracking. This is well-implemented and should be the template for any new modal/dialog.

4. **StatusBanner with auto-dismiss and severity levels**: The status system supports `info`, `warning`, and `error` severity types with configurable display duration. The infrastructure is sound; it just needs the assertive aria-live upgrade for errors.

5. **ErrorBoundary exists and is applied**: While it needs granularity improvements, having a top-level error boundary prevents white-screen crashes. The "Try Again" and "Reload" buttons are keyboard-accessible.

6. **Gallery cards have role="button" and tabIndex={0}**: The gallery page already implements basic keyboard accessibility for card navigation, including `onKeyDown` handlers. This pattern should be extended to other interactive elements.

7. **Preset system uses PRESET_TABLES dictionary**: The server-side preset routing uses a validated configuration dictionary rather than raw string interpolation, providing a good foundation for type-safe preset handling.

8. **Rate limiting on generate endpoint**: The `/api/generate-grid` endpoint has rate limiting (10 req/min), which is an important protection for the most expensive operation in the app.

9. **Debounced editor settings save**: Editor settings persistence uses a 500ms debounce, preventing excessive server writes during rapid adjustments. This pattern should be extended to slider-driven sprite reprocessing.

10. **AppReducer test suite exists**: `appReducer.test.ts` provides coverage for reducer logic, including action dispatch and state transitions. This is a good foundation to build on for additional state management tests.
