import { describe, it, expect } from 'vitest';
import { buildTerrainParts, type TerrainConfig } from '../terrainPromptBuilder';
import { EMPTY_GUIDANCE } from '../promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../../context/AppContext';

const baseTerrain: TerrainConfig = {
  name: 'Forest Floor',
  description: 'Dense forest ground with fallen leaves and moss',
  colorNotes: 'Earthy greens, browns, and yellows',
  styleNotes: '',
};

const cellLabels = Array.from({ length: 16 }, (_, i) => `Tile ${i}`);
const cellGroups: CellGroup[] = [];

/** Helper: concatenate all text parts from a TypeBuilderResult */
function allText(result: ReturnType<typeof buildTerrainParts>): string {
  return [...result.subject, ...result.instructions]
    .filter(p => p.type === 'text')
    .map(p => (p as any).content)
    .join('\n');
}

describe('buildTerrainParts', () => {
  it('includes terrain name in uppercase', () => {
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('FOREST FLOOR');
  });

  it('includes description and color notes', () => {
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('Dense forest ground');
    expect(text).toContain('Earthy greens');
  });

  it('includes total cell count', () => {
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('16');
  });

  it('lists tile labels', () => {
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('"Tile 0"');
    expect(text).toContain('"Tile 15"');
  });

  it('includes terrain-specific tileability instructions', () => {
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('TILEABILITY IS CRITICAL');
    expect(text).toContain('FILL THE CELL');
  });

  it('includes presetGuidance overall text as fallback guidance', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Base tiles should tile seamlessly', groups: {}, cells: {} };
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('Base tiles should tile seamlessly');
  });

  it('includes linkGuidance overall when provided', () => {
    const linkGuidance: HierarchicalGuidance = { overall: 'Custom override', groups: {}, cells: {} };
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, linkGuidance, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('Custom override');
  });

  it('includes gridGuidance overall when provided', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Grid level guidance', groups: {}, cells: {} };
    const text = allText(buildTerrainParts(baseTerrain, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('Grid level guidance');
  });

  it('omits style notes when empty', () => {
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4));
    expect(text).not.toContain('Additional style notes:');
  });

  it('includes cell-level guidance', () => {
    const presetGuidance: HierarchicalGuidance = {
      overall: '',
      groups: {},
      cells: { 'Tile 0': 'Base grass tile' },
    };
    const text = allText(buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 4, 4));
    expect(text).toContain('Base grass tile');
  });

  it('returns subject and instructions as separate arrays', () => {
    const result = buildTerrainParts(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.instructions.length).toBeGreaterThan(0);
  });
});
