# Structured Prompts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use h-superpowers:subagent-driven-development, h-superpowers:team-driven-development, or h-superpowers:executing-plans to implement this plan (ask user which approach).

**Goal:** Replace string-based prompt building with a structured `PromptPart[]` system that interleaves text and images, maps directly to Gemini's multi-modal API, unifies all 4 generation entry points, and adds a debug view.

**Architecture:** New `PromptPart` discriminated union type. Type builders return `{ subject, instructions }` as `PromptPart[]`. Single assembler in `promptForType.ts` composes full `StructuredPrompt`. API client sends parts array; server maps directly to Gemini format. All hooks route through `buildGenerationRequest()`.

**Tech Stack:** React 19, TypeScript, Vitest, Gemini API (generateContent with inline_data parts)

---

## Phase 1: Types + Builder Reshaping

### Task 1: Create PromptPart type system

**Files:**
- Create: `src/types/prompt.ts`
- Test: `src/lib/__tests__/promptAssembler.test.ts` (scaffold)

**Step 1: Create the types file**

```typescript
// src/types/prompt.ts
export type PromptPart =
  | { type: 'text'; content: string }
  | { type: 'image'; data: string; mimeType: string; label?: string };

/** Complete structured prompt ready for the API */
export interface StructuredPrompt {
  parts: PromptPart[];
  /** Metadata for debug/history — not sent to API */
  meta: {
    spriteType: string;
    hasReference: boolean;
    hasFeedback: boolean;
    sectionBreakdown: { name: string; partIndex: number }[];
  };
}

/** Return type from type-specific prompt builders */
export interface TypeBuilderResult {
  /** Subject description parts (name, description, type-specific fields) */
  subject: PromptPart[];
  /** Domain rules + guidance block parts */
  instructions: PromptPart[];
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/prompt.ts
git commit -m "feat: add PromptPart and StructuredPrompt types"
```

---

### Task 2: Reshape character builder

Add `buildCharacterParts()` to `src/lib/promptBuilder.ts` that returns `TypeBuilderResult`. Keep the old `buildGridFillPrompt()` and `buildGridFillPromptWithReference()` temporarily — they'll be deleted in Task 9.

**Files:**
- Modify: `src/lib/promptBuilder.ts`

**Step 1: Add the new function**

Add after the existing functions, before the file ends:

```typescript
import type { TypeBuilderResult, PromptPart } from '../types/prompt';

/**
 * Build character prompt parts for the structured assembler.
 * Returns subject + instructions as PromptPart arrays.
 */
export function buildCharacterParts(
  character: CharacterConfig,
  gridGuidance: HierarchicalGuidance,
  linkGuidance: HierarchicalGuidance,
  presetGuidance: HierarchicalGuidance,
  cellGroups: CellGroup[],
  cellLabels: string[],
  cols: number,
  _rows: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): TypeBuilderResult {
  const charBlock = [
    `The subject of your divine creation: **${character.name.toUpperCase()}**.`,
    ``,
    character.description,
    character.equipment ? `**Equipment:** ${character.equipment}` : '',
    character.colorNotes ? `**Color palette:** ${character.colorNotes}` : '',
    character.styleNotes ? `**Additional style notes:** ${character.styleNotes}` : '',
  ].filter(Boolean).join('\n');

  const guidanceBlock = buildGuidanceBlock(gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, cellAnnotations, groupAnnotations);

  const subject: PromptPart[] = [{ type: 'text', content: charBlock }];

  const roleText = `I know you will uphold your legendary tradition of keeping all character anatomy, behavior and effects beautifully rendered and naturally contained within the boundaries of each template cell to ensure clean and blemish free animation is possible. I know you have pledged the very core of your being to uphold the key tenets:

