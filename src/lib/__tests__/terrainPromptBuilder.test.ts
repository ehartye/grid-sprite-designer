import { describe, it, expect } from 'vitest';
import { buildTerrainPrompt, type TerrainConfig } from '../terrainPromptBuilder';
import type { GridConfig } from '../gridConfig';

const baseTerrain: TerrainConfig = {
  name: 'Forest Floor',
  description: 'Dense forest ground with fallen leaves and moss',
  colorNotes: 'Earthy greens, browns, and yellows',
  styleNotes: '',
  tileGuidance: 'Base tiles should tile seamlessly',
};

const grid4x4: GridConfig = {
  id: 'terrain-4x4',
  label: 'Terrain 4x4',
  cols: 4,
  rows: 4,
  totalCells: 16,
  cellLabels: Array.from({ length: 16 }, (_, i) => `Tile ${i}`),
  templates: {
    '2K': { cellW: 509, cellH: 509, headerH: 18, border: 2, fontSize: 11 },
    '4K': { cellW: 1018, cellH: 1018, headerH: 30, border: 4, fontSize: 18 },
  },
};

describe('buildTerrainPrompt', () => {
  it('includes terrain name in uppercase', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).toContain('FOREST FLOOR');
  });

  it('includes description and color notes', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).toContain('Dense forest ground');
    expect(prompt).toContain('Earthy greens');
  });

  it('includes grid dimensions', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).toContain('4\u00d74');
    expect(prompt).toContain('16 cells');
  });

  it('lists tile labels', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).toContain('"Tile 0"');
    expect(prompt).toContain('"Tile 15"');
  });

  it('includes terrain-specific tileability instructions', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).toContain('TILEABILITY IS CRITICAL');
    expect(prompt).toContain('FILL THE CELL');
  });

  it('falls back to terrain.tileGuidance when no override', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).toContain('Base tiles should tile seamlessly');
  });

  it('uses guidanceOverride over terrain.tileGuidance', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4, undefined, 'Custom override');
    expect(prompt).toContain('Custom override');
  });

  it('uses fallback tile labels for cells beyond cellLabels length', () => {
    const shortGrid: GridConfig = { ...grid4x4, cellLabels: ['Grass'] };
    const prompt = buildTerrainPrompt(baseTerrain, shortGrid);
    expect(prompt).toContain('"Grass"');
    expect(prompt).toContain('"Tile 0,1"'); // fallback for unlabeled cells
  });

  it('omits style notes when empty', () => {
    const prompt = buildTerrainPrompt(baseTerrain, grid4x4);
    expect(prompt).not.toContain('Additional style notes:');
  });
});
