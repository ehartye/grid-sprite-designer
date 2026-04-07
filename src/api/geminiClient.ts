/**
 * Client for the grid-fill Gemini API proxy.
 */

export interface GridGenerateResult {
  text: string;
  image: { data: string; mimeType: string } | null;
}

export async function generateGrid(
  model: string,
  prompt: string,
  templateImage: { data: string; mimeType: string },
  imageSize: string = '2K',
  signal?: AbortSignal,
  referenceImage?: { data: string; mimeType: string },
  aspectRatio: string = '1:1',
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high',
): Promise<GridGenerateResult> {
  const body: Record<string, unknown> = { model, prompt, templateImage, imageSize, aspectRatio };
  if (referenceImage) body.referenceImage = referenceImage;
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

/**
 * Edit an existing grid image with targeted feedback.
 * Sends only the source image (no template) with a feedback-focused prompt.
 */
export async function editGrid(
  model: string,
  prompt: string,
  sourceImage: { data: string; mimeType: string },
  imageSize: string = '2K',
  signal?: AbortSignal,
  aspectRatio: string = '1:1',
  thinkingLevel?: 'default' | 'minimal' | 'low' | 'medium' | 'high',
): Promise<GridGenerateResult> {
  const body: Record<string, unknown> = { model, prompt, sourceImage, imageSize, aspectRatio, mode: 'edit' };
  if (thinkingLevel && thinkingLevel !== 'default') body.thinkingLevel = thinkingLevel;

  const response = await fetch('/api/generate-grid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Edit failed (${response.status})`);
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
