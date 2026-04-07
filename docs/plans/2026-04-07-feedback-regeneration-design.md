# Feedback-Driven Regeneration Design

## Overview

A new workflow that lets users provide structured feedback (global, per-group, per-cell) on a generated sprite sheet and regenerate it with the same grid layout. Signed-off cells are marked as approved in the prompt. The original grid image is sent as reference. Feedback and version chains are persisted in the database.

## Approach: Shared Pipeline, Separate Orchestration (Option C)

Extract the common generation pipeline into a shared `GenerationRequest` builder. Existing hooks (`useGenericWorkflow`, `useAddSheet`, `useRunWorkflow`) refactor to use the builder. A new `useRegenerateWithFeedback` hook becomes a fourth consumer — reusing the current grid link, the original grid.jpg as reference, and a feedback-augmented prompt.

## Feedback State Model

```typescript
interface CellFeedback {
  signedOff: boolean;       // true = approved
  feedback: string;         // free-text feedback
}

interface GroupFeedback {
  feedback: string;         // free-text feedback for group
}

interface FeedbackState {
  global: string;                              // overall feedback
  groups: Record<string, GroupFeedback>;       // keyed by group name
  cells: Record<number, CellFeedback>;         // keyed by cell index
}
```

Feedback lives in component state during review (ephemeral). On regeneration, it is persisted to the parent generation's DB record before the new generation starts. New generations start with a fresh feedback state.

## DB Schema Additions

```sql
ALTER TABLE history ADD COLUMN feedback_json TEXT;        -- FeedbackState JSON
ALTER TABLE history ADD COLUMN parent_history_id INTEGER REFERENCES history(id);
ALTER TABLE history ADD COLUMN generation_version INTEGER DEFAULT 1;
```

- `feedback_json`: the structured feedback provided *about* this generation (saved when user regenerates from it)
- `parent_history_id`: links to the generation this was regenerated from (v1 → v2 → v3 chain)
- `generation_version`: increments along the chain

## Prompt Construction

The prompt is built from the **original guidance** (same `buildPromptForType` call) with feedback injected at two points:

### Regeneration Preamble (prepended before REFERENCE_PREFIX)

```
REGENERATION CONTEXT:
You are regenerating a previously completed sprite sheet based on user feedback.
IMAGE 1 is the previous attempt — use it as reference for approved cells and
to understand what needs to change for cells with feedback.

GLOBAL FEEDBACK:
{global feedback text}
```

### Per-Cell Annotations (injected into guidance block)

Signed-off cell:
```
(0,2) Cell "Walk East 1":
    Face right, mid-stride pose
    APPROVED — This cell meets requirements. Preserve this appearance.
```

Cell with feedback:
```
(1,0) Cell "Attack South 1":
    Sword swing, facing camera
    FEEDBACK: The sword angle looks wrong, should be more diagonal.
```

### Group-Level Feedback (at group header)

```
── Idle Animations ──
GROUP FEEDBACK: All idle poses feel too stiff, add more natural weight shifting.
  (0,0) Cell "Idle South 1": ...
```

## UI Components

### Cell Contextual Menu

Replace three hover buttons (zoom, mirror, star) with a single kebab menu button in upper-right of each cell. Dropdown contains:

- Zoom / Inspect
- Mirror (checkmark when active)
- Gallery Thumbnail (checkmark when active)
- Sign Off (checkmark when signed off)
- Add Feedback (opens inline text input)

Visual indicators on cells: green border/overlay for signed-off, badge for feedback.

### Group Headers

Rendered above cell clusters in the review grid. Each has a group name label and "Add Feedback" button expanding an inline text input.

### Feedback Summary Panel

Collapsible side panel (right side):

- Global feedback text area at top
- Groups section — each group with its feedback
- Cells section — status icons per cell (signed off, has feedback, no action)
- "Regenerate with Feedback" button at bottom

### Regenerate Button

Also in the main review action bar alongside "Add Sprite Sheet."

### Mobile Responsive

- **Feedback panel (<768px):** Full-screen bottom sheet with drag handle. Grid hidden when open.
- **Contextual menu (<768px):** Always-visible kebab button (40px tap target), opens as bottom sheet.
- **Regenerate button (<768px):** Sticky bottom bar when feedback exists.

## Data Flow

```
Review Screen (generation v1)
  ├── User: signs off cells, adds cell/group/global feedback
  ├── Clicks "Regenerate with Feedback"
  │
  ▼
Save feedback to v1
  ├── PATCH /api/history/{v1.id}/feedback → saves feedback_json
  │
  ▼
Build regeneration request
  ├── Load original grid.jpg from v1's archive path as reference
  ├── Build prompt via buildPromptForType (same grid link, same content preset)
  ├── Inject regeneration preamble + per-cell/group annotations
  ├── GenerationRequest.withReference(v1 grid.jpg)
  │
  ▼
runGeneratePipeline
  ├── historyExtras: { parentHistoryId: v1.id, generationVersion: v1.version + 1 }
  ├── Same groupId, same contentPresetId
  │
  ▼
Review Screen (generation v2)
  ├── Fresh feedback state
  ├── v2.parent_history_id = v1.id
  ├── v2.generation_version = 2
  └── Can regenerate again → v3, etc.
```

## API Changes

- `PATCH /api/history/:id/feedback` — saves feedback_json
- `GET /api/history/:id/chain` — returns full version chain (future use)
- History POST body gains `parentHistoryId` and `generationVersion` fields

## New Files

- `src/lib/generateRequest.ts` — shared GenerationRequest builder
- `src/lib/feedbackPrompt.ts` — feedback preamble + annotation injection
- `src/hooks/useRegenerateWithFeedback.ts` — orchestration hook
- `src/components/grid/CellContextMenu.tsx` — kebab menu component
- `src/components/grid/FeedbackPanel.tsx` — summary side panel / mobile bottom sheet
- `src/components/grid/GroupHeader.tsx` — group header with feedback input
- DB migration for new columns

## Refactored Files

- `src/hooks/useGenericWorkflow.ts` — use GenerationRequest builder
- `src/hooks/useAddSheet.ts` — use GenerationRequest builder
- `src/hooks/useRunWorkflow.ts` — use GenerationRequest builder
- `src/components/grid/SpriteGrid.tsx` — replace hover buttons with contextual menu, add group headers
- `src/lib/promptBuilderBase.ts` — support feedback annotation injection
