import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parseGeminiResponse } from '../utils.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ALLOWED_IMAGE_SIZES = ['2K', '4K'];
export const ALLOWED_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
export const ALLOWED_THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'];

export const ALLOWED_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-image-generation',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

// ── Gemini API client ──

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
    console.warn(`[Gemini] Rate limited (429). Retrying in ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callGemini(apiKey, model, body, retries + 1);
  }

  return response;
}

// ── Validation helpers ──

function validateModel(model) {
  if (!model || !ALLOWED_MODELS.includes(model)) {
    return `Invalid model. Allowed models: ${ALLOWED_MODELS.join(', ')}`;
  }
  return null;
}

function validateImageMime(mimeType, label) {
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return `Invalid ${label} mimeType. Allowed values: ${ALLOWED_MIME_TYPES.join(', ')}`;
  }
  return null;
}

function validateEnum(value, allowed, label) {
  if (value !== undefined && !allowed.includes(value)) {
    return `Invalid ${label}. Allowed values: ${allowed.join(', ')}`;
  }
  return null;
}

function firstError(...checks) {
  for (const msg of checks) {
    if (msg) return msg;
  }
  return null;
}

// ── Gemini request/response builders ──

function buildGenerationConfig(aspectRatio, imageSize, thinkingLevel) {
  const config = {
    responseModalities: ['TEXT', 'IMAGE'],
    temperature: 1.0,
    imageConfig: { aspectRatio, imageSize },
  };
  if (thinkingLevel) {
    config.thinkingConfig = { thinkingLevel };
  }
  return config;
}

function imagePart(imageData) {
  return {
    inline_data: {
      mime_type: imageData.mimeType || 'image/png',
      data: imageData.data,
    },
  };
}

function buildEditParts(sourceImage, prompt) {
  return [
    { text: '[SOURCE IMAGE — This is the sprite sheet to edit. Make only the targeted changes described below. Preserve everything else exactly as-is.]' },
    imagePart(sourceImage),
    { text: prompt },
  ];
}

function buildGenerateParts(templateImage, prompt, referenceImage) {
  const parts = [];

  if (referenceImage) {
    parts.push({ text: '[IMAGE 1 — REFERENCE ONLY: use this image solely to match art style, color palette, proportions, and character identity. Do NOT replicate its layout, cell arrangement, or poses.]' });
    parts.push(imagePart(referenceImage));
  }

  parts.push({ text: '[IMAGE 2 — TEMPLATE TO FILL: this is the blank sprite sheet grid you must complete. Your output image must be a completed version of this exact template.]' });
  parts.push(imagePart(templateImage));
  parts.push({ text: prompt });

  return parts;
}

// ── Response handling ──

async function handleGeminiResponse(response, rid, label) {
  if (response.status === 401 || response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[${label}:${rid}] Auth error:`, errorData?.error?.message);
    return { status: 401, body: { error: 'Invalid or unauthorized API key' } };
  }

  if (response.status === 429) {
    console.warn(`[${label}:${rid}] Rate limited (429)`);
    return { status: 429, body: { error: 'Rate limited — try again in a moment' } };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[${label}:${rid}] API error (${response.status}):`, errorData?.error?.message);
    return { status: 502, body: { error: `${label} failed (upstream ${response.status})` } };
  }

  const data = await response.json();
  const finishReason = data?.candidates?.[0]?.finishReason;

  if (finishReason && finishReason !== 'STOP') {
    console.warn(`[${label}:${rid}] finishReason=${finishReason}`, {
      candidateCount: data?.candidates?.length,
      partTypes: (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ? 'text' : p.inlineData ? 'image' : 'unknown'),
    });
  }

  if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
    return { status: 400, body: { error: 'Content was filtered by safety settings' } };
  }
  if (finishReason === 'MAX_TOKENS') {
    return { status: 400, body: { error: 'Response truncated: max tokens reached' } };
  }
  if (finishReason === 'RECITATION') {
    return { status: 400, body: { error: 'Response blocked: recitation policy' } };
  }

  return { status: 200, body: parseGeminiResponse(data) };
}

// ── Router ──

export function createGenerateRouter(apiKey) {
  const router = Router();

  const generateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many generation requests. Please wait before trying again.' },
  });

  router.post('/generate-grid', generateLimiter, async (req, res) => {
    const rid = req.id || '?';
    try {
      const { model, prompt, templateImage, imageSize = '2K', referenceImage, aspectRatio = '1:1', thinkingLevel, mode, sourceImage } = req.body;

      // ── Edit mode ──
      if (mode === 'edit') {
        if (!prompt || !sourceImage) {
          return res.status(400).json({ error: 'model, prompt, and sourceImage are required for edit mode' });
        }
        const err = firstError(
          validateModel(model),
          validateImageMime(sourceImage?.mimeType, 'sourceImage'),
          validateEnum(thinkingLevel, ALLOWED_THINKING_LEVELS, 'thinkingLevel'),
        );
        if (err) return res.status(400).json({ error: err });

        const parts = buildEditParts(sourceImage, prompt);
        const body = { contents: [{ parts }], generationConfig: buildGenerationConfig(aspectRatio, imageSize, thinkingLevel) };
        console.log(`[Edit:${rid}] payload ~${(JSON.stringify(body).length / 1024 / 1024).toFixed(2)}MB, imageSize: ${imageSize}`);

        const response = await callGemini(apiKey, model, body);
        const result = await handleGeminiResponse(response, rid, 'Edit');
        return res.status(result.status).json(result.body);
      }

      // ── Generate mode ──
      if (!prompt || !templateImage) {
        return res.status(400).json({ error: 'model, prompt, and templateImage are required' });
      }
      const err = firstError(
        validateModel(model),
        validateEnum(imageSize, ALLOWED_IMAGE_SIZES, 'imageSize'),
        validateEnum(aspectRatio, ALLOWED_ASPECT_RATIOS, 'aspectRatio'),
        validateImageMime(templateImage?.mimeType, 'templateImage'),
        validateImageMime(referenceImage?.mimeType, 'referenceImage'),
        validateEnum(thinkingLevel, ALLOWED_THINKING_LEVELS, 'thinkingLevel'),
      );
      if (err) return res.status(400).json({ error: err });

      const parts = buildGenerateParts(templateImage, prompt, referenceImage);
      const body = { contents: [{ parts }], generationConfig: buildGenerationConfig(aspectRatio, imageSize, thinkingLevel) };
      console.log(`[Generate:${rid}] payload ~${(JSON.stringify(body).length / 1024 / 1024).toFixed(2)}MB, imageSize: ${imageSize}`);

      const response = await callGemini(apiKey, model, body);
      const result = await handleGeminiResponse(response, rid, 'Generate');
      return res.status(result.status).json(result.body);

    } catch (err) {
      console.error(`[Generate:${rid}] error:`, err);
      return res.status(502).json({ error: 'Image generation failed unexpectedly' });
    }
  });

  const testConnectionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many connection test requests. Please wait before trying again.' },
  });

  router.post('/test-connection', testConnectionLimiter, async (req, res) => {
    try {
      const { model = 'gemini-3-pro-image-preview' } = req.body || {};

      const err = validateModel(model);
      if (err) return res.status(400).json({ error: err });

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
