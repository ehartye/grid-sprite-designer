# Conventions & Idioms -- Round 2 Reactions

---

## Reactions

### Data Integrity F1 (Frontend types still use old column names -- data silently lost on preset load)

From a Conventions & Idioms standpoint, this is the same issue I flagged in F2/F3 but Data Integrity correctly identifies the far more severe consequence I understated: it is not just a naming inconsistency -- it is a **functional regression** where `action.preset.rowGuidance` evaluates to `undefined` at runtime because the API now returns `overallGuidance`. I framed it as "confusion for future developers" and "could cause subtle bugs," but Data Integrity nails the actual impact: guidance is silently dropped on every preset load. I agree this is the single highest-priority issue in the changeset. The Conventions lens sees a naming mismatch; the Data Integrity lens correctly sees data loss.

### Data Integrity F4 (`extractPresetValues` uses `||` instead of `??`)

From a Conventions & Idioms standpoint, this is a textbook JavaScript anti-pattern that I missed entirely. Using `||` for defaulting is one of the most commonly cited JS pitfalls, and `??` (nullish coalescing) is the idiomatic modern replacement. This should have been in my Round 1 findings. The practical impact (empty string updates silently ignored) is a correctness issue, but the underlying cause is a language-specific anti-pattern.

### Data Integrity F5 (No JSON validation on storage boundary)

From a Conventions & Idioms standpoint, I would add that the Express/Node.js idiomatic approach is to use middleware-level validation (e.g., a `validateBody` middleware or a JSON schema library like `zod`/`ajv`) rather than scattering `JSON.parse` try/catch at every read site. The current pattern of `JSON.stringify` on write and unguarded `JSON.parse` on read is not just a data integrity concern -- it is a missing validation layer that idiomatic Express apps handle at the middleware level.

### Data Integrity F10 (`ContentPreset` type is a loose superset -- no discriminated union)

From a Conventions & Idioms standpoint, this is more critical than Data Integrity frames it. In TypeScript, a flat superset with all optional fields is the idiomatic anti-pattern known as "God type" or "option bag." The idiomatic TypeScript approach is a discriminated union with a literal discriminator field (e.g., `spriteType: 'character'`), which enables exhaustive `switch` narrowing. This directly amplifies my F4 (pervasive `as any` casts) and F10 (`Record<string, unknown>` usage) -- the root cause of the type-safety collapse is that there is no discriminated union to narrow against, so every consumer resorts to casts.

### Maintainer F3 (`EMPTY_GUIDANCE` duplicated 9 times)

From a Conventions & Idioms standpoint, this is a clear violation of the DRY principle and a missed opportunity to use the existing shared module. The codebase already establishes the convention of exporting shared prompt constants from `promptBuilderBase.ts` (`CLOSING_INSTRUCTION`, `REFERENCE_PREFIX`). Not exporting `EMPTY_GUIDANCE` from the same module is an inconsistency in that established convention.

### Maintainer F4 (Fragile string `.replace()` for multi-grid reference prompts)

From a Conventions & Idioms standpoint, this is a template-injection anti-pattern. The idiomatic approach in any template system is to use explicit placeholders/tokens, not to rely on exact substring matching within prose. The fact that two different replacement strategies exist (character vs. other types) is also an inconsistency in how the same operation is performed. I did not catch this in Round 1 and consider it a genuine new finding from the Maintainer perspective.

### Maintainer F7 (`presetTables.js` positional arrays instead of named fields)

From a Conventions & Idioms standpoint, this is a significant JavaScript anti-pattern. Positional arrays for structured config are the tuple-abuse pattern common in Python but non-idiomatic in JavaScript/Node.js, where objects with named keys are the standard. The destructuring `([bodyField, , defaultVal, isJson])` with a skipped element is a code smell -- the comma-gap syntax is brittle and error-prone. This is exactly the kind of "pattern imported from another language" my analytical lens is designed to catch, and I should have flagged it.

### Maintainer F8 (Prompt preview asymmetric across sprite types)

From a Conventions & Idioms standpoint, this is less a conventions issue and more a feature-completeness issue, but the asymmetry does create an inconsistent internal API contract: `buildGridFillPrompt` for characters accepts real guidance, while the building/terrain/background preview paths always pass empty guidance. This inconsistency in how the same "preview" operation is performed across sprite types is a pattern violation.

