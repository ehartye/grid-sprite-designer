import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHistoryRouter } from '../routes/history.js';

// ── helpers ─────────────────────────────────────────────────────────────────

/** Find the route handler registered for a given method + path. */
function findHandler(router, method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    ) {
      // Return the last handler in the stack (skip middleware)
      return layer.route.stack.at(-1).handle;
    }
  }
  throw new Error(`No ${method.toUpperCase()} handler for "${path}"`);
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

function mockReq(body, params = {}) {
  return { body, params };
}

// ── mock db ─────────────────────────────────────────────────────────────────

function mockDb() {
  return {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ lastInsertRowid: 42n, changes: 1 })),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    transaction: vi.fn((fn) => fn),
  };
}

// ── POST /  (create generation) ─────────────────────────────────────────────

describe('POST / validation', () => {
  let handler, db;

  beforeEach(() => {
    db = mockDb();
    const router = createHistoryRouter(db);
    handler = findHandler(router, 'post', '/');
  });

  it('returns 400 when body is missing', () => {
    const res = mockRes();
    handler(mockReq(undefined), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/body/i);
  });

  it('returns 400 when contentName is missing', () => {
    const res = mockRes();
    handler(mockReq({ model: 'gemini-2.0' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/contentName/);
  });

  it('returns 400 when contentName is empty string', () => {
    const res = mockRes();
    handler(mockReq({ contentName: '  ', model: 'gemini-2.0' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/contentName/);
  });

  it('returns 400 when model is missing', () => {
    const res = mockRes();
    handler(mockReq({ contentName: 'Warrior' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/model/);
  });

  it('returns 400 when model is empty string', () => {
    const res = mockRes();
    handler(mockReq({ contentName: 'Warrior', model: '' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/model/);
  });

  it('returns 400 for invalid sprite type', () => {
    const res = mockRes();
    handler(mockReq({ contentName: 'Warrior', model: 'gemini-2.0', spriteType: 'dragon' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/sprite_type/);
  });

  it('returns 201 with valid body and converts lastInsertRowid to Number', () => {
    const res = mockRes();
    handler(mockReq({ contentName: 'Warrior', model: 'gemini-2.0' }), res, vi.fn());
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBe(42);
    expect(typeof res.body.id).toBe('number');
  });
});

// ── POST /:id/sprites  (save sprites) ──────────────────────────────────────

describe('POST /:id/sprites validation', () => {
  let handler, db;

  beforeEach(() => {
    db = mockDb();
    // Override transaction to return a callable wrapper
    db.transaction = vi.fn((fn) => (...args) => fn(...args));
    const router = createHistoryRouter(db);
    handler = findHandler(router, 'post', '/:id/sprites');
  });

  const validSprite = {
    cellIndex: 0,
    poseId: 'idle',
    poseName: 'Idle',
    imageData: 'base64data',
    mimeType: 'image/png',
  };

  it('returns 400 when body is missing', () => {
    const res = mockRes();
    handler(mockReq(undefined, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/body/i);
  });

  it('returns 400 when sprites is not an array', () => {
    const res = mockRes();
    handler(mockReq({ sprites: 'not-array' }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/array/);
  });

  it('returns 400 when sprites is empty', () => {
    const res = mockRes();
    handler(mockReq({ sprites: [] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/empty/);
  });

  it('returns 400 when cellIndex is not a number', () => {
    const res = mockRes();
    handler(mockReq({ sprites: [{ ...validSprite, cellIndex: 'abc' }] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cellIndex/);
  });

  it('returns 400 when poseId is missing', () => {
    const res = mockRes();
    const { poseId, ...rest } = validSprite;
    handler(mockReq({ sprites: [rest] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/poseId/);
  });

  it('returns 400 when poseName is empty', () => {
    const res = mockRes();
    handler(mockReq({ sprites: [{ ...validSprite, poseName: '' }] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/poseName/);
  });

  it('returns 400 when imageData is missing', () => {
    const res = mockRes();
    const { imageData, ...rest } = validSprite;
    handler(mockReq({ sprites: [rest] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/imageData/);
  });

  it('returns 400 when mimeType is missing', () => {
    const res = mockRes();
    const { mimeType, ...rest } = validSprite;
    handler(mockReq({ sprites: [rest] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/mimeType/);
  });

  it('reports the index of the invalid sprite', () => {
    const res = mockRes();
    handler(mockReq({ sprites: [validSprite, { ...validSprite, cellIndex: null }] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/sprites\[1\]/);
  });

  it('returns 201 with valid sprites', () => {
    const res = mockRes();
    handler(mockReq({ sprites: [validSprite] }, { id: '1' }), res, vi.fn());
    expect(res.statusCode).toBe(201);
    expect(res.body.count).toBe(1);
  });

  it('returns 400 for invalid id parameter', () => {
    const res = mockRes();
    handler(mockReq({ sprites: [validSprite] }, { id: 'abc' }), res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/id/i);
  });
});

// ── GET /  (list generations) ───────────────────────────────────────────────

describe('GET / response format', () => {
  it('returns camelCase field names', () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(() => [
          { id: 1, content_name: 'Warrior', content_description: 'A brave warrior', model: 'gemini-2.0', created_at: '2025-01-01' },
        ]),
      })),
    };
    const router = createHistoryRouter(db);
    const handler = findHandler(router, 'get', '/');
    const res = mockRes();
    handler(mockReq(undefined), res, vi.fn());

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: 1,
      contentName: 'Warrior',
      contentDescription: 'A brave warrior',
      model: 'gemini-2.0',
      createdAt: '2025-01-01',
    });
    // Ensure no snake_case keys leak through
    expect(res.body[0]).not.toHaveProperty('content_name');
    expect(res.body[0]).not.toHaveProperty('created_at');
  });
});
