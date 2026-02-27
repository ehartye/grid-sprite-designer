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
): Promise<GridGenerateResult> {
  const response = await fetch('/api/generate-grid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, templateImage, imageSize }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Generation failed (${response.status})`);
  }

  return response.json();
}

export async function testConnection(model: string = 'gemini-2.5-flash-image'): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  return response.json();
}