### Maintainer F9 (No validation that cell guidance keys match actual cell labels)

From a Conventions & Idioms standpoint, the `guidance-pairs` field type in `GenericPresetsTab.tsx` implements a free-form key-value editor with no connection to the domain model. The idiomatic React pattern for this would be a controlled autocomplete component that derives its options from the linked grid's labels. Using an uncontrolled `<input onKeyDown>` for domain-specific keys is fighting the framework -- React's strength is in deriving UI from state, and here the available keys ARE derivable from state (the linked grid's `cellLabels`).

---

## Tensions

### Tension 1: My F10 vs. Maintainer F7 -- typed generics vs. positional config

My F10 argues that `GenericPresetsTab` should use typed generics (`GenericPresetsTab<T extends BasePreset>`) instead of `Record<string, unknown>`. Maintainer F7 argues the backend config should use named objects instead of positional arrays. Both are correct individually, but there is a tension: the frontend `GenericPresetsTab` is deliberately config-driven (it reads field schemas to render forms), and the backend `presetTables.js` is deliberately data-driven (it reads column config to build queries). Both chose the same tradeoff -- flexible config over static types -- and both suffer the same consequence -- lost type safety. The question for the synthesizer is whether to fix one end (making the config typed) or both, and whether the config-driven approach itself should be reconsidered or just made type-safe with better TypeScript patterns (e.g., `satisfies Record<SpriteType, PresetTableConfig>`).

### Tension 2: My F12 (duplicated UI) vs. practical component boundaries

My F12 and Maintainer F5 both identify the same triplicated accordion pattern. However, the three consumers have genuinely different update mechanisms: `LinkedGridPresets` saves on blur via API call, `GridPresetsTab` updates local `editing` state via `setEditing`, and `GenericPresetsTab` uses a generic `updateField` with `Record<string, unknown>`. Extracting a shared `<GuidanceAccordion>` requires reconciling these three callback signatures. The tension is between DRY (extract a shared component) and component cohesion (each consumer's update contract is different enough that the shared component would need a complex `onChange` prop contract). The synthesizer should weigh whether the extraction actually reduces complexity or just moves it into a complex callback interface.

---

## New Insights

### N1: The stale types are not just dead code -- they mask a runtime data-loss regression

Data Integrity F1 made me realize my F2 and F3 were too narrowly framed. I categorized `rowGuidance` as a "dead field" (a conventions issue), but at runtime the reducer actively reads `action.preset.rowGuidance` (which is `undefined`) and stores it as the character's guidance. This means the old type is not just dead weight -- it is actively causing the reducer to produce empty guidance. My F2 should have been categorized as a severity-critical bug, not just a conventions finding. The Conventions lens can identify naming mismatches, but the Data Integrity lens is needed to trace the runtime consequence.

### N2: The `presetTables.js` positional-array pattern is the root cause of multiple type-safety failures

Maintainer F7 pointed me to the tuple config pattern I missed. Tracing the chain: `presetTables.js` uses positional arrays -> `utils.js` destructures them positionally -> the field mapping between camelCase body fields and snake_case DB columns is implicit -> the frontend `GenericPresetsTab` uses `Record<string, unknown>` because it cannot import or reference the server's column config -> type safety is lost end-to-end. If the column config used named objects AND was defined in a shared types module (or at least a shared schema), both the server utils and the frontend field schema could reference a single source of truth. This is a cross-cutting root cause that neither my Round 1 nor any single perspective fully traced.

### N3: The `as const` in GenericPresetsTab (my F8) might actually be a workaround for TypeScript inference limits

Re-reading in light of Maintainer F7, I realize the `as const` on `type: 'guidance-pairs' as const` might be needed because the `PRESET_TAB_CONFIGS` object is not annotated with `satisfies Record<SpriteType, PresetTabConfig>`. Without that annotation, TypeScript might widen the string literal `'guidance-pairs'` to `string` at the object-literal level, and the downstream `if (field.type === 'guidance-pairs')` check would not narrow correctly. I should verify this before maintaining that the `as const` is purely redundant -- it may be a necessary workaround for the missing `satisfies`.
