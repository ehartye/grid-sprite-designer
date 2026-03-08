/** Parse a route :id param as a positive integer. Returns null if invalid. */
export function parseIntParam(val) {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/** Extract body values for a preset type, applying defaults and JSON serialization. */
export function extractPresetValues(body, columns) {
  return columns.map(([bodyField, , defaultVal, isJson]) => {
    const raw = body[bodyField];
    if (isJson) return JSON.stringify(raw || defaultVal);
    return raw || defaultVal;
  });
}

/** Map a DB row to a response object using column config. */
export function mapPresetRow(row, columns) {
  const obj = { id: row.id };
  for (const [bodyField, dbCol, , isJson] of columns) {
    obj[bodyField] = isJson ? JSON.parse(row[dbCol] || '[]') : row[dbCol];
  }
  return obj;
}

/** Parse Gemini API response, extracting text and image data. */
export function parseGeminiResponse(data) {
  const candidates = data?.candidates;
  if (!candidates || candidates.length === 0) {
    console.warn('[Gemini] Response has zero candidates');
    return { text: '', image: null };
  }

  const candidate = candidates[0];
  const parts = candidate?.content?.parts ?? [];

  if (!candidate?.content || parts.length === 0) {
    console.warn('[Gemini] Response candidate has no content/parts');
  }

  const text = [];
  let image = null;
  let imageCount = 0;

  for (const part of parts) {
    if (part.text) {
      text.push(part.text);
    }
    if (part.inlineData) {
      imageCount++;
      image = {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  if (imageCount > 1) {
    console.warn(`[Gemini] Response contained ${imageCount} image parts; only the last is kept`);
  }

  return { text: text.join('\n'), image };
}
