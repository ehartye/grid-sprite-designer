# Add Sheet Feature Design

**Date:** 2026-03-05
**Status:** Approved

## Overview

Add a button to the SpriteReview screen that lets users generate a new sprite sheet linked to an existing generation. The new sheet joins the same generation group, reuses the same content preset, and accepts a reference image (full sheet or selected sprites) for visual continuity.

## Entry Points

- **SpriteReview toolbar** — "Add Sheet" button appears whenever a completed generation is displayed, whether from a fresh run or a gallery load.

## UI: Add Sheet Modal

When clicked, a modal opens with:

1. **Grid Layout** — Dropdown defaulting to the current sheet's grid preset. Lists all grid presets linked to the same content preset (fetched via `/api/presets/:type/:id/grid-links`). If no content preset is known (legacy entries), only "same layout" is available.
2. **Reference Type** — Toggle: "Full Sheet" or "Selected Sprites".
   - Full Sheet: sends the filled grid image as-is.
   - Selected Sprites: shows checkboxes on current sprites; composes selected ones into a clean sheet via `composeSpriteSheet()`.
3. **Image Size** — 2K / 4K toggle, defaults to current.
4. **Generate** button.

## Data Flow

1. Modal opens, fetches linked grid presets for the content preset.
2. User configures options and hits Generate.
3. Generation sequence:
   - Store the source generation's `groupId` (or create one if legacy entry has none).
   - Build the template from the selected grid config.
   - Build the prompt via `buildPromptForType()` with `isSubsequentGrid = true`.
   - Call `generateGrid()` with the chosen reference image.
4. On completion: dispatch `GENERATE_COMPLETE`, extract sprites, save to history with the same `groupId`, archive to disk.
5. Review screen updates to show the new sheet.

## Backend Changes

### New column
```sql
ALTER TABLE generations ADD COLUMN content_preset_id TEXT DEFAULT NULL;
```

### Modified endpoints

- **`GET /api/history/:id`** — Return `groupId` and `contentPresetId` in the response.
- **`POST /api/history`** — Accept and store `contentPresetId` field.

### New endpoint

- **`PATCH /api/history/:id/group`** — Assign a `groupId` to a legacy entry that doesn't have one. Used when "Add Sheet" is triggered from a legacy generation.

## State Management

New fields tracked in component state (not global AppContext):
- `sourceGenerationId` — which generation we're adding a sheet to
- `sourceGroupId` — the group to join
- `sourceContentPresetId` — for fetching linked grids

The actual generation reuses the existing `GENERATE_START` -> `GENERATE_COMPLETE` -> `EXTRACTION_COMPLETE` dispatch flow. The modal's generate handler is a standalone async function similar to `generateCurrentGrid` in `useRunWorkflow`.

## Reference Image Handling

- **Full Sheet mode:** Uses the `filledGridImage` from state directly.
- **Selected Sprites mode:** Calls `composeSpriteSheet()` on checked sprites, producing a clean PNG.
- Both modes prepend `REFERENCE_PREFIX` to the prompt ("IMAGE 1 is a previously completed sprite sheet...").

## Grouping

- New sheet automatically gets the same `group_id` as the source generation.
- For legacy entries without a `group_id`, the flow generates a new group ID and backfills it onto the source entry via `PATCH /api/history/:id/group`.

## Key Files

- `src/components/grid/SpriteReview.tsx` — Add Sheet button + modal UI
- `src/hooks/useAddSheet.ts` — New hook encapsulating the add-sheet generation logic
- `src/lib/spriteExtractor.ts` — `composeSpriteSheet()` already exists
- `src/lib/promptBuilder.ts` — `buildGridFillPromptWithReference()` already exists
- `src/api/geminiClient.ts` — `generateGrid()` already supports `referenceImage`
- `server/index.js` — Endpoint changes
- `server/db.js` — Migration for `content_preset_id` column
- `src/styles/global.css` — Modal styles
