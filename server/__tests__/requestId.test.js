import { describe, it, expect, vi } from 'vitest';
import { requestId } from '../middleware.js';

describe('requestId middleware', () => {
  it('attaches a string id to req', () => {
    const req = {};
    const next = vi.fn();

    requestId(req, {}, next);

    expect(typeof req.id).toBe('string');
    expect(req.id.length).toBe(8);
    expect(next).toHaveBeenCalledOnce();
  });

  it('generates unique ids across calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const req = {};
      requestId(req, {}, () => {});
      ids.add(req.id);
    }
    expect(ids.size).toBe(100);
  });
});
