import { describe, it, expect } from 'vitest';
import { buildPromptForType, REFERENCE_PREFIX } from '../promptForType';
import type { GridConfig } from '../gridConfig';

// Minimal GridLink-like object for testing
function makeGridLink(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    gridPresetId: 1,
    guidanceOverride: '',
    sortOrder: 0,
    gridName: 'Test Grid',
    gridSize: '3x3',
    cols: 3,
    rows: 3,
    cellLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    cellGroups: [],
    genericGuidance: 'Generic guidance text',
    aspectRatio: '1:1',
    tileShape: 'square' as const,
    ...overrides,
  };
}

function makeGridConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    id: 'test-grid',
    label: 'Test Grid',
    cols: 3,
    rows: 3,
    totalCells: 9,
    cellLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    templates: {
      '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
      '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
    },
    ...overrides,
  };
}

describe('buildPromptForType', () => {
  it('builds character prompt', () => {
    const preset = { name: 'Knight', description: 'A noble knight', equipment: 'Sword', colorNotes: '', rowGuidance: '' };
    const prompt = buildPromptForType('character', preset, makeGridLink(), makeGridConfig(), false);
    expect(prompt).toContain('KNIGHT');
    expect(prompt).toContain('A noble knight');
  });

  it('builds character prompt with reference prefix for subsequent grids', () => {
    const preset = { name: 'Knight', description: 'A noble knight', equipment: '', colorNotes: '', rowGuidance: '' };
    const prompt = buildPromptForType('character', preset, makeGridLink(), makeGridConfig(), true);
    expect(prompt).toContain('IMAGE 1');
    expect(prompt).toContain('IMAGE 2');
  });

  it('builds building prompt', () => {
    const preset = { name: 'Castle', description: 'A grand castle', details: 'Towers', colorNotes: '', cellGuidance: '' };
    const prompt = buildPromptForType('building', preset, makeGridLink(), makeGridConfig(), false);
    expect(prompt).toContain('CASTLE');
    expect(prompt).toContain('A grand castle');
  });

  it('adds reference prefix for subsequent building grids', () => {
    const preset = { name: 'Castle', description: 'A grand castle', details: '', colorNotes: '', cellGuidance: '' };
    const prompt = buildPromptForType('building', preset, makeGridLink(), makeGridConfig(), true);
    expect(prompt.startsWith(REFERENCE_PREFIX)).toBe(true);
  });

  it('builds terrain prompt', () => {
    const preset = { name: 'Desert', description: 'Sandy desert', colorNotes: 'Warm yellows', tileGuidance: '' };
    const prompt = buildPromptForType('terrain', preset, makeGridLink(), makeGridConfig(), false);
    expect(prompt).toContain('DESERT');
    expect(prompt).toContain('Sandy desert');
  });

  it('builds background prompt in parallax mode', () => {
    const preset = { name: 'Forest', description: 'Dense forest', colorNotes: '', layerGuidance: '', bgMode: 'parallax' as const };
    const link = makeGridLink({ bgMode: 'parallax' });
    const prompt = buildPromptForType('background', preset, link, makeGridConfig(), false);
    expect(prompt).toContain('FOREST');
    expect(prompt).toContain('parallax');
  });

  it('builds background prompt in scene mode', () => {
    const preset = { name: 'Village', description: 'A village', colorNotes: '', layerGuidance: '', bgMode: 'scene' as const };
    const link = makeGridLink({ bgMode: 'scene' });
    const prompt = buildPromptForType('background', preset, link, makeGridConfig(), false);
    expect(prompt).toContain('VILLAGE');
    expect(prompt).toContain('SCENE VARIATION');
  });

  it('throws for unknown sprite type', () => {
    const preset = { name: 'X', description: 'X' };
    expect(() => buildPromptForType('unknown' as any, preset, makeGridLink(), makeGridConfig(), false))
      .toThrow('Unknown sprite type: unknown');
  });

  it('adds reference prefix for subsequent terrain grids', () => {
    const preset = { name: 'Snow', description: 'Snowy terrain', colorNotes: '', tileGuidance: '' };
    const prompt = buildPromptForType('terrain', preset, makeGridLink(), makeGridConfig(), true);
    expect(prompt.startsWith(REFERENCE_PREFIX)).toBe(true);
  });
});
