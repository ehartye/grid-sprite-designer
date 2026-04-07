# Feedback-Driven Regeneration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Enable structured feedback (global, per-group, per-cell) with cell sign-off on generated sprite sheets, then regenerate with the same grid layout using feedback-augmented prompts and the original grid as reference.

**Architecture:** Extract shared generation pipeline into a `GenerationRequest` builder consumed by all workflow hooks. Add `useRegenerateWithFeedback` hook, `FeedbackPanel` side panel, `CellContextMenu` kebab dropdown, and `GroupHeader` components. Persist feedback and version chains in the DB via new columns on `generations`.

**Tech Stack:** React (Context + useReducer), Express/better-sqlite3, TypeScript, CSS custom properties

---

### Task 1: DB Migration — Add feedback and version chain columns

**Files:**
- Modify: `server/db/migrations.js:91` (add entries to MIGRATIONS array)
- Modify: `server/db/schema.js:3-20` (add columns to CREATE TABLE for new DBs)

**Step 1: Add migration entries**

In `server/db/migrations.js`, add three new entries after migration `020`:

```javascript
{ name: '021_add_feedback_json', sql: 'ALTER TABLE generations ADD COLUMN feedback_json TEXT DEFAULT NULL' },
{ name: '022_add_parent_history_id', sql: 'ALTER TABLE generations ADD COLUMN parent_history_id INTEGER DEFAULT NULL REFERENCES generations(id)' },
{ name: '023_add_generation_version', sql: 'ALTER TABLE generations ADD COLUMN generation_version INTEGER NOT NULL DEFAULT 1' },
```

**Step 2: Add columns to base schema**

In `server/db/schema.js`, inside the `CREATE TABLE IF NOT EXISTS generations` block, add after line 19 (`updated_at`):

```sql
      feedback_json TEXT DEFAULT NULL,
      parent_history_id INTEGER DEFAULT NULL REFERENCES generations(id),
      generation_version INTEGER NOT NULL DEFAULT 1,
```

**Step 3: Verify migration runs**

Run: `npm run dev` (or restart server)
Expected: Console shows `[Migration] Applied: 021_add_feedback_json`, `022_add_parent_history_id`, `023_add_generation_version`

**Step 4: Commit**

```bash
git add server/db/migrations.js server/db/schema.js
git commit -m "feat: add feedback_json, parent_history_id, generation_version columns to generations"
```

---

### Task 2: API — Feedback save endpoint and history POST updates

**Files:**
- Modify: `server/routes/history.js:65-89` (add parentHistoryId + generationVersion to POST)
- Modify: `server/routes/history.js` (add PATCH /:id/feedback route)
- Modify: `server/routes/history.js:26-63` (add new fields to GET /:id response)

**Step 1: Update POST /api/history to accept new fields**

In `server/routes/history.js`, at the destructuring on line 70, add `parentHistoryId` and `generationVersion`:

```javascript
const { contentName, contentDescription, model, prompt, templateImage, filledGridImage, spriteType, gridSize, aspectRatio, groupId, contentPresetId, imageSize, thinkingLevel, parentHistoryId, generationVersion } = req.body;
```

Update the INSERT statement (lines 82-85) to include the new columns:

```javascript
const result = db.prepare(
  `INSERT INTO generations (content_name, content_description, model, prompt, template_image, filled_grid_image, sprite_type, grid_size, aspect_ratio, group_id, content_preset_id, image_size, thinking_level, parent_history_id, generation_version)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(contentName, contentDescription, model, prompt, templateImage || '', filledGridImage || '', effectiveSpriteType, gridSize || null, aspectRatio || '1:1', groupId || null, contentPresetId || null, imageSize || null, thinkingLevel || null, parentHistoryId || null, generationVersion || 1);
