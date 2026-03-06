# Add Sheet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Let users generate new sprite sheets from the review screen, linked to the same generation group, with reference image continuity.

**Architecture:** A modal in SpriteReview triggers single-sheet generation reusing existing prompt building + Gemini pipeline. Backend stores content_preset_id on generations and exposes group assignment. A new `useAddSheet` hook encapsulates the generation flow, extracting shared prompt logic from `useRunWorkflow.ts` into `src/lib/promptForType.ts`.

**Tech Stack:** React + TypeScript frontend, Express + better-sqlite3 backend, existing Gemini API client.

---

## Task 1: DB Migration — Add `content_preset_id` column

**Files:**
- Modify: `server/db.js:200-214` (migrateSchema function)

**Step 1: Add migration entry**

In `server/db.js`, add to the `migrations` array (after line 210):

```javascript
"ALTER TABLE generations ADD COLUMN content_preset_id TEXT DEFAULT NULL",
```

**Step 2: Verify migration runs**

Run: `node -e "import('./server/db.js').then(m => { m.getDb(); console.log('OK') })"`
Expected: "OK" — column added silently (or already exists).

**Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat(db): add content_preset_id column to generations"
```

---

## Task 2: Backend — Modify history endpoints

**Files:**
- Modify: `server/index.js:51-103` (GET /api/history/:id and POST /api/history)

**Step 1: Add `groupId` and `contentPresetId` to GET /api/history/:id response**

In `server/index.js`, inside the `res.json({...})` block at line 63, add two new fields after `aspectRatio` (line 78):

```javascript
      groupId: gen.group_id || null,
      contentPresetId: gen.content_preset_id || null,
```

**Step 2: Accept and store `contentPresetId` in POST /api/history**

At line 94, add `contentPresetId` to the destructured body:

```javascript
    const { characterName, characterDescription, model, prompt, templateImage, filledGridImage, spriteType, gridSize, aspectRatio, groupId, contentPresetId } = req.body;
```

Update the INSERT statement at lines 96-99:

```javascript
    const result = db.prepare(
      `INSERT INTO generations (character_name, character_description, model, prompt, template_image, filled_grid_image, sprite_type, grid_size, aspect_ratio, group_id, content_preset_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(characterName, characterDescription, model, prompt, templateImage || '', filledGridImage || '', spriteType || 'character', gridSize || null, aspectRatio || '1:1', groupId || null, contentPresetId || null);
```

**Step 3: Verify with curl**

Run: `curl -s http://localhost:3002/api/gallery?limit=1 | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).entries[0]?.id))"` to get a valid ID, then:
Run: `curl -s http://localhost:3002/api/history/<id> | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('groupId:',j.groupId,'contentPresetId:',j.contentPresetId)})"`
Expected: `groupId: <value or null> contentPresetId: null` (null since existing entries don't have it yet)

**Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat(api): expose groupId/contentPresetId in history detail, accept contentPresetId on create"
```

---

## Task 3: Backend — Add PATCH group assignment endpoint

**Files:**
- Modify: `server/index.js` (add new endpoint after the DELETE /api/history/:id block, around line 575)

**Step 1: Add the endpoint**

```javascript
app.patch('/api/history/:id/group', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'Missing groupId' });
    const result = db.prepare('UPDATE generations SET group_id = ? WHERE id = ? AND group_id IS NULL')
      .run(groupId, id);
    if (result.changes === 0) {
      const existing = db.prepare('SELECT group_id FROM generations WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      return res.json({ groupId: existing.group_id, alreadySet: true });
    }
    res.json({ groupId, alreadySet: false });
  } catch (err) { next(err); }
});
```

Key detail: the UPDATE uses `AND group_id IS NULL` so it won't overwrite an existing group assignment.

**Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat(api): add PATCH /api/history/:id/group for legacy group assignment"
```

---

## Task 4: Extract shared prompt builder from useRunWorkflow

**Files:**
- Create: `src/lib/promptForType.ts`
- Modify: `src/hooks/useRunWorkflow.ts:1-139` (extract REFERENCE_PREFIX, fetchContentPreset, buildPromptForType)