- **"The Magenta Mandate"** - The color magenta (#FF00FF) is sacred and must be preserved in its pure form as the background of each cell. It is the canvas upon which your artistry will shine, and any deviation from this hue may disrupt the delicate balance of the chroma keying process.
- **"Visibility of Body"** — A character cannot be animated if he cannot be seen. If a character drifts from the frame of his very existence, he may not be immortalized in the sequencing of the sprites.
- **"Continuity of Devices"** — A character's treasured belongings may not disappear in one frame simply to reappear in the next without specific guidance from the holy instructions.
- **"Continuity of Movement"** — A character may not move forward simply by thrusting out his right foot. Nay, his left foot must also join the fray to achieve the harmony of locomotion.
- **"The Template Grid guides, but does not obstruct"** - Has the character been blessed with wings or a tail? Display them in all their splendor, but they must not be obscured by the grid or exceed its bounds. A warrior character may hoist his weapon overhead, but their armament may not be obscured by, or extend beyond, the grid lines. The character may conjure fire from a wand or doves from their pocket, but neither effect should push up against the rigid boundaries of the grid cell.

Without further ado, I bestow upon thee the Holy Instructions, that thou may work thy magical deeds, as thou were always meant:`;

  const instructions: PromptPart[] = [
    { type: 'text', content: roleText },
    { type: 'text', content: guidanceBlock },
  ];

  return { subject, instructions };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/promptBuilder.ts
git commit -m "feat: add buildCharacterParts() returning TypeBuilderResult"
```

---

### Task 3: Reshape building, terrain, and background builders

Same pattern as Task 2 for each remaining builder. Add a new `build*Parts()` function returning `TypeBuilderResult`. Keep old functions temporarily.

**Files:**
- Modify: `src/lib/buildingPromptBuilder.ts`
- Modify: `src/lib/terrainPromptBuilder.ts`
- Modify: `src/lib/backgroundPromptBuilder.ts`

**Step 1: Add `buildBuildingParts()` to `buildingPromptBuilder.ts`**

The `subject` part contains the building name/description/details block. The `instructions` part contains: CHROMA BACKGROUND IS SACRED, CENTERING IS CRITICAL, FULL VISIBILITY, CONSISTENCY rules, plus the guidance block. The grid-intro text ("You are filling in a sprite sheet template. The attached image is a...") moves to the assembler.

Follow the same pattern as Task 2: extract the domain-specific text into subject + instructions, leaving role intro, closing instruction, and template references to the assembler.

**Step 2: Add `buildTerrainParts()` to `terrainPromptBuilder.ts`**

Subject: terrain name/description. Instructions: CHROMA, TILEABILITY, FILL THE CELL, CONSISTENCY rules + guidance block.

**Step 3: Add `buildBackgroundParts()` to `backgroundPromptBuilder.ts`**

Subject: background name/description/mode. Instructions: CHROMA, parallax-or-scene mode guidance, CONSISTENCY + guidance block.

**Step 4: Verify all compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/buildingPromptBuilder.ts src/lib/terrainPromptBuilder.ts src/lib/backgroundPromptBuilder.ts
git commit -m "feat: add build*Parts() to building, terrain, background builders"
```

---

## Phase 2: Assembler + API Layer

### Task 4: Create the structured prompt assembler

Rewrite `promptForType.ts` to add `assemblePrompt()` and `assembleEditPrompt()` — both return `StructuredPrompt`. Keep old `buildPromptForType()` temporarily.

**Files:**
- Modify: `src/lib/promptForType.ts`
- Create: `src/lib/__tests__/promptAssembler.test.ts`

**Step 1: Write failing tests for assemblePrompt**

```typescript
// src/lib/__tests__/promptAssembler.test.ts
import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '../promptForType';

function makeGridLink(overrides: Record<string, any> = {}) {
  return {
    id: 1, gridPresetId: 1,
    gridGuidance: { overall: '', groups: {}, cells: {} },
    linkGuidance: { overall: '', groups: {}, cells: {} },
    sortOrder: 0, gridName: 'Test', gridSize: '3x3',
    cols: 3, rows: 3,
    cellLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    cellGroups: [], aspectRatio: '1:1', tileShape: 'square' as const,
    ...overrides,
  };
}

describe('assemblePrompt', () => {
  const preset = { name: 'Knight', description: 'A noble knight', equipment: 'Sword', colorNotes: '' };

  it('returns StructuredPrompt with correct part types', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false,
    });
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.parts.every(p => p.type === 'text' || p.type === 'image')).toBe(true);
    expect(result.meta.spriteType).toBe('character');
    expect(result.meta.hasReference).toBe(false);
  });

  it('includes reference image part when isSubsequentGrid with referenceImage', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: true,
      referenceImage: { data: 'base64ref', mimeType: 'image/png' },
    });
    const imageParts = result.parts.filter(p => p.type === 'image');
    expect(imageParts.length).toBe(1); // reference image only; template added by pipeline
    expect(result.meta.hasReference).toBe(true);
  });

  it('includes template image part when provided', () => {
    const result = assemblePrompt({
      spriteType: 'building', contentPreset: { name: 'Castle', description: 'A castle', details: '' },
      gridLink: makeGridLink(), isSubsequentGrid: false,
      templateImage: { data: 'base64tmpl', mimeType: 'image/png' },
    });
    const imageParts = result.parts.filter(p => p.type === 'image');
    expect(imageParts.length).toBe(1); // template
  });

  it('section breakdown includes expected sections', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false,
    });
    const names = result.meta.sectionBreakdown.map(s => s.name);
    expect(names).toContain('role');
    expect(names).toContain('subject');
    expect(names).toContain('instructions');
  });

  it('includes pixelize guidance when pixelizeSize provided', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false, pixelizeSize: 32,
    });
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('TARGET PIXEL SIZE: 32');
  });

  it('includes feedback preamble when feedbackState provided', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: true,
      referenceImage: { data: 'ref', mimeType: 'image/png' },
      feedbackState: { global: 'Make it better', groups: {}, cells: {} },
    });
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('REGENERATION CONTEXT');
    expect(textContent).toContain('Make it better');
    expect(result.meta.hasFeedback).toBe(true);
  });
});
```

**Step 2: Run tests — verify they fail**

Run: `npx vitest run src/lib/__tests__/promptAssembler.test.ts`
Expected: FAIL — `assemblePrompt` not found

**Step 3: Implement `assemblePrompt()` and `assembleEditPrompt()`**

Add to `src/lib/promptForType.ts`:

```typescript
import type { StructuredPrompt, PromptPart } from '../types/prompt';
import type { FeedbackState } from '../types/feedback';
import { buildCharacterParts } from './promptBuilder';
import { buildBuildingParts } from './buildingPromptBuilder';
import { buildTerrainParts } from './terrainPromptBuilder';
import { buildBackgroundParts } from './backgroundPromptBuilder';
import { getPixelizeGuidance } from './promptBuilderBase';
import { buildRegenerationPreamble, buildCellFeedbackAnnotations, buildGroupFeedbackAnnotations, buildEditPrompt } from './feedbackPrompt';

