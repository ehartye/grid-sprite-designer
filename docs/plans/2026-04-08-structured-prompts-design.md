# Structured Prompts Redesign

**Goal:** Replace the current "big text string + bolted-on images" prompt architecture with a structured sequence of interleaved text and image parts that maps directly to Gemini's multi-modal API. Kill the string hacks (REFERENCE_PREFIX, inline .replace()), unify all 4 generation entry points through a single assembler, and add a debug view.

**Motivation:** Gemini's API supports inline_data parts interleaved with text, allowing semantically positioned images (reference sheet between subject and instructions, template at the end). The current architecture builds a single string then staples images on at the server layer, requiring fragile text substitution to explain image ordering.

---

## Type System

New file `src/types/prompt.ts`:

```typescript
export type PromptPart =
  | { type: 'text'; content: string }
  | { type: 'image'; data: string; mimeType: string; label?: string };

export interface StructuredPrompt {
  parts: PromptPart[];
  meta: {
    spriteType: string;
    hasReference: boolean;
    hasFeedback: boolean;
    sectionBreakdown: { name: string; partIndex: number }[];
  };
}
```

`PromptPart` is the universal unit. Type builders return `PromptPart[]`. The assembler composes them into `StructuredPrompt`. The `meta.sectionBreakdown` maps section names to part indices for the debug view.

---

## Assembler — Single Point of Composition

`buildPromptForType()` in `promptForType.ts` becomes the sole assembler, returning `StructuredPrompt`. It composes this part sequence:

```
1. FEEDBACK PREAMBLE (text, optional)  — only for regeneration
2. ROLE INTRO (text)                   — shared across all types
3. SUBJECT (text)                      — from type-specific builder
4. REFERENCE (text + image, optional)  — only for subsequent grids / add-sheet
5. INSTRUCTIONS (text)                 — type-specific rules + buildGuidanceBlock() output
6. CANVAS (text + image)               — shared template adherence text + template image
```

For edit mode (regeneration via source image, no template):

```
1. ROLE INTRO (text)
2. SUBJECT (text)
3. SOURCE IMAGE (image)
4. EDIT INSTRUCTIONS (text)            — cell-by-cell feedback from buildEditPrompt()
```

**What this kills:**
- `REFERENCE_PREFIX` constant
- `buildGridFillPromptWithReference()` function
- 3 inline `.replace()` calls in `promptForType.ts`
- `buildGenerateParts()` / `buildEditParts()` branching on server
- `CLOSING_INSTRUCTION` (absorbed into canvas section)

**What the assembler owns:**
- Overall part sequence and image positioning
- Role intro text (shared)
- Canvas/template adherence text (shared)
- Feedback preamble positioning
- Pixelize guidance appending

---

## Type Builder Changes

Each builder's signature changes from returning `string` to returning `{ subject: PromptPart[]; instructions: PromptPart[] }`. The template text inside stays identical — just wrapped in `{ type: 'text', content: ... }`.

Builders no longer contain: role intro, reference image handling, canvas/template text, or `CLOSING_INSTRUCTION`. They only know about their domain (subject description and type-specific rules).

`buildGuidanceBlock()` is unchanged — returns a string that becomes a text part's content. Feedback annotations still injected the same way inside `buildGuidanceBlock()`.

Four files change shape; template text untouched. No prompt regression risk.

---

## Pipeline Integration — Entry Point Unification

`PipelineParams.prompt` changes from `string` to `StructuredPrompt`.

`buildGenerationRequest()` becomes the sole assembly point for all 4 hooks:

| Hook | Before | After |
|------|--------|-------|
| `useGenericWorkflow` | `config.buildPrompt()` → string | `buildGenerationRequest()` → StructuredPrompt |
| `useRunWorkflow` | `buildGenerationRequest()` → string in PipelineParams | Same function → StructuredPrompt |
| `useAddSheet` | `buildGenerationRequest()` → string | Same → StructuredPrompt |
| `useRegenerateWithFeedback` | Separate `buildEditPrompt()` → `editGrid()` | `buildGenerationRequest(mode:'edit')` → same pipeline |

`WorkflowConfig.buildPrompt()` is removed. Configs keep `getContent()` and `buildGridConfig()`.

`runGeneratePipeline()` passes `StructuredPrompt` to the API client instead of separate prompt + images args.

---

## Server Simplification

`buildGenerateParts()` and `buildEditParts()` replaced by:

```typescript
function structuredPromptToGeminiParts(prompt) {
  return prompt.parts.map(part =>
    part.type === 'text'
      ? { text: part.content }
      : { inline_data: { data: part.data, mime_type: part.mimeType } }
  );
}
```

One function, no mode branching. The client sends the `StructuredPrompt` parts array; the server maps it to Gemini's format.

---

## Debug View

`PromptDebugPanel` component — modal/drawer opened via "View Prompt" button in the review sidebar. Renders the last `StructuredPrompt`:

- Text parts: syntax-highlighted with section name headers from `meta.sectionBreakdown`
- Image parts: thumbnail preview with dimensions and size
- Also logged via `debugLog` when enabled

Stored in a ref (last generated prompt), not persisted.

---

## Scope Summary

| Area | Change |
|------|--------|
| **New** | `src/types/prompt.ts` (PromptPart, StructuredPrompt) |
| **New** | `src/components/grid/PromptDebugPanel.tsx` |
| **Rewrite** | `promptForType.ts` → sole assembler returning StructuredPrompt |
| **Reshape** | 4 type builders → return `{ subject, instructions }` parts |
| **Reshape** | `generateRequest.ts` → all hooks funnel through `buildGenerationRequest()` |
| **Reshape** | `feedbackPrompt.ts` → preamble/annotations return parts |
| **Simplify** | `useGenericWorkflow` → drops `config.buildPrompt()`, uses `buildGenerationRequest()` |
| **Simplify** | `useRegenerateWithFeedback` → uses `buildGenerationRequest(mode:'edit')` |
| **Simplify** | Server `generate.js` → one `structuredPromptToGeminiParts()` |
| **Delete** | `REFERENCE_PREFIX`, `buildGridFillPromptWithReference()`, `CLOSING_INSTRUCTION` |
| **Unchanged** | `buildGuidanceBlock()`, workflow configs (minus buildPrompt), grid configs |
