/**
 * Client for the grid-fill Gemini API proxy.
 */

import type { StructuredPrompt } from '../types/prompt';

export interface GridGenerateResult {
  text: string;
  image: { data: string; mimeType: string } | null;
}

/**
 * Generate from a StructuredPrompt — sends the parts array directly.
 * The server maps parts to Gemini format via structuredPartsToGemini().
 */
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

export async function testConnection(model: string = 'gemini-3-pro-image-preview'): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Connection test failed (${response.status})`);
  }

  return response.json();
}
