import { describe, it, expect } from 'vitest';
import { PRESET_TABLES } from '../presetTables.js';

/**
 * Canary test: verifies that all type-registration maps stay in sync.
 * If a new SpriteType is added, these will fail until every registry is updated.
 *
 * WORKFLOW_CONFIGS (client-side, TypeScript) is checked at compile time via
 * Record<SpriteType, ...> typing. PRESET_TABLES (server-side, JS) has no
 * type safety, so this runtime test catches drift.
 */
describe('type registration canary', () => {
  const expectedTypes = ['character', 'building', 'terrain', 'background'].sort();

  it('PRESET_TABLES has all expected sprite types', () => {
    expect(Object.keys(PRESET_TABLES).sort()).toEqual(expectedTypes);
  });

  it('every PRESET_TABLES entry has required fields', () => {
    for (const [type, config] of Object.entries(PRESET_TABLES)) {
      expect(config, `${type} missing table`).toHaveProperty('table');
      expect(config, `${type} missing linkTable`).toHaveProperty('linkTable');
      expect(config, `${type} missing fk`).toHaveProperty('fk');
      expect(config, `${type} missing columns`).toHaveProperty('columns');
      expect(Array.isArray(config.columns), `${type} columns not an array`).toBe(true);
      expect(config.columns.length, `${type} has no columns`).toBeGreaterThan(0);
    }
  });
});
