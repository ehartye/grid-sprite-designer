import { Router } from 'express';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

async function callGemini(apiKey, model, body, retries = 0) {
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  console.log(`[Gemini] ${model} -> ${url} (attempt ${retries + 1})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  console.log(`[Gemini] Response status: ${response.status}`);

  if (response.status === 429 && retries < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * Math.pow(2, retries);
    console.log(`Rate limited (429). Retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callGemini(apiKey, model, body, retries + 1);
  }

  return response;
}

function parseGeminiResponse(data) {
  const text = [];
  let image = null;

  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.text) {
      text.push(part.text);
    }
    if (part.inlineData) {
      image = {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  return { text: text.join('\n'), image };
}

export function createGenerateRouter(apiKey) {
  const router = Router();

  /**
   * POST /api/generate-grid
   * Body: { model, prompt, templateImage: { data, mimeType }, imageSize }
   *
   * Sends the template grid image + prompt to Gemini and returns the filled grid.
   */
  router.post('/generate-grid', async (req, res) => {
    try {
      const { model, prompt, templateImage, imageSize = '2K' } = req.body;

      if (!model || !prompt || !templateImage) {
        return res.status(400).json({ error: 'model, prompt, and templateImage are required' });
      }

      const parts = [
        {
          inline_data: {
            mime_type: templateImage.mimeType,
            data: templateImage.data,
          },
        },
        { text: prompt },
      ];

      const generationConfig = {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 1.0,
        imageConfig: {
          aspectRatio: '1:1',
          imageSize,
        },
      };

      const body = {
        contents: [{ parts }],
        generationConfig,
      };

      const payloadSize = JSON.stringify(body).length;
      console.log(`[GenerateGrid] payload ~${(payloadSize / 1024 / 1024).toFixed(2)}MB, imageSize: ${imageSize}`);

      const response = await callGemini(apiKey, model, body);

      if (response.status === 401 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(401).json({ error: errorData?.error?.message || 'Invalid API key' });
      }

      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limited — try again in a moment' });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `Gemini API error (${response.status})`;
        return res.status(502).json({ error: message });
      }

      const data = await response.json();

      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
        return res.status(400).json({ error: 'Content was filtered by safety settings' });
      }

      const result = parseGeminiResponse(data);
      return res.json(result);
    } catch (err) {
      console.error('Generate grid error:', err);
      return res.status(502).json({ error: err.message || 'Internal server error' });
    }
  });

  router.post('/test-connection', async (req, res) => {
    try {
      const { model = 'nano-banana-pro-preview' } = req.body || {};

      const body = {
        contents: [{ parts: [{ text: 'Respond with "ok".' }] }],
      };

      const response = await callGemini(apiKey, model, body);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData?.error?.message || `API error (${response.status})`;
        return res.json({ success: false, error: message });
      }

      return res.json({ success: true, model });
    } catch (err) {
      console.error('Test connection error:', err);
      return res.json({ success: false, error: err.message || 'Connection failed' });
    }
  });

  return router;
}