**Step 1: Create `src/lib/promptForType.ts`**

Extract the following from `useRunWorkflow.ts` lines 18-139 into a new shared module:

```typescript
/**
 * Shared prompt building for any sprite type.
 * Extracted from useRunWorkflow to be reused by the add-sheet flow.
 */

import { SpriteType, GridLink } from '../context/AppContext';
import { buildGridFillPrompt, buildGridFillPromptWithReference, type CharacterConfig } from './promptBuilder';
import { buildBuildingPrompt } from './buildingPromptBuilder';
import { buildTerrainPrompt } from './terrainPromptBuilder';
import { buildBackgroundPrompt } from './backgroundPromptBuilder';
import { type GridConfig } from './gridConfig';

export const REFERENCE_PREFIX = `\
You are given two images.
IMAGE 1 is a previously completed sprite sheet for this character — use it as
your visual reference to maintain consistent proportions, color palette, art
style, and character identity.
IMAGE 2 is a blank template grid — fill each labeled cell according to the
guidance below.

`;

/** Fetch a single content preset by type and id */
export async function fetchContentPreset(spriteType: SpriteType, presetId: string): Promise<any> {
  const res = await fetch(`/api/presets?type=${spriteType}`);
  if (!res.ok) throw new Error('Failed to fetch content presets');
  const presets = await res.json();
  const preset = presets.find((p: any) => p.id === presetId);
  if (!preset) throw new Error(`Content preset "${presetId}" not found`);
  return preset;
}

/** Build prompt for any sprite type */
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: any,
  gridLink: GridLink,
  gridConfig: GridConfig,
  isSubsequentGrid: boolean,
): string {
  let prompt: string;

  switch (spriteType) {
    case 'character': {
      const charConfig: CharacterConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        equipment: contentPreset.equipment || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        rowGuidance: contentPreset.rowGuidance || '',
      };
      if (isSubsequentGrid) {
        prompt = buildGridFillPromptWithReference(
          charConfig,
          gridLink.genericGuidance || '',
          gridLink.guidanceOverride || '',
          gridLink.cellLabels,
        );
      } else {
        prompt = buildGridFillPrompt(
          charConfig,
          gridLink.genericGuidance,
          gridLink.guidanceOverride,
          gridLink.cellLabels,
        );
      }
      break;
    }
    case 'building': {
      const buildingConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        details: contentPreset.details || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        cellGuidance: contentPreset.cellGuidance || '',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildBuildingPrompt(
        buildingConfig,
        gridConfig,
        gridLink.genericGuidance,
        gridLink.guidanceOverride,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt;
      break;
    }
    case 'terrain': {
      const terrainConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        tileGuidance: contentPreset.tileGuidance || '',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildTerrainPrompt(
        terrainConfig,
        gridConfig,
        gridLink.genericGuidance,
        gridLink.guidanceOverride,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt;
      break;
    }
    case 'background': {
      const bgConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        layerGuidance: contentPreset.layerGuidance || '',
        bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildBackgroundPrompt(
        bgConfig,
        gridConfig,
        gridLink.genericGuidance,
        gridLink.guidanceOverride,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt;
      break;
    }
    default:
      throw new Error(`Unknown sprite type: ${spriteType}`);
  }

  return prompt;
}
```

**Step 2: Update `useRunWorkflow.ts` to import from the new module**

Replace lines 8-139 of `useRunWorkflow.ts`. Remove the local `REFERENCE_PREFIX`, `fetchContentPreset`, and `buildPromptForType` definitions. Add imports:

```typescript
import { REFERENCE_PREFIX, fetchContentPreset, buildPromptForType } from '../lib/promptForType';
```