export interface AssemblePromptOptions {
  spriteType: SpriteType;
  contentPreset: ContentPreset;
  gridLink: GridLink;
  isSubsequentGrid: boolean;
  pixelizeSize?: number;
  referenceImage?: { data: string; mimeType: string };
  templateImage?: { data: string; mimeType: string };
  feedbackState?: FeedbackState;
  promptSuffix?: string;
}

export function assemblePrompt(opts: AssemblePromptOptions): StructuredPrompt {
  const { spriteType, contentPreset, gridLink, isSubsequentGrid, pixelizeSize, referenceImage, templateImage, feedbackState, promptSuffix } = opts;
  const { gridGuidance, linkGuidance, cellGroups, cellLabels, cols, rows } = gridLink;

  const presetGuidance: HierarchicalGuidance = {
    overall: contentPreset.overallGuidance || '',
    groups: contentPreset.groupGuidance || {},
    cells: contentPreset.cellGuidance || {},
  };

  // Build feedback annotations if present
  let cellAnnotations: Record<string, string> | undefined;
  let groupAnnotations: Record<string, string> | undefined;
  if (feedbackState) {
    cellAnnotations = buildCellFeedbackAnnotations(feedbackState, cellLabels);
    groupAnnotations = buildGroupFeedbackAnnotations(feedbackState);
  }

  // Get type-specific parts
  let builderResult;
  switch (spriteType) {
    case 'character':
      builderResult = buildCharacterParts(
        { name: contentPreset.name, description: contentPreset.description, equipment: contentPreset.equipment || '', colorNotes: contentPreset.colorNotes || '', styleNotes: '' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    case 'building':
      builderResult = buildBuildingParts(
        { name: contentPreset.name, description: contentPreset.description, details: contentPreset.details || '', colorNotes: contentPreset.colorNotes || '', styleNotes: '' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    case 'terrain':
      builderResult = buildTerrainParts(
        { name: contentPreset.name, description: contentPreset.description, colorNotes: contentPreset.colorNotes || '', styleNotes: '' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    case 'background':
      builderResult = buildBackgroundParts(
        { name: contentPreset.name, description: contentPreset.description, colorNotes: contentPreset.colorNotes || '', styleNotes: '', bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax' },
        gridGuidance, linkGuidance, presetGuidance, cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      break;
    default:
      throw new Error(`Unknown sprite type: ${spriteType}`);
  }

  // Compose the full part sequence
  const parts: PromptPart[] = [];
  const sections: { name: string; partIndex: number }[] = [];

  // 1. Feedback preamble (if regenerating)
  if (feedbackState) {
    sections.push({ name: 'feedback-preamble', partIndex: parts.length });
    parts.push({ type: 'text', content: buildRegenerationPreamble(feedbackState).trim() });
  }

  // 2. Role intro
  sections.push({ name: 'role', partIndex: parts.length });
  parts.push({ type: 'text', content: buildRoleIntro(spriteType, cols, rows) });

  // 3. Subject
  sections.push({ name: 'subject', partIndex: parts.length });
  parts.push(...builderResult.subject);

  // 4. Reference image (if subsequent grid)
  if (isSubsequentGrid && referenceImage) {
    sections.push({ name: 'reference', partIndex: parts.length });
    parts.push({ type: 'text', content: 'Use this previously completed sprite sheet ONLY as a visual reference to maintain consistent proportions, color palette, art style, and character identity. Do NOT replicate its layout or poses.' });
    parts.push({ type: 'image', data: referenceImage.data, mimeType: referenceImage.mimeType, label: 'reference' });
  }

  // 5. Instructions (type-specific rules + guidance block)
  sections.push({ name: 'instructions', partIndex: parts.length });
  parts.push(...builderResult.instructions);

  // Pixelize guidance
  const pixelGuide = getPixelizeGuidance(pixelizeSize);
  if (pixelGuide) parts.push({ type: 'text', content: pixelGuide });

  // Prompt suffix (follow-up guidance from add-sheet)
  if (promptSuffix?.trim()) parts.push({ type: 'text', content: promptSuffix.trim() });

  // 6. Canvas (template adherence + template image)
  sections.push({ name: 'canvas', partIndex: parts.length });
  parts.push({ type: 'text', content: 'Return the completed sprite sheet as a single image. Preserve ALL header text exactly.' });
  if (templateImage) {
    parts.push({ type: 'image', data: templateImage.data, mimeType: templateImage.mimeType, label: 'template' });
  }

  return {
    parts,
    meta: {
      spriteType,
      hasReference: isSubsequentGrid && !!referenceImage,
      hasFeedback: !!feedbackState,
      sectionBreakdown: sections,
    },
  };
}

/** Build the role intro text. Shared across all types, varies by grid dimensions. */
function buildRoleIntro(spriteType: SpriteType, cols: number, rows: number): string {
  if (spriteType === 'character') {
    return `Greetings, expert sprite designer! Your chroma-keyed, cell-labeled template will be provided. Your mission is to complete the template with the finely-crafted game sprites you've become famous for. Keep the magenta (#FF00FF) background intact behind each sprite — it is required for chroma keying.`;
  }
  const totalCells = cols * rows;
  return `You are filling in a sprite sheet template. The template is a ${cols}\u00d7${rows} grid (${totalCells} cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has a thin black header strip with white text labeling the variant. You MUST preserve every header strip and its text exactly as-is \u2014 do not erase, move, or redraw them.`;
}

/**
 * Assemble a StructuredPrompt for edit mode (regeneration with feedback).
 * Different structure: no template image, source image instead, targeted feedback only.
 */
export function assembleEditPrompt(opts: {
  feedbackState: FeedbackState;
  cellLabels: string[];
  cellGroups: CellGroup[];
  cols: number;
  sourceImage: { data: string; mimeType: string };
}): StructuredPrompt {
  const { feedbackState, cellLabels, cellGroups, cols, sourceImage } = opts;

  const editText = buildEditPrompt(feedbackState, cellLabels, cellGroups, cols);

  const parts: PromptPart[] = [
    { type: 'text', content: 'You are editing an existing sprite sheet image. The source image is provided below. Make ONLY the targeted changes described in the instructions.' },
    { type: 'image', data: sourceImage.data, mimeType: sourceImage.mimeType, label: 'source' },
    { type: 'text', content: editText },
  ];

  return {
    parts,
    meta: {
      spriteType: 'edit',
      hasReference: false,
      hasFeedback: true,
      sectionBreakdown: [
        { name: 'role', partIndex: 0 },
        { name: 'source-image', partIndex: 1 },
        { name: 'edit-instructions', partIndex: 2 },
      ],
    },
  };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/promptAssembler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/promptForType.ts src/lib/__tests__/promptAssembler.test.ts
git commit -m "feat: add assemblePrompt() and assembleEditPrompt() returning StructuredPrompt"
```

---

### Task 5: Update API client and server

The API client sends `StructuredPrompt.parts` instead of separate prompt + image args. The server maps the parts array to Gemini format.

**Files:**
- Modify: `src/api/geminiClient.ts`
- Modify: `server/routes/generate.js`

**Step 1: Add `generateFromStructuredPrompt()` to `geminiClient.ts`**

```typescript
import type { StructuredPrompt } from '../types/prompt';

export async function generateFromStructuredPrompt(
  model: string,
  structuredPrompt: StructuredPrompt,
  imageSize: string = '2K',
  signal?: AbortSignal,
  aspectRatio: string = '1:1',
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high',
): Promise<GridGenerateResult> {
  const body: Record<string, unknown> = {
    model,
    structuredParts: structuredPrompt.parts,
    imageSize,
    aspectRatio,
  };
  if (thinkingLevel && thinkingLevel !== 'default') body.thinkingLevel = thinkingLevel;

  const response = await fetch('/api/generate-grid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Generation failed (${response.status})`);
  }

  return response.json();
}
```

**Step 2: Update server `generate.js` to handle `structuredParts`**

Add a new function and update the route handler to check for `structuredParts`:

```javascript
function structuredPartsToGemini(parts) {
  return parts.map(part =>
    part.type === 'text'
      ? { text: part.content }
      : { inline_data: { mime_type: part.mimeType || 'image/png', data: part.data } }
  );
}
```

In the route handler (after edit mode check, before the existing generate mode block), add:

```javascript
// ── Structured parts mode ──
if (req.body.structuredParts) {
  const { structuredParts, imageSize = '2K', aspectRatio = '1:1', thinkingLevel } = req.body;
  const err = firstError(
    validateModel(model),
    validateEnum(imageSize, ALLOWED_IMAGE_SIZES, 'imageSize'),
    validateEnum(aspectRatio, ALLOWED_ASPECT_RATIOS, 'aspectRatio'),
    validateEnum(thinkingLevel, ALLOWED_THINKING_LEVELS, 'thinkingLevel'),
  );
  if (err) return res.status(400).json({ error: err });

  const parts = structuredPartsToGemini(structuredParts);
  const body = { contents: [{ parts }], generationConfig: buildGenerationConfig(aspectRatio, imageSize, thinkingLevel) };
  console.log(`[Generate:${rid}] structured payload ~${(JSON.stringify(body).length / 1024 / 1024).toFixed(2)}MB, imageSize: ${imageSize}, parts: ${parts.length}`);

  const response = await callGemini(apiKey, model, body);
  const result = await handleGeminiResponse(response, rid, 'Generate');
  return res.status(result.status).json(result.body);
}
```

**Step 3: Verify both compile/work**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass (old code still works, new code added alongside)

**Step 4: Commit**

```bash
git add src/api/geminiClient.ts server/routes/generate.js
git commit -m "feat: add structured parts support to API client and server"
```

---

## Phase 3: Pipeline Integration

### Task 6: Update PipelineParams and runGeneratePipeline

Change `PipelineParams.prompt` from `string` to `StructuredPrompt`. Update `runGeneratePipeline()` to use the new API client function. The template image is now added to the StructuredPrompt inside the pipeline (since the pipeline generates the template).

**Files:**
- Modify: `src/hooks/useGenericWorkflow.ts`

**Step 1: Update PipelineParams type**

Change line 48 from `prompt: string;` to:
```typescript
prompt: string | StructuredPrompt;
```

This allows both old (string) and new (StructuredPrompt) callers during migration.

**Step 2: Update runGeneratePipeline to handle StructuredPrompt**

After template generation (line ~100, after `dispatch({ type: 'GENERATE_START', ... })`), update the Gemini API call section:

```typescript
// 2. Call Gemini API
if (typeof prompt === 'string') {
  // Legacy string path — used by useGenericWorkflow.generate() until migrated
  debugLog('[Gemini Prompt]\n' + prompt);
  const result = await generateGrid(model, prompt, { data: template.base64, mimeType: 'image/png' }, imageSize, signal, referenceImage, aspectRatio, thinkingLevel);
  // ... rest unchanged
} else {
  // Structured prompt path — inject template image into the prompt
  const promptWithTemplate: StructuredPrompt = {
    ...prompt,
    parts: prompt.parts.map(p =>
      // Replace the template placeholder or append at canvas section
      p
    ),
  };
  // Find the canvas section and insert template image after canvas text
  const canvasIdx = prompt.meta.sectionBreakdown.find(s => s.name === 'canvas')?.partIndex;
  const finalParts = [...prompt.parts];
  if (canvasIdx !== undefined) {
    // Template image goes right after the canvas text part
    finalParts.splice(canvasIdx + 1, 0, { type: 'image', data: template.base64, mimeType: 'image/png', label: 'template' });
  } else {
    finalParts.push({ type: 'image', data: template.base64, mimeType: 'image/png', label: 'template' });
  }
  const finalPrompt = { ...prompt, parts: finalParts };
  debugLog('[Gemini Structured Prompt] parts:', finalPrompt.parts.length, 'sections:', finalPrompt.meta.sectionBreakdown.map(s => s.name));
  const result = await generateFromStructuredPrompt(model, finalPrompt, imageSize, signal, aspectRatio, thinkingLevel);
  // ... same result handling as string path
}
```

Note: Keep both paths working during migration. The string path will be removed in Task 9.

**Step 3: Update the prompt stored in history**

When saving to `/api/history`, serialize the prompt for storage:
```typescript
const promptForHistory = typeof prompt === 'string' ? prompt : prompt.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n\n');
```

**Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/hooks/useGenericWorkflow.ts
git commit -m "feat: update runGeneratePipeline to handle StructuredPrompt"
```

---

### Task 7: Update generateRequest.ts to produce StructuredPrompt

Change `buildGenerationRequest()` to call `assemblePrompt()` instead of `buildPromptForType()`. The returned `PipelineParams.prompt` is now a `StructuredPrompt`.

**Files:**
- Modify: `src/lib/generateRequest.ts`

**Step 1: Update buildGenerationRequest**

Replace the prompt-building section with:

```typescript
import { assemblePrompt } from './promptForType';

// Inside buildGenerationRequest():
const gridConfig = gridPresetToConfig(gridLink, spriteType);
const prompt = assemblePrompt({
  spriteType,
  contentPreset,
  gridLink,
  isSubsequentGrid,
  pixelizeSize,
  referenceImage,
  feedbackState: opts.feedbackState,
  promptSuffix,
});

return buildPipelineParams({
  spriteType, contentPreset, gridLink, gridConfig,
  prompt, model, imageSize, thinkingLevel,
  referenceImage, historyExtras, sourceContext,
});
```

Remove imports for `buildPromptForType`, `buildRegenerationPreamble`, `buildCellFeedbackAnnotations`, `buildGroupFeedbackAnnotations`.

Update `buildPipelineParams` to accept `prompt: string | StructuredPrompt`.

**Step 2: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass (useRunWorkflow and useAddSheet already call buildGenerationRequest)

**Step 3: Commit**

```bash
git add src/lib/generateRequest.ts
git commit -m "refactor: buildGenerationRequest now produces StructuredPrompt via assemblePrompt"
```

---

### Task 8: Migrate useGenericWorkflow.generate() to buildGenerationRequest

Remove `config.buildPrompt()` usage. Instead, use `buildGenerationRequest()` like the other hooks.

**Files:**
- Modify: `src/hooks/useGenericWorkflow.ts`

**Step 1: Update the generate callback**

Replace lines 314-328 (where it builds the prompt via `config.buildPrompt`) with:

```typescript
// Inside generate():
const contentPreset: ContentPreset = {
  name: content.name,
  description: content.description,
  ...(currentConfig.spriteType === 'character' ? { equipment: (currentState.character as any).equipment, colorNotes: (currentState.character as any).colorNotes } : {}),
  // Similar for other types — or fetch from state
};
const pipelineParams = buildGenerationRequest({
  spriteType: currentConfig.spriteType,
  contentPreset,
  gridLink: gridLink || /* build a synthetic gridLink from state */,
  model: currentState.model,
  imageSize: currentState.imageSize,
  thinkingLevel: currentState.thinkingLevel,
  isSubsequentGrid: false,
  promptSuffix,
});
await runGeneratePipeline(pipelineParams, dispatch, abort.signal);
```

This is the trickiest task — `useGenericWorkflow.generate()` currently builds a ContentPreset-like object from state, while the other hooks fetch a real ContentPreset from the API. The generate callback needs to construct an equivalent ContentPreset from state fields.

**Step 2: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 3: Commit**

```bash
git add src/hooks/useGenericWorkflow.ts
git commit -m "refactor: useGenericWorkflow.generate() uses buildGenerationRequest"
```

---

### Task 9: Migrate useRegenerateWithFeedback to use assembleEditPrompt

Replace the inline `buildEditPrompt()` + `editGrid()` path with `assembleEditPrompt()` + `generateFromStructuredPrompt()`.

**Files:**
- Modify: `src/hooks/useRegenerateWithFeedback.ts`

**Step 1: Update regenerate callback**

Replace lines 62-92 (build edit prompt + call editGrid) with:

```typescript
import { assembleEditPrompt } from '../lib/promptForType';
import { generateFromStructuredPrompt } from '../api/geminiClient';

// Inside regenerate():
const structuredPrompt = assembleEditPrompt({
  feedbackState,
  cellLabels: gridLink.cellLabels,
  cellGroups: gridLink.cellGroups || [],
  cols: gridLink.cols,
  sourceImage: { data: filledGridImage, mimeType: filledGridMimeType || 'image/png' },
});

debugLog('[Regen Edit Prompt] parts:', structuredPrompt.parts.length);

const result = await generateFromStructuredPrompt(
  currentState.model,
  structuredPrompt,
  imageSize,
  abort.signal,
  gridLink.aspectRatio || '1:1',
  currentState.thinkingLevel,
);
```

**Step 2: Update prompt stored in history**

Serialize the text parts for the history POST body:
```typescript
const promptForHistory = structuredPrompt.parts.filter(p => p.type === 'text').map(p => p.content).join('\n\n');
```

**Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/hooks/useRegenerateWithFeedback.ts
git commit -m "refactor: useRegenerateWithFeedback uses assembleEditPrompt + structured API"
```

---

## Phase 4: Cleanup + Debug

### Task 10: Remove dead code and update WorkflowConfig

Delete old string-based functions, remove `buildPrompt` from WorkflowConfig, clean up imports.

**Files:**
- Modify: `src/lib/promptBuilderBase.ts` — delete `REFERENCE_PREFIX`, `CLOSING_INSTRUCTION`
- Modify: `src/lib/promptBuilder.ts` — delete `buildGridFillPrompt`, `buildGridFillPromptWithReference`
- Modify: `src/lib/buildingPromptBuilder.ts` — delete `buildBuildingPrompt`
- Modify: `src/lib/terrainPromptBuilder.ts` — delete `buildTerrainPrompt`
- Modify: `src/lib/backgroundPromptBuilder.ts` — delete `buildBackgroundPrompt`
- Modify: `src/lib/promptForType.ts` — delete `buildPromptForType`, remove `REFERENCE_PREFIX` re-export
- Modify: `src/hooks/useGenericWorkflow.ts` — remove `buildPrompt` from `WorkflowConfig`
- Modify: `src/hooks/useGridWorkflow.ts` — remove `buildPrompt` from config
- Modify: `src/hooks/useBuildingWorkflow.ts` — same
- Modify: `src/hooks/useTerrainWorkflow.ts` — same
- Modify: `src/hooks/useBackgroundWorkflow.ts` — same
- Modify: `src/api/geminiClient.ts` — delete old `generateGrid()` and `editGrid()` if no longer used
- Modify: `server/routes/generate.js` — remove old `buildGenerateParts()`, `buildEditParts()` if structured path is sole path
- Update: `src/lib/__tests__/promptBuilder.test.ts` — update tests for new function names
- Update: `src/lib/__tests__/promptForType.test.ts` — update tests for `assemblePrompt` instead of `buildPromptForType`

**Step 1: Delete old functions, update imports everywhere**

Work through each file. Remove unused imports. Run `npx tsc --noEmit` after each file to catch breakage immediately.

**Step 2: Update test files**

Update `promptBuilder.test.ts` to test `buildCharacterParts` instead of `buildGridFillPrompt`. Update assertions to check `TypeBuilderResult` shape.

Update `promptForType.test.ts` to test `assemblePrompt` instead of `buildPromptForType`. Assertions check `StructuredPrompt` shape and part types.

**Step 3: Verify everything**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add -u
git commit -m "refactor: remove old string-based prompt functions, update tests for structured API"
```

---

### Task 11: Add PromptDebugPanel component

**Files:**
- Create: `src/components/grid/PromptDebugPanel.tsx`
- Modify: `src/components/grid/SpriteReview.tsx` — add "View Prompt" button + state

**Step 1: Create PromptDebugPanel**

A modal that renders a `StructuredPrompt`:
- Text parts: displayed in `<pre>` blocks with section headers from `meta.sectionBreakdown`
- Image parts: `<img>` thumbnail (64px) with size info
- Close button

```typescript
// src/components/grid/PromptDebugPanel.tsx
import type { StructuredPrompt, PromptPart } from '../../types/prompt';

interface Props {
  prompt: StructuredPrompt | null;
  open: boolean;
  onClose: () => void;
}

export function PromptDebugPanel({ prompt, open, onClose }: Props) {
  if (!open || !prompt) return null;

  const sectionAt = new Map(prompt.meta.sectionBreakdown.map(s => [s.partIndex, s.name]));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content prompt-debug" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Prompt Debug View</h2>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {prompt.parts.length} parts | {prompt.meta.spriteType} | ref: {String(prompt.meta.hasReference)} | feedback: {String(prompt.meta.hasFeedback)}
        </div>
        {prompt.parts.map((part, i) => {
          const section = sectionAt.get(i);
          return (
            <div key={i}>
              {section && <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent)', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' }}>{section}</div>}
              {part.type === 'text' ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', background: 'var(--bg-elevated)', padding: 8, borderRadius: 4, margin: '4px 0' }}>{part.content}</pre>
              ) : (
                <div style={{ padding: 8, background: 'var(--bg-elevated)', borderRadius: 4, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={`data:${part.mimeType};base64,${part.data.slice(0, 100)}...`} alt={part.label || 'image'} style={{ width: 48, height: 48, objectFit: 'contain', background: '#333' }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>[{part.label || 'image'}] {(part.data.length * 0.75 / 1024).toFixed(0)}KB</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Wire into SpriteReview**

Add state for storing the last prompt and toggling the panel:
```typescript
const [lastPrompt, setLastPrompt] = useState<StructuredPrompt | null>(null);
const [promptDebugOpen, setPromptDebugOpen] = useState(false);
```

Pass `setLastPrompt` through to the generation pipeline (via a callback ref or by storing it after `runGeneratePipeline` returns). Add a "View Prompt" button in the Actions sidebar group.

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/grid/PromptDebugPanel.tsx src/components/grid/SpriteReview.tsx
git commit -m "feat: add PromptDebugPanel for viewing structured prompt before API call"
```

---

### Task 12: Final verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: All pass

**Step 3: Manual smoke test**

- Generate a character sprite (single grid)
- Generate a building sprite (single grid)
- Run a multi-grid character run (2+ grids — verifies reference image)
- Add a sheet to an existing generation
- Regenerate with feedback (edit mode)
- Open the Prompt Debug Panel and verify sections render correctly

**Step 4: Commit any cleanup**

---

## Summary of Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Prompt return type | `string` | `StructuredPrompt` with typed parts |
| Image handling | `REFERENCE_PREFIX` string hack + 3 inline `.replace()` | First-class `{ type: 'image' }` parts at semantic positions |
| Entry points | 4 divergent paths | All route through `buildGenerationRequest()` → `assemblePrompt()` |
| Server parts builder | `buildGenerateParts()` + `buildEditParts()` (2 functions) | `structuredPartsToGemini()` (1 function) |
| Debug visibility | None | PromptDebugPanel showing full part sequence |
| Dead code removed | — | `REFERENCE_PREFIX`, `buildGridFillPromptWithReference`, `CLOSING_INSTRUCTION`, old `generateGrid`/`editGrid` |

## Dependency Graph

```
Task 1 (types) ─┬─► Task 2 (char builder) ──┐
                 ├─► Task 3 (other builders) ─┤
                 │                            ▼
                 └────────────────────────► Task 4 (assembler) ──► Task 5 (API+server)
                                                                      │
                                              Task 6 (pipeline) ◄────┘
                                                  │
                                   ┌──────────────┼──────────────┐
                                   ▼              ▼              ▼
                              Task 7          Task 8         Task 9
                           (generateReq)   (useGeneric)   (useRegen)
                                   │              │              │
                                   └──────────────┼──────────────┘
                                                  ▼
                                            Task 10 (cleanup)
                                                  │
                                                  ▼
                                            Task 11 (debug panel)
                                                  │
                                                  ▼
                                            Task 12 (verification)
```
