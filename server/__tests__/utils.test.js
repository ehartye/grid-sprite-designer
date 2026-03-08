import { describe, it, expect } from 'vitest';
import { parseIntParam, extractPresetValues, mapPresetRow, parseGeminiResponse } from '../utils.js';

// ── parseIntParam ───────────────────────────────────────────────────────────

describe('parseIntParam', () => {
  it('returns the number for a valid positive integer string', () => {
    expect(parseIntParam('1')).toBe(1);
    expect(parseIntParam('42')).toBe(42);
    expect(parseIntParam('999')).toBe(999);
  });

  it('returns null for zero', () => {
    expect(parseIntParam('0')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(parseIntParam('-1')).toBeNull();
    expect(parseIntParam('-100')).toBeNull();
  });

  it('returns null for non-integer numbers', () => {
    expect(parseIntParam('1.5')).toBeNull();
    expect(parseIntParam('0.1')).toBeNull();
    expect(parseIntParam('3.14')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseIntParam('abc')).toBeNull();
    expect(parseIntParam('')).toBeNull();
    expect(parseIntParam('12abc')).toBeNull();
  });

  it('returns null for undefined and null', () => {
    expect(parseIntParam(undefined)).toBeNull();
    expect(parseIntParam(null)).toBeNull();
  });

  it('accepts numeric input directly', () => {
    expect(parseIntParam(5)).toBe(5);
    expect(parseIntParam(1)).toBe(1);
  });

  it('returns null for NaN and Infinity', () => {
    expect(parseIntParam(NaN)).toBeNull();
    expect(parseIntParam(Infinity)).toBeNull();
    expect(parseIntParam(-Infinity)).toBeNull();
  });
});

// ── mapPresetRow ────────────────────────────────────────────────────────────

describe('mapPresetRow', () => {
  const columns = [
    ['name', 'name'],
    ['description', 'description', ''],
    ['cellLabels', 'cell_labels', [], true],
  ];

  it('maps a valid DB row to a response object', () => {
    const row = { id: 1, name: 'Test', description: 'A desc', cell_labels: '["a","b"]' };
    const result = mapPresetRow(row, columns);
    expect(result).toEqual({
      id: 1,
      name: 'Test',
      description: 'A desc',
      cellLabels: ['a', 'b'],
    });
  });

  it('returns empty array for null/empty JSON column', () => {
    const row = { id: 2, name: 'Empty', description: '', cell_labels: null };
    const result = mapPresetRow(row, columns);
    expect(result.cellLabels).toEqual([]);
  });

  it('returns empty array for empty string JSON column', () => {
    const row = { id: 3, name: 'Empty', description: '', cell_labels: '' };
    const result = mapPresetRow(row, columns);
    expect(result.cellLabels).toEqual([]);
  });

  it('throws on malformed JSON in a JSON column', () => {
    const row = { id: 4, name: 'Bad', description: '', cell_labels: '{invalid json' };
    expect(() => mapPresetRow(row, columns)).toThrow();
  });

  it('preserves id from the row', () => {
    const row = { id: 99, name: 'Test', description: '', cell_labels: '[]' };
    expect(mapPresetRow(row, columns).id).toBe(99);
  });
});

// ── extractPresetValues ─────────────────────────────────────────────────────

describe('extractPresetValues', () => {
  const columns = [
    ['name', 'name'],
    ['genre', 'genre', ''],
    ['cellLabels', 'cell_labels', [], true],
  ];

  it('extracts values from body using column config', () => {
    const body = { name: 'Warrior', genre: 'fantasy', cellLabels: ['a', 'b'] };
    const result = extractPresetValues(body, columns);
    expect(result).toEqual(['Warrior', 'fantasy', '["a","b"]']);
  });

  it('applies defaults for missing body fields', () => {
    const body = { name: 'Empty' };
    const result = extractPresetValues(body, columns);
    expect(result).toEqual(['Empty', '', '[]']);
  });

  it('JSON-stringifies array defaults when body field is missing', () => {
    const body = { name: 'Test', genre: 'sci-fi' };
    const result = extractPresetValues(body, columns);
    expect(result[2]).toBe('[]');
  });

  it('uses falsy default for empty string body values', () => {
    const body = { name: 'Test', genre: '', cellLabels: [] };
    const result = extractPresetValues(body, columns);
    // empty string is falsy, so default '' is used; empty array is falsy, so default [] is used
    expect(result[1]).toBe('');
    expect(result[2]).toBe('[]');
  });
});

// ── parseGeminiResponse ─────────────────────────────────────────────────────

describe('parseGeminiResponse', () => {
  it('extracts text from a single text part', () => {
    const data = {
      candidates: [{ content: { parts: [{ text: 'Hello world' }] } }],
    };
    const result = parseGeminiResponse(data);
    expect(result.text).toBe('Hello world');
    expect(result.image).toBeNull();
  });

  it('extracts image from an inlineData part', () => {
    const data = {
      candidates: [{
        content: {
          parts: [{
            inlineData: { data: 'base64data', mimeType: 'image/png' },
          }],
        },
      }],
    };
    const result = parseGeminiResponse(data);
    expect(result.image).toEqual({ data: 'base64data', mimeType: 'image/png' });
    expect(result.text).toBe('');
  });

  it('extracts both text and image from mixed parts', () => {
    const data = {
      candidates: [{
        content: {
          parts: [
            { text: 'Description here' },
            { inlineData: { data: 'imgdata', mimeType: 'image/jpeg' } },
            { text: 'More text' },
          ],
        },
      }],
    };
    const result = parseGeminiResponse(data);
    expect(result.text).toBe('Description here\nMore text');
    expect(result.image).toEqual({ data: 'imgdata', mimeType: 'image/jpeg' });
  });

  it('returns empty text and null image for null input', () => {
    const result = parseGeminiResponse(null);
    expect(result.text).toBe('');
    expect(result.image).toBeNull();
  });

  it('returns empty text and null image for undefined input', () => {
    const result = parseGeminiResponse(undefined);
    expect(result.text).toBe('');
    expect(result.image).toBeNull();
  });

  it('handles empty candidates array', () => {
    const result = parseGeminiResponse({ candidates: [] });
    expect(result.text).toBe('');
    expect(result.image).toBeNull();
  });

  it('handles missing content in candidate', () => {
    const result = parseGeminiResponse({ candidates: [{}] });
    expect(result.text).toBe('');
    expect(result.image).toBeNull();
  });

  it('handles missing parts in content', () => {
    const result = parseGeminiResponse({ candidates: [{ content: {} }] });
    expect(result.text).toBe('');
    expect(result.image).toBeNull();
  });

  it('uses last image when multiple inlineData parts exist', () => {
    const data = {
      candidates: [{
        content: {
          parts: [
            { inlineData: { data: 'first', mimeType: 'image/png' } },
            { inlineData: { data: 'second', mimeType: 'image/jpeg' } },
          ],
        },
      }],
    };
    const result = parseGeminiResponse(data);
    expect(result.image).toEqual({ data: 'second', mimeType: 'image/jpeg' });
  });

  it('concatenates multiple text parts with newlines', () => {
    const data = {
      candidates: [{
        content: {
          parts: [
            { text: 'Line 1' },
            { text: 'Line 2' },
            { text: 'Line 3' },
          ],
        },
      }],
    };
    const result = parseGeminiResponse(data);
    expect(result.text).toBe('Line 1\nLine 2\nLine 3');
  });
});