Remove the following imports that are no longer needed directly (they're now in promptForType):
- `buildGridFillPrompt`, `buildGridFillPromptWithReference`, `CharacterConfig` from `../lib/promptBuilder`
- `buildBuildingPrompt` from `../lib/buildingPromptBuilder`
- `buildTerrainPrompt` from `../lib/terrainPromptBuilder`
- `buildBackgroundPrompt` from `../lib/backgroundPromptBuilder`

Keep the remaining imports: `useCallback`, `useRef`, `useAppContext`, `SpriteType`, `GridLink`, `generateTemplate`, `extractSprites`, `generateGrid`, `gridPresetToConfig`, `GridConfig`.

Note: `REFERENCE_PREFIX` is still used on line 189 inside `generateCurrentGrid` — the import handles that.

**Step 3: Verify the app still compiles**

Run: `npm run build` (or `npx vite build`)
Expected: No TypeScript errors.

**Step 4: Commit**

```bash
git add src/lib/promptForType.ts src/hooks/useRunWorkflow.ts
git commit -m "refactor: extract shared prompt builder into src/lib/promptForType.ts"
```

---

## Task 5: Thread `contentPresetId` through run workflow history saves

**Files:**
- Modify: `src/hooks/useRunWorkflow.ts:253-268` (history POST body)

**Step 1: Add `contentPresetId` to the history POST**

In `useRunWorkflow.ts`, in the `generateCurrentGrid` function's history save block (around line 257), add `contentPresetId` to the JSON body:

```javascript
            contentPresetId: run.contentPresetId,
```

**Step 2: Commit**

```bash
git add src/hooks/useRunWorkflow.ts
git commit -m "feat: include contentPresetId when saving run grids to history"
```

---

## Task 6: Update gallery handleLoad to pass groupId and contentPresetId to state

**Files:**
- Modify: `src/context/AppContext.tsx` (add sourceGroupId, sourceContentPresetId, sourceGenerationId to AppState)
- Modify: `src/components/gallery/GalleryPage.tsx:158-290` (handleLoad)

**Step 1: Add source fields to AppState**

In `src/context/AppContext.tsx`, add to the `AppState` interface (after `historyId` around line 193):

```typescript
  /** Source generation context for add-sheet */
  sourceGroupId: string | null;
  sourceContentPresetId: string | null;
```

Add to `initialState` (after `historyId: null` around line 266):

```typescript
  sourceGroupId: null,
  sourceContentPresetId: null,
```

Add a new action type to the union (around line 308):

```typescript
  | { type: 'SET_SOURCE_CONTEXT'; groupId: string | null; contentPresetId: string | null }
```

Add the reducer case (after SET_HISTORY_ID around line 378):

```typescript
    case 'SET_SOURCE_CONTEXT':
      return { ...state, sourceGroupId: action.groupId, sourceContentPresetId: action.contentPresetId };
```

In the RESET case (around line 501), add the new fields:

```typescript
        sourceGroupId: null,
        sourceContentPresetId: null,
```

**Step 2: Dispatch source context from gallery handleLoad**

In `src/components/gallery/GalleryPage.tsx`, after the `dispatch({ type: 'SET_HISTORY_ID', id: data.id })` call (near the end of handleLoad, likely around line 295), add:

```typescript
        dispatch({
          type: 'SET_SOURCE_CONTEXT',
          groupId: data.groupId || null,
          contentPresetId: data.contentPresetId || null,
        });
```

**Step 3: Verify the app compiles**

Run: `npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/context/AppContext.tsx src/components/gallery/GalleryPage.tsx
git commit -m "feat: track source groupId/contentPresetId in app state for add-sheet"
```

---

## Task 7: Create `useAddSheet` hook

**Files:**
- Create: `src/hooks/useAddSheet.ts`

**Step 1: Write the hook**

```typescript
/**
 * Hook for generating a new sprite sheet from an existing generation.
 * Handles reference image preparation, prompt building, generation, and history saving.
 */

import { useCallback, useRef, useState } from 'react';
import { useAppContext, SpriteType, GridLink } from '../context/AppContext';
import { generateTemplate } from '../lib/templateGenerator';
import { extractSprites, composeSpriteSheet, ExtractedSprite } from '../lib/spriteExtractor';
import { generateGrid } from '../api/geminiClient';
import { gridPresetToConfig } from '../lib/gridConfig';
import { REFERENCE_PREFIX, fetchContentPreset, buildPromptForType } from '../lib/promptForType';

export interface AddSheetOptions {
  /** Grid link to use for the new sheet */
  gridLink: GridLink;
  /** Image generation size */
  imageSize: '2K' | '4K';
  /** 'full' uses the filled grid image; 'selected' composes from chosen sprites */
  referenceMode: 'full' | 'selected';
  /** Sprites to compose into reference (only used when referenceMode === 'selected') */
  selectedSprites?: ExtractedSprite[];
}

export function useAddSheet() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const [generating, setGenerating] = useState(false);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setGenerating(false);
  }, []);

  const generate = useCallback(async (opts: AddSheetOptions) => {
    const { gridLink, imageSize, referenceMode, selectedSprites } = opts;
    const spriteType = state.spriteType as SpriteType;
    const contentPresetId = state.sourceContentPresetId;
    const filledGridImage = state.filledGridImage;
    let groupId = state.sourceGroupId;
    const historyId = state.historyId;

    if (!filledGridImage) throw new Error('No filled grid image available');

    setGenerating(true);
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // If no groupId exists (legacy entry), create one and backfill
      if (!groupId && historyId) {
        groupId = `addsheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await fetch(`/api/history/${historyId}/group`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
          signal: abort.signal,
        });
        dispatch({ type: 'SET_SOURCE_CONTEXT', groupId, contentPresetId });
      }

      // Build reference image
      let refBase64: string;
      if (referenceMode === 'selected' && selectedSprites && selectedSprites.length > 0) {
        const gridCols = state.activeGridConfig?.cols;
        const { base64 } = await composeSpriteSheet(selectedSprites, gridCols);
        refBase64 = base64;
      } else {
        refBase64 = filledGridImage;
      }

      // Fetch content preset for prompt building
      let contentPreset: any;
      if (contentPresetId) {
        contentPreset = await fetchContentPreset(spriteType, contentPresetId);
      } else {
        // Legacy entry — build a minimal preset from state
        const name =
          spriteType === 'building' ? state.building.name :
          spriteType === 'terrain' ? state.terrain.name :
          spriteType === 'background' ? state.background.name :
          state.character.name;
        const description =
          spriteType === 'building' ? state.building.description :
          spriteType === 'terrain' ? state.terrain.description :
          spriteType === 'background' ? state.background.description :
          state.character.description;
        contentPreset = { name, description };
      }

      if (abort.signal.aborted) return;

      // Build grid config and template
      const gridConfig = gridPresetToConfig(gridLink, spriteType);
      const templateParams = gridConfig.templates[imageSize];
      const aspectRatio = gridConfig.aspectRatio || '1:1';
      const template = generateTemplate(templateParams, gridConfig, aspectRatio);

      dispatch({
        type: 'GENERATE_START',
        templateImage: template.base64,
        gridConfig: {
          cols: gridConfig.cols,
          rows: gridConfig.rows,
          cellLabels: gridConfig.cellLabels,
          cellGroups: gridLink.cellGroups,
          aspectRatio: gridConfig.aspectRatio,
        },
      });

      // Build prompt (always as subsequent grid since we have a reference)
      const prompt = buildPromptForType(spriteType, contentPreset, gridLink, gridConfig, true);

      // Call Gemini
      const result = await generateGrid(
        state.model,
        prompt,
        { data: template.base64, mimeType: 'image/png' },
        imageSize,
        abort.signal,
        { data: refBase64, mimeType: 'image/png' },
        aspectRatio,
      );

      if (abort.signal.aborted) return;

      if (!result.image) {
        dispatch({ type: 'GENERATE_ERROR', error: 'Gemini returned no image. Try again.' });
        return;
      }

      dispatch({
        type: 'GENERATE_COMPLETE',
        filledGridImage: result.image.data,
        filledGridMimeType: result.image.mimeType,
        geminiText: result.text || '',
      });

      // Extract sprites
      const sprites = await extractSprites(
        result.image.data,
        result.image.mimeType,
        {
          gridOverride: {
            cols: gridConfig.cols,
            rows: gridConfig.rows,
            totalCells: gridConfig.totalCells,
            cellLabels: gridConfig.cellLabels,
          },
        },
      );

      if (abort.signal.aborted) return;
      dispatch({ type: 'EXTRACTION_COMPLETE', sprites });

      // Save to history
      const spritePayload = sprites.map(s => ({
        cellIndex: s.cellIndex,
        poseId: s.label.toLowerCase().replace(/\s+/g, '-'),
        poseName: s.label,
        imageData: s.imageData,
        mimeType: s.mimeType,
      }));

      try {
        const histResp = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: contentPreset.name,
            characterDescription: contentPreset.description,
            model: state.model,
            prompt,
            filledGridImage: result.image.data,
            spriteType,
            gridSize: `${gridConfig.cols}x${gridConfig.rows}`,
            aspectRatio,
            groupId,
            contentPresetId,
          }),
          signal: abort.signal,
        });
        const histData = await histResp.json();

        if (abort.signal.aborted) return;
        dispatch({ type: 'SET_HISTORY_ID', id: histData.id });

        await fetch(`/api/history/${histData.id}/sprites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprites: spritePayload }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('Failed to save add-sheet generation to history');
      }

      // Archive
      try {
        await fetch('/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterName: contentPreset.name,
            filledGridImage: result.image.data,
            filledGridMimeType: result.image.mimeType,
            sprites: spritePayload,
          }),
          signal: abort.signal,
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.warn('Failed to archive add-sheet generation');
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dispatch({ type: 'GENERATE_ERROR', error: err.message || 'Generation failed' });
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [state, dispatch]);

  return { generate, cancel, generating };
}
```

**Step 2: Verify the app compiles**

Run: `npm run build`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/hooks/useAddSheet.ts
git commit -m "feat: add useAddSheet hook for generating new sheets from existing generations"
```

---

## Task 8: Add Sheet modal CSS

**Files:**
- Modify: `src/styles/global.css` (append modal styles)

**Step 1: Add modal styles**

Append to `src/styles/global.css`:

```css
/* ── Add Sheet Modal ── */
.add-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.add-sheet-modal {
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border, #444);
  border-radius: 12px;
  padding: 24px;
  width: 420px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.add-sheet-modal h3 {
  margin: 0 0 16px;
  font-size: 1.1rem;
}

.add-sheet-section {
  margin-bottom: 16px;
}

.add-sheet-section label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary, #aaa);
  margin-bottom: 6px;
}

.add-sheet-section select,
.add-sheet-section .segmented-control {
  width: 100%;
}

.add-sheet-ref-toggle {
  display: flex;
  gap: 8px;
}

.add-sheet-ref-toggle button {
  flex: 1;
}

.add-sheet-sprites {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.add-sheet-sprite-check {
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
}

.add-sheet-sprite-check.selected {
  border-color: var(--accent, #7c3aed);
}

.add-sheet-sprite-check img {
  width: 100%;
  display: block;
}

.add-sheet-sprite-check input {
  position: absolute;
  top: 4px;
  left: 4px;
}

.add-sheet-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.add-sheet-actions button {
  flex: 1;
}
```

**Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: add CSS styles for add-sheet modal"
```

---

## Task 9: Add Sheet modal UI + button in SpriteReview

**Files:**
- Create: `src/components/grid/AddSheetModal.tsx`
- Modify: `src/components/grid/SpriteReview.tsx:974-985` (add button in export section)

**Step 1: Create the modal component**

```typescript
/**
 * Modal for generating a new sprite sheet linked to an existing generation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext, SpriteType, GridLink } from '../../context/AppContext';
import { useAddSheet, AddSheetOptions } from '../../hooks/useAddSheet';
import { ExtractedSprite } from '../../lib/spriteExtractor';

interface Props {
  open: boolean;
  onClose: () => void;
  currentSprites: ExtractedSprite[];
}

export function AddSheetModal({ open, onClose, currentSprites }: Props) {
  const { state } = useAppContext();
  const { generate, cancel, generating } = useAddSheet();

  const [gridLinks, setGridLinks] = useState<GridLink[]>([]);
  const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
  const [imageSize, setImageSize] = useState<'2K' | '4K'>('2K');
  const [referenceMode, setReferenceMode] = useState<'full' | 'selected'>('full');
  const [selectedSpriteIndices, setSelectedSpriteIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const spriteType = state.spriteType as SpriteType;
  const contentPresetId = state.sourceContentPresetId;

  // Fetch linked grid presets
  useEffect(() => {
    if (!open || !contentPresetId) {
      setGridLinks([]);
      return;
    }

    setLoading(true);
    fetch(`/api/presets/${spriteType}/${contentPresetId}/grid-links`)
      .then(res => res.json())
      .then((links: GridLink[]) => {
        setGridLinks(links);
        // Default to matching current grid size
        const currentGridSize = state.activeGridConfig
          ? `${state.activeGridConfig.cols}x${state.activeGridConfig.rows}`
          : null;
        const matchIdx = links.findIndex(l => l.gridSize === currentGridSize);
        setSelectedLinkIndex(matchIdx >= 0 ? matchIdx : 0);
      })
      .catch(() => setGridLinks([]))
      .finally(() => setLoading(false));
  }, [open, contentPresetId, spriteType, state.activeGridConfig]);

  // Reset sprite selection when switching mode
  useEffect(() => {
    if (referenceMode === 'full') {
      setSelectedSpriteIndices(new Set());
    } else {
      // Select all by default
      setSelectedSpriteIndices(new Set(currentSprites.map((_, i) => i)));
    }
  }, [referenceMode, currentSprites]);

  const toggleSprite = useCallback((index: number) => {
    setSelectedSpriteIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    const gridLink = gridLinks[selectedLinkIndex];
    if (!gridLink && !state.activeGridConfig) return;

    // If no grid links available (legacy), build a synthetic grid link from current config
    const effectiveGridLink: GridLink = gridLink || {
      id: 0,
      gridPresetId: 0,
      gridName: 'Current Layout',
      gridSize: `${state.activeGridConfig!.cols}x${state.activeGridConfig!.rows}`,
      cols: state.activeGridConfig!.cols,
      rows: state.activeGridConfig!.rows,
      cellLabels: state.activeGridConfig!.cellLabels || [],
      cellGroups: state.activeGridConfig!.cellGroups || [],
      genericGuidance: '',
      guidanceOverride: '',
      sortOrder: 0,
    };

    const selectedSprites = referenceMode === 'selected'
      ? currentSprites.filter((_, i) => selectedSpriteIndices.has(i))
      : undefined;

    const opts: AddSheetOptions = {
      gridLink: effectiveGridLink,
      imageSize,
      referenceMode,
      selectedSprites,
    };

    await generate(opts);
    onClose();
  }, [gridLinks, selectedLinkIndex, imageSize, referenceMode, selectedSpriteIndices, currentSprites, state.activeGridConfig, generate, onClose]);

  const handleCancel = useCallback(() => {
    cancel();
    onClose();
  }, [cancel, onClose]);

  if (!open) return null;

  const hasGridLinks = gridLinks.length > 0;

  return (
    <div className="add-sheet-overlay" onClick={handleCancel}>
      <div className="add-sheet-modal" onClick={e => e.stopPropagation()}>
        <h3>Add Sprite Sheet</h3>

        {/* Grid Layout */}
        <div className="add-sheet-section">
          <label>Grid Layout</label>
          {loading && <p>Loading grid presets...</p>}
          {!loading && hasGridLinks && (
            <select
              className="select-input"
              value={selectedLinkIndex}
              onChange={e => setSelectedLinkIndex(Number(e.target.value))}
            >
              {gridLinks.map((link, i) => (
                <option key={link.id} value={i}>
                  {link.gridName} ({link.gridSize} &middot; {link.cellLabels.length} cells)
                </option>
              ))}
            </select>
          )}
          {!loading && !hasGridLinks && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #aaa)' }}>
              Same layout as current sheet
              {!contentPresetId && ' (no linked presets for legacy entries)'}
            </p>
          )}
        </div>

        {/* Reference Type */}
        <div className="add-sheet-section">
          <label>Reference Image</label>
          <div className="add-sheet-ref-toggle">
            <button
              className={`btn btn-sm${referenceMode === 'full' ? ' btn-primary' : ''}`}
              onClick={() => setReferenceMode('full')}
            >
              Full Sheet
            </button>
            <button
              className={`btn btn-sm${referenceMode === 'selected' ? ' btn-primary' : ''}`}
              onClick={() => setReferenceMode('selected')}
            >
              Selected Sprites
            </button>
          </div>

          {referenceMode === 'selected' && (
            <div className="add-sheet-sprites">
              {currentSprites.map((sprite, i) => (
                <label
                  key={i}
                  className={`add-sheet-sprite-check${selectedSpriteIndices.has(i) ? ' selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSpriteIndices.has(i)}
                    onChange={() => toggleSprite(i)}
                  />
                  <img
                    src={`data:${sprite.mimeType};base64,${sprite.imageData}`}
                    alt={sprite.label}
                    title={sprite.label}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Image Size */}
        <div className="add-sheet-section">
          <label>Image Size</label>
          <div className="segmented-control">
            <button
              className={imageSize === '2K' ? 'active' : ''}
              onClick={() => setImageSize('2K')}
            >
              2K
            </button>
            <button
              className={imageSize === '4K' ? 'active' : ''}
              onClick={() => setImageSize('4K')}
            >
              4K
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="add-sheet-actions">
          <button className="btn" onClick={handleCancel} disabled={generating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating || (referenceMode === 'selected' && selectedSpriteIndices.size === 0)}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add the button and modal to SpriteReview**

In `src/components/grid/SpriteReview.tsx`:

Add import at the top (after the existing imports, around line 19):

```typescript
import { AddSheetModal } from './AddSheetModal';
```

Add state inside the `SpriteReview` component (after other useState calls):

```typescript
  const [addSheetOpen, setAddSheetOpen] = useState(false);
```

Add the button in the Export section (around line 984, after the "Export Individual PNGs" button):

```tsx
            <button className="btn btn-primary w-full" onClick={() => setAddSheetOpen(true)}>
              Add Sheet
            </button>
```

Add the modal render at the end of the component's return, just before the closing fragment or div (before line 999's `</aside>`):

```tsx
        <AddSheetModal
          open={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
          currentSprites={displaySprites}
        />
```

**Step 3: Verify the app compiles and renders**

Run: `npm run build`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/grid/AddSheetModal.tsx src/components/grid/SpriteReview.tsx
git commit -m "feat: add Add Sheet modal with grid/reference/size selection in SpriteReview"
```

---

## Task 10: Set source context during run workflow saves

**Files:**
- Modify: `src/hooks/useRunWorkflow.ts` (dispatch SET_SOURCE_CONTEXT after saving to history)

**Step 1: Dispatch source context after history save**

In `useRunWorkflow.ts`, after the `dispatch({ type: 'SET_HISTORY_ID', id: histData.id })` line (around line 273), add:

```typescript
        dispatch({
          type: 'SET_SOURCE_CONTEXT',
          groupId: run.groupId,
          contentPresetId: run.contentPresetId,
        });
```

**Step 2: Commit**

```bash
git add src/hooks/useRunWorkflow.ts
git commit -m "feat: dispatch source context after run workflow history save"
```

---

## Task 11: Manual integration test

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Test from Run Builder**

1. Go to Run Builder, select a content preset, start a run
2. After generation completes, verify the "Add Sheet" button appears in the Export section
3. Click it — modal should open with grid layout dropdown, reference toggle, image size
4. Select "Full Sheet" reference, click Generate
5. Verify a new sheet generates and replaces the review
6. Check gallery — both sheets should appear in the same group

**Step 3: Test from Gallery**

1. Load an existing generation from the gallery
2. Verify "Add Sheet" button appears
3. Test "Selected Sprites" mode — check a few sprites, generate
4. Verify the new sheet is in the same gallery group

**Step 4: Test legacy entries**

1. Load a legacy entry (one without group_id or content_preset_id)
2. Click "Add Sheet" — should show "Same layout as current sheet"
3. Generate with "Full Sheet" reference
4. Verify a new group_id was assigned to both old and new entries

**Step 5: Final commit**

If any fixes were needed, commit them. Otherwise:

```bash
git add -A
git commit -m "feat: add-sheet feature complete — generate new sheets from existing generations"
```
