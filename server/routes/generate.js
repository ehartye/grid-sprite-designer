import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parseGeminiResponse } from '../utils.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ALLOWED_IMAGE_SIZES = ['2K', '4K'];
export const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

export const ALLOWED_MODELS = [
  'nano-banana-pro-preview',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-image-generation',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

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

export function createGenerateRouter(apiKey) {
  const router = Router();

  const generateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,             // 10 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many generation requests. Please wait before trying again.' },
  });

  /**
   * POST /api/generate-grid
   * Body: { model, prompt, templateImage: { data, mimeType }, imageSize,
   *         referenceImage?: { data, mimeType } }
   *
   * Sends the template grid image + prompt to Gemini and returns the filled grid.
   * When referenceImage is provided (multi-grid runs), it is sent as the first
   * image part so subsequent grids maintain visual consistency with the first.
   */
  router.post('/generate-grid', generateLimiter, async (req, res) => {
    try {
      const { model, prompt, templateImage, imageSize = '2K', referenceImage, aspectRatio = '1:1' } = req.body;

      if (!model || !prompt || !templateImage) {
        return res.status(400).json({ error: 'model, prompt, and templateImage are required' });
      }

      if (!ALLOWED_MODELS.includes(model)) {
        return res.status(400).json({ error: `Invalid model. Allowed models: ${ALLOWED_MODELS.join(', ')}` });
      }

      if (!ALLOWED_IMAGE_SIZES.includes(imageSize)) {
        return res.status(400).json({ error: `Invalid imageSize. Allowed values: ${ALLOWED_IMAGE_SIZES.join(', ')}` });
      }

      if (!ALLOWED_ASPECT_RATIOS.includes(aspectRatio)) {
        return res.status(400).json({ error: `Invalid aspectRatio. Allowed values: ${ALLOWED_ASPECT_RATIOS.join(', ')}` });
      }

      if (templateImage.mimeType && !ALLOWED_MIME_TYPES.includes(templateImage.mimeType)) {
        return res.status(400).json({ error: `Invalid templateImage mimeType. Allowed values: ${ALLOWED_MIME_TYPES.join(', ')}` });
      }

      if (referenceImage?.mimeType && !ALLOWED_MIME_TYPES.includes(referenceImage.mimeType)) {
        return res.status(400).json({ error: `Invalid referenceImage mimeType. Allowed values: ${ALLOWED_MIME_TYPES.join(', ')}` });
      }

      const parts = [];

      // If reference image provided (subsequent runs in multi-grid), add it first
      if (referenceImage) {
        parts.push({
          inline_data: {
            mime_type: referenceImage.mimeType || 'image/png',
            data: referenceImage.data,
          },
        });
      }

      // Template image (always present)
      parts.push({
        inline_data: {
          mime_type: templateImage.mimeType,
          data: templateImage.data,
        },
      });

      // Prompt text
      parts.push({ text: prompt });

      const generationConfig = {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 1.0,
        imageConfig: {
          aspectRatio,
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
        console.error('[Gemini] Auth error:', errorData?.error?.message);
        return res.status(401).json({ error: 'Invalid or unauthorized API key' });
      }

      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limited — try again in a moment' });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Gemini] API error (${response.status}):`, errorData?.error?.message);
        return res.status(502).json({ error: `Image generation failed (upstream ${response.status})` });
      }

      const data = await response.json();

      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
        return res.status(400).json({ error: 'Content was filtered by safety settings' });
      }

      const result = parseGeminiResponse(data);
      return res.json(result);
    } catch (err) {
      console.error('[Gemini] Generate grid error:', err);
      return res.status(502).json({ error: 'Image generation failed unexpectedly' });
    }
  });

  const testConnectionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,              // 5 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many connection test requests. Please wait before trying again.' },
  });

  router.post('/test-connection', testConnectionLimiter, async (req, res) => {
    try {
      const { model = 'nano-banana-pro-preview' } = req.body || {};

      if (!ALLOWED_MODELS.includes(model)) {
        return res.status(400).json({ error: `Invalid model. Allowed models: ${ALLOWED_MODELS.join(', ')}` });
      }

      const body = {
        contents: [{ parts: [{ text: 'Respond with "ok".' }] }],
      };

      const response = await callGemini(apiKey, model, body);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Gemini] Test connection error (${response.status}):`, errorData?.error?.message);
        return res.status(502).json({ error: `Connection test failed (upstream ${response.status})` });
      }

      return res.json({ success: true, model });
    } catch (err) {
      console.error('[Gemini] Test connection error:', err);
      return res.status(502).json({ error: 'Connection test failed unexpectedly' });
    }
  });

  return router;
}
