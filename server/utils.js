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
