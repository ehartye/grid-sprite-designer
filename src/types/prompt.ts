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
