import { describe, it, expect } from 'vitest';
import { buildTerrainPrompt, type TerrainConfig } from '../terrainPromptBuilder';
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

describe('buildTerrainPrompt', () => {
  it('includes terrain name in uppercase', () => {
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('FOREST FLOOR');
  });

  it('includes description and color notes', () => {
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('Dense forest ground');
    expect(prompt).toContain('Earthy greens');
  });

  it('includes grid dimensions', () => {
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('4\u00d74');
    expect(prompt).toContain('16 cells');
  });

  it('lists tile labels', () => {
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('"Tile 0"');
    expect(prompt).toContain('"Tile 15"');
  });

  it('includes terrain-specific tileability instructions', () => {
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('TILEABILITY IS CRITICAL');
    expect(prompt).toContain('FILL THE CELL');
  });

  it('includes presetGuidance overall text as fallback guidance', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Base tiles should tile seamlessly', groups: {}, cells: {} };
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('Base tiles should tile seamlessly');
  });

  it('includes linkGuidance overall when provided', () => {
    const linkGuidance: HierarchicalGuidance = { overall: 'Custom override', groups: {}, cells: {} };
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, linkGuidance, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('Custom override');
  });

  it('includes gridGuidance overall when provided', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Grid level guidance', groups: {}, cells: {} };
    const prompt = buildTerrainPrompt(baseTerrain, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('Grid level guidance');
  });

  it('omits style notes when empty', () => {
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 4, 4);
    expect(prompt).not.toContain('Additional style notes:');
  });

  it('includes cell-level guidance', () => {
    const presetGuidance: HierarchicalGuidance = {
      overall: '',
      groups: {},
      cells: { 'Tile 0': 'Base grass tile' },
    };
    const prompt = buildTerrainPrompt(baseTerrain, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 4, 4);
    expect(prompt).toContain('Base grass tile');
  });
});