```

**Step 2: Add PATCH /:id/feedback endpoint**

Add after the existing PATCH /:id/group route (after line 217):

```javascript
router.patch('/:id/feedback', (req, res, next) => {
  try {
    const id = parseIntParam(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid id' });
    const { feedbackJson } = req.body;
    if (typeof feedbackJson !== 'string') {
      return res.status(400).json({ error: 'feedbackJson must be a JSON string' });
    }
    db.prepare('UPDATE generations SET feedback_json = ? WHERE id = ?').run(feedbackJson, id);
    res.json({ success: true });
  } catch (err) { next(err); }
});
```

**Step 3: Update GET /:id to return new fields**

In the GET /:id handler, add to the response object the new fields from the row:

```javascript
parentHistoryId: row.parent_history_id || null,
generationVersion: row.generation_version || 1,
feedbackJson: row.feedback_json || null,
```

**Step 4: Verify endpoints work**

Run: `curl -X PATCH http://localhost:5173/api/history/1/feedback -H "Content-Type: application/json" -d '{"feedbackJson": "{\"global\":\"test\"}"}'`
Expected: `{"success":true}`

**Step 5: Commit**

```bash
git add server/routes/history.js
git commit -m "feat: add feedback PATCH endpoint, parentHistoryId + generationVersion to history POST/GET"
```

---

### Task 3: Shared GenerationRequest builder

**Files:**
- Create: `src/lib/generateRequest.ts`

**Step 1: Create the builder module**

```typescript
/**
 * Shared GenerationRequest builder — single interface for constructing
 * PipelineParams across all generation flows.
 */

import type { GridLink, CellGroup, SpriteType } from '../context/AppContext';
import type { GridConfig } from './gridConfig';
import type { ContentPreset } from '../types/api';
import type { PipelineParams, HistoryExtras } from '../hooks/useGenericWorkflow';
import { buildPromptForType } from './promptForType';
import { gridPresetToConfig } from './gridConfig';

export interface GenerationRequestParams {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  gridConfig: GridConfig;
  prompt: string;
  model: string;
  imageSize: '2K' | '4K';
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high';
  referenceImage?: { data: string; mimeType: string };
  historyExtras?: HistoryExtras;
  sourceContext?: { groupId: string | null; contentPresetId: string | null };
}

/**
 * Build PipelineParams from a GridLink and ContentPreset.
 * All generation flows converge here.
 */
export function buildPipelineParams(params: GenerationRequestParams): PipelineParams {
  const { spriteType, contentPreset, gridLink, gridConfig, prompt, model, imageSize, thinkingLevel, referenceImage, historyExtras, sourceContext } = params;
  return {
    gridConfig,
    prompt,
    model,
    thinkingLevel,
    imageSize,
    spriteType,
    contentName: contentPreset.name,
    contentDescription: contentPreset.description,
    cellGroups: gridLink.cellGroups,
    referenceImage,
    historyExtras,
    sourceContext,
  };
}

/**
 * Convenience: build gridConfig + prompt + PipelineParams in one call.
 * Covers the common case for addSheet, runWorkflow, and regenerateWithFeedback.
 */
export function buildGenerationRequest(opts: {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  model: string;
  imageSize: '2K' | '4K';
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high';
  isSubsequentGrid: boolean;
  pixelizeSize?: number;
  referenceImage?: { data: string; mimeType: string };
  promptSuffix?: string;
  historyExtras?: HistoryExtras;
  sourceContext?: { groupId: string | null; contentPresetId: string | null };
}): PipelineParams {
  const { spriteType, contentPreset, gridLink, model, imageSize, thinkingLevel, isSubsequentGrid, pixelizeSize, referenceImage, promptSuffix, historyExtras, sourceContext } = opts;

  const gridConfig = gridPresetToConfig(gridLink, spriteType);
  let prompt = buildPromptForType(spriteType, contentPreset, gridLink, gridConfig, isSubsequentGrid, pixelizeSize);
  if (promptSuffix?.trim()) {
    prompt += '\n\n' + promptSuffix.trim();
  }

  return buildPipelineParams({
    spriteType,
    contentPreset,
    gridLink,
    gridConfig,
    prompt,
    model,
    imageSize,
    thinkingLevel,
    referenceImage,
    historyExtras,
    sourceContext,
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/generateRequest.ts
git commit -m "feat: add shared GenerationRequest builder for pipeline params"
```

---

### Task 4: Refactor useAddSheet to use GenerationRequest builder

**Files:**
- Modify: `src/hooks/useAddSheet.ts`

**Step 1: Replace manual param building with buildGenerationRequest**

Replace the gridConfig + prompt building + runGeneratePipeline call block (lines ~121-150) with:

```typescript
import { buildGenerationRequest } from '../lib/generateRequest';

// ... inside generate():

const pipelineParams = buildGenerationRequest({
  spriteType,
  contentPreset,
  gridLink: opts.gridLink,
  model: currentState.model,
  imageSize,
  thinkingLevel: currentState.thinkingLevel,
  isSubsequentGrid: true,
  referenceImage: { data: refBase64, mimeType: 'image/png' },
  promptSuffix: followUpGuidance,
  historyExtras: { groupId, contentPresetId },
  sourceContext: { groupId: groupId ?? null, contentPresetId: contentPresetId ?? null },
});

await runGeneratePipeline(pipelineParams, dispatch, abort.signal);
```

Remove the manual `gridPresetToConfig`, `buildPromptForType`, and prompt-concatenation code that this replaces.

**Step 2: Verify Add Sheet still works**

Run: Start dev server, generate a sprite sheet, click "Add Sheet", select a grid, generate.
Expected: Same behavior as before — new grid generated with reference.

**Step 3: Commit**

```bash
git add src/hooks/useAddSheet.ts
git commit -m "refactor: useAddSheet uses GenerationRequest builder"
```

---

### Task 5: Refactor useRunWorkflow to use GenerationRequest builder

**Files:**
- Modify: `src/hooks/useRunWorkflow.ts`

**Step 1: Replace manual param building with buildGenerationRequest**

In `generateCurrentGrid()` (lines ~51-82), replace the gridConfig + prompt + pipeline call with:

```typescript
import { buildGenerationRequest } from '../lib/generateRequest';

// ... inside generateCurrentGrid():

const isSubsequent = run.currentGridIndex > 0 && run.referenceSheet !== null;
const refImage = isSubsequent && run.referenceSheet
  ? { data: run.referenceSheet, mimeType: 'image/png' }
  : undefined;

const pipelineParams = buildGenerationRequest({
  spriteType: run.spriteType,
  contentPreset,
  gridLink,
  model: currentState.model,
  imageSize: run.imageSize,
  thinkingLevel: currentState.thinkingLevel,
  isSubsequentGrid: isSubsequent,
  pixelizeSize: run.pixelizeSize,
  referenceImage: refImage,
  historyExtras: { groupId: run.groupId, contentPresetId: run.contentPresetId },
  sourceContext: { groupId: run.groupId, contentPresetId: run.contentPresetId },
});

const result = await runGeneratePipeline(pipelineParams, dispatch, abort.signal);
```

**Step 2: Verify multi-grid run still works**

Run: Start dev server, select a preset with multiple linked grids, run generation.
Expected: All grids generated sequentially, reference sheet passed correctly.

**Step 3: Commit**

```bash
git add src/hooks/useRunWorkflow.ts
git commit -m "refactor: useRunWorkflow uses GenerationRequest builder"
```

---

### Task 6: Feedback types and prompt injection

**Files:**
- Create: `src/lib/feedbackPrompt.ts`
- Create: `src/types/feedback.ts`

**Step 1: Create feedback types**

```typescript
// src/types/feedback.ts

export interface CellFeedback {
  signedOff: boolean;
  feedback: string;
}

export interface GroupFeedback {
  feedback: string;
}

export interface FeedbackState {
  global: string;
  groups: Record<string, GroupFeedback>;   // keyed by group name
  cells: Record<number, CellFeedback>;     // keyed by cell index
}

/** Check if feedback state has any actual content */
export function hasFeedback(state: FeedbackState): boolean {
  if (state.global.trim()) return true;
  for (const g of Object.values(state.groups)) {
    if (g.feedback.trim()) return true;
  }
  for (const c of Object.values(state.cells)) {
    if (c.feedback.trim() || c.signedOff) return true;
  }
  return false;
}

/** Count cells that are NOT signed off */
export function unsignedOffCount(state: FeedbackState, totalCells: number): number {
  let count = 0;
  for (let i = 0; i < totalCells; i++) {
    if (!state.cells[i]?.signedOff) count++;
  }
  return count;
}

export function createEmptyFeedback(): FeedbackState {
  return { global: '', groups: {}, cells: {} };
}
```

**Step 2: Create feedback prompt injection**

```typescript
// src/lib/feedbackPrompt.ts

/**
 * Injects feedback annotations into a prompt for regeneration.
 * - Prepends a regeneration preamble with global feedback
 * - Augments the REFERENCE_PREFIX for regeneration context
 * - Returns a prompt suffix with per-cell and per-group feedback
 *   to be appended after buildGuidanceBlock output
 */

import type { FeedbackState } from '../types/feedback';
import type { CellGroup } from '../context/AppContext';

/** Preamble prepended before the reference prefix for regeneration */
export function buildRegenerationPreamble(feedback: FeedbackState): string {
  const lines = [
    'REGENERATION CONTEXT:',
    'You are regenerating a previously completed sprite sheet based on user feedback.',
    'IMAGE 1 is the previous attempt — use it as reference for approved cells and',
    'to understand what needs to change for cells with feedback.',
  ];
  if (feedback.global.trim()) {
    lines.push('');
    lines.push('GLOBAL FEEDBACK:');
    lines.push(feedback.global.trim());
  }
  return lines.join('\n') + '\n\n';
}

/**
 * Build per-cell feedback annotations to inject into the guidance block.
 * Returns a Record<string, string> keyed by cell label, where each value
 * is the feedback annotation line to append to that cell's guidance.
 */
export function buildCellFeedbackAnnotations(
  feedback: FeedbackState,
  cellLabels: string[],
): Record<string, string> {
  const annotations: Record<string, string> = {};

  for (let idx = 0; idx < cellLabels.length; idx++) {
    const cell = feedback.cells[idx];
    if (!cell) continue;

    const label = cellLabels[idx];
    if (!label) continue;

    if (cell.signedOff) {
      annotations[label] = 'APPROVED — This cell meets requirements. Preserve this appearance.';
    } else if (cell.feedback.trim()) {
      annotations[label] = `FEEDBACK: ${cell.feedback.trim()}`;
    }
  }

  return annotations;
}

/**
 * Build per-group feedback annotations.
 * Returns a Record<string, string> keyed by group name.
 */
export function buildGroupFeedbackAnnotations(
  feedback: FeedbackState,
): Record<string, string> {
  const annotations: Record<string, string> = {};

  for (const [groupName, groupFb] of Object.entries(feedback.groups)) {
    if (groupFb.feedback.trim()) {
      annotations[groupName] = `GROUP FEEDBACK: ${groupFb.feedback.trim()}`;
    }
  }

  return annotations;
}
```

**Step 3: Commit**

```bash
git add src/types/feedback.ts src/lib/feedbackPrompt.ts
git commit -m "feat: add FeedbackState types and feedback prompt injection utilities"
```

---

### Task 7: Augment buildGuidanceBlock to accept feedback annotations

**Files:**
- Modify: `src/lib/promptBuilderBase.ts:17-98`

**Step 1: Add optional feedback params to buildGuidanceBlock**

Update the function signature to accept optional annotation records:

```typescript
export function buildGuidanceBlock(
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): string {
```

**Step 2: Inject group annotations**

After the group-level guidance parts (around line 48), add:

```typescript
if (groupAnnotations?.[group.name]) {
  groupLines.push(groupAnnotations[group.name]);
}
```

**Step 3: Inject cell annotations in grouped cells**

After the cell guidance line (around line 66), add the cell annotation:

```typescript
const header = `  (${row},${col}) Cell "${label}"`;
const annotation = cellAnnotations?.[label];
if (cellGuidanceParts.length || annotation) {
  const allParts = [...cellGuidanceParts];
  if (annotation) allParts.push(annotation);
  groupLines.push(`${header}:\n    ${allParts.join('\n    ')}`);
} else {
  groupLines.push(header);
}
```

**Step 4: Inject cell annotations in ungrouped cells**

Same pattern in the ungrouped cells section (around line 90):

```typescript
const annotation = cellAnnotations?.[label];
if (cellGuidanceParts.length || annotation) {
  const allParts = [...cellGuidanceParts];
  if (annotation) allParts.push(annotation);
  return `${header}:\n    ${allParts.join('\n    ')}`;
}
return header;
```

**Step 5: Verify existing prompts unchanged**

Run: Start dev server, generate a sprite sheet. Check console debugLog output.
Expected: Prompt is identical to before (no annotations when params not passed).

**Step 6: Commit**

```bash
git add src/lib/promptBuilderBase.ts
git commit -m "feat: buildGuidanceBlock accepts optional cell and group feedback annotations"
```

---

### Task 8: Thread feedback annotations through buildPromptForType

**Files:**
- Modify: `src/lib/promptForType.ts:25-117`
- Modify: `src/lib/promptBuilder.ts` (character prompt builder — passes annotations through)
- Modify: `src/lib/buildingPromptBuilder.ts`
- Modify: `src/lib/terrainPromptBuilder.ts`
- Modify: `src/lib/backgroundPromptBuilder.ts`

**Step 1: Add optional feedback params to buildPromptForType**

```typescript
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: ContentPreset,
  gridLink: GridLink,
  _gridConfig: GridConfig,
  isSubsequentGrid: boolean,
  pixelizeSize?: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): string {
```

**Step 2: Pass annotations through to each sprite type's prompt builder**

Each builder calls `buildGuidanceBlock()` internally. Pass `cellAnnotations` and `groupAnnotations` as the new optional params. This requires updating each builder's signature to accept and forward them.

For each of `buildGridFillPrompt`, `buildGridFillPromptWithReference`, `buildBuildingPrompt`, `buildTerrainPrompt`, `buildBackgroundPrompt`:
- Add `cellAnnotations?: Record<string, string>` and `groupAnnotations?: Record<string, string>` as optional trailing params
- Forward them to their internal `buildGuidanceBlock()` call

**Step 3: Verify existing prompts unchanged**

Run: Generate a sprite sheet, check prompt output.
Expected: Identical to before — new params are optional and default to undefined.

**Step 4: Commit**

```bash
git add src/lib/promptForType.ts src/lib/promptBuilder.ts src/lib/buildingPromptBuilder.ts src/lib/terrainPromptBuilder.ts src/lib/backgroundPromptBuilder.ts
git commit -m "feat: thread feedback annotations through all prompt builders"
```

---

### Task 9: Update GenerationRequest builder for feedback

**Files:**
- Modify: `src/lib/generateRequest.ts`

**Step 1: Add feedback support to buildGenerationRequest**

Add to the options type:

```typescript
feedbackState?: FeedbackState;
```

Import types and feedback functions:

```typescript
import type { FeedbackState } from '../types/feedback';
import { buildRegenerationPreamble, buildCellFeedbackAnnotations, buildGroupFeedbackAnnotations } from './feedbackPrompt';
```

In `buildGenerationRequest`, after building the prompt, inject feedback:

```typescript
if (opts.feedbackState) {
  const cellAnnotations = buildCellFeedbackAnnotations(opts.feedbackState, gridLink.cellLabels);
  const groupAnnotations = buildGroupFeedbackAnnotations(opts.feedbackState);
  // Rebuild prompt with annotations
  prompt = buildPromptForType(spriteType, contentPreset, gridLink, gridConfig, isSubsequentGrid, pixelizeSize, cellAnnotations, groupAnnotations);
  if (promptSuffix?.trim()) {
    prompt += '\n\n' + promptSuffix.trim();
  }
  // Prepend regeneration preamble
  prompt = buildRegenerationPreamble(opts.feedbackState) + prompt;
}
```

**Step 2: Commit**

```bash
git add src/lib/generateRequest.ts
git commit -m "feat: GenerationRequest builder supports feedback state injection"
```

---

### Task 10: useRegenerateWithFeedback hook

**Files:**
- Create: `src/hooks/useRegenerateWithFeedback.ts`

**Step 1: Create the hook**

```typescript
/**
 * Hook for regenerating the current sprite sheet with structured feedback.
 * Reuses the same grid layout, sends the original grid as reference image,
 * and injects feedback annotations into the prompt.
 */

import { useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import type { GridLink } from '../context/AppContext';
import type { ContentPreset } from '../types/api';
import type { FeedbackState } from '../types/feedback';
import { runGeneratePipeline } from './useGenericWorkflow';
import { buildGenerationRequest } from '../lib/generateRequest';
import { fetchContentPreset } from '../lib/promptForType';

export interface RegenerateOptions {
  gridLink: GridLink;
  imageSize: '2K' | '4K';
  feedbackState: FeedbackState;
}

export function useRegenerateWithFeedback() {
  const { state, dispatch } = useAppContext();
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);

  const regenerate = useCallback(async (opts: RegenerateOptions) => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { gridLink, imageSize, feedbackState } = opts;
      const currentState = state;
      const { spriteType, historyId, filledGridImage, sourceContentPresetId: contentPresetId, sourceGroupId: groupId } = currentState;

      if (!filledGridImage) {
        dispatch({ type: 'SET_STATUS', message: 'No grid image to use as reference', statusType: 'error' });
        return;
      }

      // 1. Save feedback to current generation
      if (historyId) {
        await fetch(`/api/history/${historyId}/feedback`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackJson: JSON.stringify(feedbackState) }),
          signal: abort.signal,
        });
      }

      // 2. Fetch content preset
      let contentPreset: ContentPreset;
      if (contentPresetId) {
        contentPreset = await fetchContentPreset(spriteType, contentPresetId);
      } else {
        // Fallback: build minimal preset from state
        const { WORKFLOW_CONFIGS } = await import('./useGenericWorkflow');
        const content = WORKFLOW_CONFIGS[spriteType].getContent(currentState);
        contentPreset = { name: content.name, description: content.description };
      }

      // 3. Determine generation version
      let parentVersion = 1;
      if (historyId) {
        try {
          const resp = await fetch(`/api/history/${historyId}`, { signal: abort.signal });
          if (resp.ok) {
            const data = await resp.json();
            parentVersion = data.generationVersion || 1;
          }
        } catch { /* ignore — default to 1 */ }
      }

      // 4. Build pipeline params with feedback
      const pipelineParams = buildGenerationRequest({
        spriteType,
        contentPreset,
        gridLink,
        model: currentState.model,
        imageSize,
        thinkingLevel: currentState.thinkingLevel,
        isSubsequentGrid: true, // always has reference image
        referenceImage: { data: filledGridImage, mimeType: currentState.filledGridMimeType || 'image/png' },
        feedbackState,
        historyExtras: {
          groupId: groupId ?? undefined,
          contentPresetId: contentPresetId ?? undefined,
          parentHistoryId: historyId,
          generationVersion: parentVersion + 1,
        },
        sourceContext: {
          groupId: groupId ?? null,
          contentPresetId: contentPresetId ?? null,
        },
      });

      // 5. Run pipeline
      await runGeneratePipeline(pipelineParams, dispatch, abort.signal);

    } finally {
      generatingRef.current = false;
      abortRef.current = null;
    }
  }, [state, dispatch]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    generatingRef.current = false;
  }, []);

  return { regenerate, cancel, generating: generatingRef.current };
}
```

**Step 2: Update HistoryExtras type**

In `src/hooks/useGenericWorkflow.ts`, update the `HistoryExtras` interface to include the new fields:

```typescript
export interface HistoryExtras {
  groupId?: number | string | null;
  contentPresetId?: number | string | null;
  parentHistoryId?: number | null;
  generationVersion?: number;
}
```

**Step 3: Commit**

```bash
git add src/hooks/useRegenerateWithFeedback.ts src/hooks/useGenericWorkflow.ts
git commit -m "feat: add useRegenerateWithFeedback hook"
```

---

### Task 11: CellContextMenu component

**Files:**
- Create: `src/components/grid/CellContextMenu.tsx`

**Step 1: Create the component**

```typescript
/**
 * Kebab menu dropdown for sprite cells in review mode.
 * Replaces the three individual hover buttons (zoom, mirror, star)
 * with a single contextual menu adding sign-off and feedback actions.
 */

import React, { useState, useRef, useEffect } from 'react';

interface CellContextMenuProps {
  cellIndex: number;
  isMirrored: boolean;
  isThumbnail: boolean;
  isSignedOff: boolean;
  hasFeedback: boolean;
  onMirrorToggle: () => void;
  onThumbnailSet: () => void;
  onZoomClick: () => void;
  onSignOffToggle: () => void;
  onFeedbackClick: () => void;
}

export function CellContextMenu({
  cellIndex,
  isMirrored,
  isThumbnail,
  isSignedOff,
  hasFeedback,
  onMirrorToggle,
  onThumbnailSet,
  onZoomClick,
  onSignOffToggle,
  onFeedbackClick,
}: CellContextMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setOpen(false);
  };

  return (
    <div className="cell-context-menu" ref={menuRef}>
      <button
        className={`cell-menu-btn ${open ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        title="Cell actions"
      >
        &#x22EE;
      </button>

      {open && (
        <div className={`cell-menu-dropdown ${isMobile ? 'bottom-sheet' : ''}`}>
          <button className="cell-menu-item" onClick={handleAction(onZoomClick)}>
            <span className="cell-menu-icon">&#x1F50D;</span>
            Zoom / Inspect
          </button>
          <button className="cell-menu-item" onClick={handleAction(onMirrorToggle)}>
            <span className="cell-menu-icon">&#x21c4;</span>
            Mirror
            {isMirrored && <span className="cell-menu-check">&#x2713;</span>}
          </button>
          <button className="cell-menu-item" onClick={handleAction(onThumbnailSet)}>
            <span className="cell-menu-icon">{isThumbnail ? '\u2605' : '\u2606'}</span>
            Gallery Thumbnail
            {isThumbnail && <span className="cell-menu-check">&#x2713;</span>}
          </button>
          <div className="cell-menu-divider" />
          <button className="cell-menu-item" onClick={handleAction(onSignOffToggle)}>
            <span className="cell-menu-icon">&#x2705;</span>
            Sign Off
            {isSignedOff && <span className="cell-menu-check">&#x2713;</span>}
          </button>
          <button className="cell-menu-item" onClick={handleAction(onFeedbackClick)}>
            <span className="cell-menu-icon">&#x1F4AC;</span>
            Add Feedback
            {hasFeedback && <span className="cell-menu-badge">!</span>}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/grid/CellContextMenu.tsx
git commit -m "feat: add CellContextMenu kebab dropdown component"
```

---

### Task 12: Update SpriteGrid — replace hover buttons with CellContextMenu

**Files:**
- Modify: `src/components/grid/SpriteGrid.tsx`

**Step 1: Add new props for feedback**

Add to `SpriteGridProps`:

```typescript
feedbackState?: FeedbackState;
onSignOffToggle?: (cellIndex: number) => void;
onFeedbackClick?: (cellIndex: number) => void;
```

**Step 2: Replace the three buttons with CellContextMenu**

In the sprite cell render (lines 88-123), replace the three button blocks with:

```typescript
<CellContextMenu
  cellIndex={idx}
  isMirrored={isMirrored}
  isThumbnail={thumbnailCell === idx}
  isSignedOff={feedbackState?.cells[idx]?.signedOff ?? false}
  hasFeedback={!!feedbackState?.cells[idx]?.feedback?.trim()}
  onMirrorToggle={() => onMirrorToggle?.(idx)}
  onThumbnailSet={() => onThumbnailSet?.(idx)}
  onZoomClick={() => onZoomClick?.(idx)}
  onSignOffToggle={() => onSignOffToggle?.(idx)}
  onFeedbackClick={() => onFeedbackClick?.(idx)}
/>
```

**Step 3: Add visual indicators on cells**

Add CSS classes for signed-off and feedback states:

```typescript
className={`sprite-cell ${sprite ? '' : 'empty'} ${isSelected ? 'selected' : ''} ${feedbackState?.cells[idx]?.signedOff ? 'signed-off' : ''} ${feedbackState?.cells[idx]?.feedback?.trim() ? 'has-feedback' : ''}`}
```

**Step 4: Commit**

```bash
git add src/components/grid/SpriteGrid.tsx
git commit -m "feat: replace hover buttons with CellContextMenu in SpriteGrid"
```

---

### Task 13: GroupHeader component

**Files:**
- Create: `src/components/grid/GroupHeader.tsx`

**Step 1: Create the component**

```typescript
/**
 * Group header rendered above grouped cells in the review grid.
 * Shows group name and an expandable feedback text input.
 */

import React, { useState } from 'react';

interface GroupHeaderProps {
  groupName: string;
  feedback: string;
  onFeedbackChange: (value: string) => void;
}

export function GroupHeader({ groupName, feedback, onFeedbackChange }: GroupHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group-header">
      <div className="group-header-row">
        <span className="group-header-name">{groupName}</span>
        <button
          className={`btn btn-xs ${feedback.trim() ? 'btn-accent' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : feedback.trim() ? 'Edit Feedback' : 'Add Feedback'}
        </button>
      </div>
      {expanded && (
        <textarea
          className="group-feedback-input"
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          placeholder={`Feedback for ${groupName} group...`}
          rows={2}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/grid/GroupHeader.tsx
git commit -m "feat: add GroupHeader component with feedback input"
```

---

### Task 14: FeedbackPanel component

**Files:**
- Create: `src/components/grid/FeedbackPanel.tsx`

**Step 1: Create the component**

```typescript
/**
 * Feedback summary side panel.
 * Desktop: collapsible panel on the right.
 * Mobile: full-screen bottom sheet.
 * Shows global feedback, group feedback, per-cell status, and regenerate button.
 */

import React from 'react';
import type { FeedbackState } from '../../types/feedback';
import { hasFeedback } from '../../types/feedback';
import type { CellGroup } from '../../context/AppContext';

interface FeedbackPanelProps {
  open: boolean;
  onClose: () => void;
  feedbackState: FeedbackState;
  onFeedbackChange: (state: FeedbackState) => void;
  cellLabels: string[];
  cellGroups: CellGroup[];
  onRegenerate: () => void;
  regenerating: boolean;
}

export function FeedbackPanel({
  open,
  onClose,
  feedbackState,
  onFeedbackChange,
  cellLabels,
  cellGroups,
  onRegenerate,
  regenerating,
}: FeedbackPanelProps) {
  if (!open) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const updateGlobal = (value: string) => {
    onFeedbackChange({ ...feedbackState, global: value });
  };

  const updateGroup = (groupName: string, value: string) => {
    onFeedbackChange({
      ...feedbackState,
      groups: { ...feedbackState.groups, [groupName]: { feedback: value } },
    });
  };

  const updateCell = (idx: number, feedback: string) => {
    const existing = feedbackState.cells[idx] || { signedOff: false, feedback: '' };
    onFeedbackChange({
      ...feedbackState,
      cells: { ...feedbackState.cells, [idx]: { ...existing, feedback } },
    });
  };

  const groupedIndices = new Set(cellGroups.flatMap(g => g.cells));

  return (
    <div className={`feedback-panel ${isMobile ? 'bottom-sheet' : 'side-panel'}`}>
      <div className="feedback-panel-header">
        <h3>Feedback</h3>
        <button className="btn btn-xs" onClick={onClose}>Close</button>
      </div>

      <div className="feedback-panel-body">
        {/* Global */}
        <div className="feedback-section">
          <h4>Global Feedback</h4>
          <textarea
            value={feedbackState.global}
            onChange={(e) => updateGlobal(e.target.value)}
            placeholder="Overall feedback for the entire sheet..."
            rows={3}
          />
        </div>

        {/* Groups */}
        {cellGroups.length > 0 && (
          <div className="feedback-section">
            <h4>Groups</h4>
            {cellGroups.map((group) => (
              <div key={group.name} className="feedback-group-entry">
                <label>{group.name}</label>
                <textarea
                  value={feedbackState.groups[group.name]?.feedback || ''}
                  onChange={(e) => updateGroup(group.name, e.target.value)}
                  placeholder={`Feedback for ${group.name}...`}
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}

        {/* Cells */}
        <div className="feedback-section">
          <h4>Cells</h4>
          <div className="feedback-cell-list">
            {cellLabels.map((label, idx) => {
              const cell = feedbackState.cells[idx];
              const status = cell?.signedOff ? 'approved' : cell?.feedback?.trim() ? 'feedback' : 'none';
              return (
                <div key={idx} className={`feedback-cell-entry status-${status}`}>
                  <span className="feedback-cell-status">
                    {status === 'approved' ? '\u2705' : status === 'feedback' ? '\uD83D\uDCAC' : '\u25CB'}
                  </span>
                  <span className="feedback-cell-label">{label}</span>
                  {status === 'approved' && <span className="feedback-cell-tag">Signed Off</span>}
                  {status === 'feedback' && (
                    <span className="feedback-cell-preview" title={cell?.feedback}>
                      {cell?.feedback?.slice(0, 40)}...
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="feedback-panel-footer">
        <button
          className="btn btn-primary w-full"
          onClick={onRegenerate}
          disabled={regenerating || !hasFeedback(feedbackState)}
        >
          {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/grid/FeedbackPanel.tsx
git commit -m "feat: add FeedbackPanel side panel with global/group/cell feedback display"
```

---

### Task 15: CSS for contextual menu, feedback panel, group headers, cell indicators

**Files:**
- Modify: `src/styles/global.css`

**Step 1: Remove old hover button styles**

Delete or comment out the CSS blocks for `.cell-mirror-btn`, `.cell-thumb-btn`, `.cell-zoom-btn` (lines 865-964).

**Step 2: Add new styles**

Add after the sprite-cell styles:

```css
/* Cell Context Menu */
.cell-context-menu {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 5;
}

.cell-menu-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(14, 14, 24, 0.8);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.sprite-cell:hover .cell-menu-btn,
.cell-menu-btn.active {
  opacity: 1;
}

@media (max-width: 767px) {
  .cell-menu-btn {
    opacity: 1;
    width: 40px;
    height: 40px;
    font-size: 1.1rem;
  }
}

.cell-menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 180px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10;
  overflow: hidden;
}

.cell-menu-dropdown.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  top: auto;
  border-radius: var(--radius) var(--radius) 0 0;
  margin-top: 0;
}

.cell-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: var(--text);
  font-size: 0.75rem;
  cursor: pointer;
  text-align: left;
}

.cell-menu-item:hover {
  background: var(--surface-2);
}

.cell-menu-icon {
  width: 18px;
  text-align: center;
  font-size: 0.8rem;
}

.cell-menu-check {
  margin-left: auto;
  color: var(--accent);
  font-size: 0.7rem;
}

.cell-menu-badge {
  margin-left: auto;
  background: var(--accent);
  color: var(--surface-0);
  border-radius: 50%;
  width: 14px;
  height: 14px;
  font-size: 0.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-menu-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* Cell visual indicators */
.sprite-cell.signed-off {
  box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.5);
}

.sprite-cell.has-feedback::after {
  content: '\uD83D\uDCAC';
  position: absolute;
  bottom: 20px;
  left: 4px;
  font-size: 0.65rem;
  background: rgba(14, 14, 24, 0.8);
  border-radius: var(--radius-sm);
  padding: 1px 4px;
}

/* Group Header */
.group-header {
  grid-column: 1 / -1;
  padding: 6px 8px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-bottom: 2px;
}

.group-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-header-name {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text);
}

.group-feedback-input {
  width: 100%;
  margin-top: 6px;
  font-size: 0.7rem;
  background: var(--surface-0);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: 6px;
  resize: vertical;
}

/* Feedback Panel */
.feedback-panel {
  display: flex;
  flex-direction: column;
  background: var(--surface-0);
  border-left: 1px solid var(--border);
  overflow-y: auto;
}

.feedback-panel.side-panel {
  width: 320px;
  max-height: 100%;
}

.feedback-panel.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 80vh;
  border-top: 1px solid var(--border);
  border-left: none;
  border-radius: var(--radius) var(--radius) 0 0;
  z-index: 50;
}

.feedback-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.feedback-panel-header h3 {
  margin: 0;
  font-size: 0.85rem;
}

.feedback-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
}

.feedback-section {
  margin-bottom: 16px;
}

.feedback-section h4 {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 6px;
}

.feedback-section textarea {
  width: 100%;
  font-size: 0.72rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: 6px;
  resize: vertical;
}

.feedback-group-entry {
  margin-bottom: 8px;
}

.feedback-group-entry label {
  font-size: 0.7rem;
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.feedback-cell-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feedback-cell-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
}

.feedback-cell-entry.status-approved {
  background: rgba(34, 197, 94, 0.08);
}

.feedback-cell-entry.status-feedback {
  background: rgba(245, 197, 66, 0.08);
}

.feedback-cell-status {
  font-size: 0.65rem;
}

.feedback-cell-label {
  flex: 1;
  min-width: 0;
}

.feedback-cell-tag {
  font-size: 0.6rem;
  color: var(--text-muted);
}

.feedback-cell-preview {
  font-size: 0.6rem;
  color: var(--text-muted);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feedback-panel-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}

/* Mobile sticky regenerate bar */
@media (max-width: 767px) {
  .regen-sticky-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px 12px;
    background: var(--surface-0);
    border-top: 1px solid var(--border);
    z-index: 40;
  }
}
```

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: add CSS for contextual menu, feedback panel, group headers, cell indicators"
```

---

### Task 16: Integrate feedback into SpriteReview

**Files:**
- Modify: `src/components/grid/SpriteReview.tsx`

**Step 1: Add feedback state and imports**

At the top of `SpriteReview`, add:

```typescript
import { FeedbackPanel } from './FeedbackPanel';
import { GroupHeader } from './GroupHeader';
import type { FeedbackState } from '../../types/feedback';
import { createEmptyFeedback, hasFeedback } from '../../types/feedback';
import { useRegenerateWithFeedback } from '../../hooks/useRegenerateWithFeedback';

// Inside the component:
const [feedbackState, setFeedbackState] = useState<FeedbackState>(createEmptyFeedback);
const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
const { regenerate, cancel: cancelRegen, generating: regenerating } = useRegenerateWithFeedback();
```

**Step 2: Add feedback handlers**

```typescript
const handleSignOffToggle = useCallback((cellIndex: number) => {
  setFeedbackState(prev => {
    const existing = prev.cells[cellIndex] || { signedOff: false, feedback: '' };
    return {
      ...prev,
      cells: { ...prev.cells, [cellIndex]: { ...existing, signedOff: !existing.signedOff } },
    };
  });
}, []);

const handleCellFeedbackClick = useCallback((cellIndex: number) => {
  // Open feedback panel scrolled to this cell
  setFeedbackPanelOpen(true);
}, []);

const handleGroupFeedbackChange = useCallback((groupName: string, value: string) => {
  setFeedbackState(prev => ({
    ...prev,
    groups: { ...prev.groups, [groupName]: { feedback: value } },
  }));
}, []);

const handleRegenerate = useCallback(async () => {
  // Build a GridLink from current state
  const gridLink = /* reconstruct from activeGridConfig or currentGridLink */;
  await regenerate({
    gridLink,
    imageSize: state.imageSize as '2K' | '4K',
    feedbackState,
  });
  setFeedbackState(createEmptyFeedback());
  setFeedbackPanelOpen(false);
}, [regenerate, feedbackState, state]);
```

**Step 3: Pass feedback props to SpriteGrid**

Add to the `<SpriteGrid>` props:

```typescript
feedbackState={feedbackState}
onSignOffToggle={handleSignOffToggle}
onFeedbackClick={handleCellFeedbackClick}
```

**Step 4: Add FeedbackPanel to the layout**

After the `</aside>` tag, add:

```typescript
<FeedbackPanel
  open={feedbackPanelOpen}
  onClose={() => setFeedbackPanelOpen(false)}
  feedbackState={feedbackState}
  onFeedbackChange={setFeedbackState}
  cellLabels={dynamicCellLabels}
  cellGroups={effectiveCellGroups}
  onRegenerate={handleRegenerate}
  regenerating={regenerating}
/>
```

**Step 5: Add Regenerate with Feedback button to sidebar**

In the Export sidebar section (around line 1041), add after "Add Sheet":

```typescript
<button className="btn btn-primary w-full" onClick={() => setFeedbackPanelOpen(true)}>
  Feedback & Regenerate
</button>
```

Also add a direct regenerate button:

```typescript
{hasFeedback(feedbackState) && (
  <button className="btn btn-accent w-full" onClick={handleRegenerate} disabled={regenerating}>
    {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
  </button>
)}
```

**Step 6: Reset feedback on new generation**

In the load effect (where `state.historyId` changes), reset feedback:

```typescript
setFeedbackState(createEmptyFeedback());
```

**Step 7: Verify full flow**

Run: Start dev server, generate a sheet, sign off some cells, add feedback to others, add group/global feedback, click Regenerate with Feedback.
Expected: Feedback saved to DB, new generation with feedback-augmented prompt, review shows fresh state.

**Step 8: Commit**

```bash
git add src/components/grid/SpriteReview.tsx
git commit -m "feat: integrate feedback state, panel, and regeneration into SpriteReview"
```

---

### Task 17: Mobile bottom sheet and sticky regenerate bar

**Files:**
- Modify: `src/components/grid/FeedbackPanel.tsx` (add drag handle for bottom sheet)
- Modify: `src/components/grid/SpriteReview.tsx` (add mobile sticky bar)

**Step 1: Add drag handle to bottom sheet mode**

In FeedbackPanel, when `isMobile`, add a drag handle div before the header:

```typescript
{isMobile && <div className="bottom-sheet-handle" />}
```

**Step 2: Add mobile sticky regenerate bar**

In SpriteReview, add after the feedback panel:

```typescript
{hasFeedback(feedbackState) && window.innerWidth < 768 && (
  <div className="regen-sticky-bar">
    <button className="btn btn-primary w-full" onClick={handleRegenerate} disabled={regenerating}>
      {regenerating ? 'Regenerating...' : 'Regenerate with Feedback'}
    </button>
  </div>
)}
```

**Step 3: Add bottom sheet handle CSS**

```css
.bottom-sheet-handle {
  width: 32px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin: 8px auto;
}
```

**Step 4: Commit**

```bash
git add src/components/grid/FeedbackPanel.tsx src/components/grid/SpriteReview.tsx src/styles/global.css
git commit -m "feat: mobile bottom sheet and sticky regenerate bar"
```

---

### Task 18: Integration testing — full flow verification

**Files:** None (manual testing)

**Step 1: Test basic regeneration flow**

1. Generate a sprite sheet
2. Sign off cells 0, 1, 2 via contextual menu
3. Add feedback to cell 3: "Make the pose more dynamic"
4. Add group feedback for first group: "More variation between frames"
5. Add global feedback: "Colors are too muted, increase saturation"
6. Click "Regenerate with Feedback"
7. Verify: feedback saved to DB (check `/api/history/:id`)
8. Verify: new generation has `parent_history_id` and `generation_version = 2`
9. Verify: prompt contains regeneration preamble, APPROVED annotations, FEEDBACK annotations
10. Verify: fresh feedback state on new generation

**Step 2: Test mobile layout**

1. Resize to < 768px
2. Verify: kebab menu always visible, opens as bottom sheet
3. Verify: feedback panel opens as bottom sheet
4. Verify: sticky regenerate bar appears when feedback exists

**Step 3: Test that existing flows still work**

1. Generate via normal configure → generate flow
2. Use Add Sheet to add a new grid
3. Run a multi-grid generation
4. Verify: all three flows work as before

**Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: integration test fixes for feedback regeneration"
```
