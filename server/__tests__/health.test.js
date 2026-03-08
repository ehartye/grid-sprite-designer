import { describe, it, expect, vi } from 'vitest';
import { createHealthHandler } from '../healthCheck.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

describe('health check', () => {
  it('returns ok when DB is healthy', () => {
    const db = { prepare: vi.fn(() => ({ get: vi.fn(() => ({ 1: 1 })) })) };
    const handler = createHealthHandler(db, true);
    const res = mockRes();

    handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(res.body.geminiKeyConfigured).toBe(true);
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 503 degraded when DB check fails', () => {
    const db = { prepare: vi.fn(() => { throw new Error('database is locked'); }) };
    const handler = createHealthHandler(db, true);
    const res = mockRes();

    handler({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe('error');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('reports geminiKeyConfigured as false when not set', () => {
    const db = { prepare: vi.fn(() => ({ get: vi.fn(() => ({ 1: 1 })) })) };
    const handler = createHealthHandler(db, false);
    const res = mockRes();

    handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.geminiKeyConfigured).toBe(false);
  });
});
