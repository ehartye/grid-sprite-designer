import { describe, it, expect } from 'vitest';
import {
  CHARACTER_GRID,
  BUILDING_GRIDS,
  TERRAIN_GRIDS,
  BACKGROUND_GRIDS,
  getBuildingGridConfig,
  getTerrainGridConfig,
  getBackgroundGridConfig,
  gridPresetToConfig,
} from '../gridConfig';

describe('CHARACTER_GRID', () => {
  it('has 6x6 = 36 cells', () => {
    expect(CHARACTER_GRID.cols).toBe(6);
    expect(CHARACTER_GRID.rows).toBe(6);
    expect(CHARACTER_GRID.totalCells).toBe(36);
  });

  it('has 36 cell labels', () => {
    expect(CHARACTER_GRID.cellLabels).toHaveLength(36);
  });

  it('has 2K and 4K templates', () => {
    expect(CHARACTER_GRID.templates['2K']).toBeDefined();
    expect(CHARACTER_GRID.templates['4K']).toBeDefined();
    expect(CHARACTER_GRID.templates['4K'].cellW).toBeGreaterThan(CHARACTER_GRID.templates['2K'].cellW);
  });
});

describe('getBuildingGridConfig', () => {
  it('returns correct config for 3x3 with labels', () => {
    const labels = ['Front', 'Side', 'Back', 'Night', 'Damaged', 'Destroyed', 'Snow', 'Rain', 'Fog'];
    const config = getBuildingGridConfig('3x3', labels);
    expect(config.cols).toBe(3);
    expect(config.rows).toBe(3);
    expect(config.totalCells).toBe(9);
    expect(config.cellLabels).toEqual(labels);
  });

  it('truncates labels to totalCells', () => {
    const labels = Array.from({ length: 20 }, (_, i) => `Cell ${i}`);
    const config = getBuildingGridConfig('2x2', labels);
    expect(config.cellLabels).toHaveLength(4);
    expect(config.cellLabels[3]).toBe('Cell 3');
  });

  it('handles empty labels', () => {
    const config = getBuildingGridConfig('2x3', []);
    expect(config.cellLabels).toEqual([]);
    expect(config.totalCells).toBe(6);
  });

  it('does not mutate the base grid config', () => {
    const labels = ['A', 'B', 'C', 'D'];
    getBuildingGridConfig('2x2', labels);
    expect(BUILDING_GRIDS['2x2'].cellLabels).toEqual([]);
  });
});

describe('getTerrainGridConfig', () => {
  it('returns correct config for 4x4 with labels', () => {
    const labels = Array.from({ length: 16 }, (_, i) => `Tile ${i}`);
    const config = getTerrainGridConfig('4x4', labels);
    expect(config.cols).toBe(4);
    expect(config.rows).toBe(4);
    expect(config.totalCells).toBe(16);
    expect(config.cellLabels).toEqual(labels);
  });

  it('truncates labels to totalCells for 3x3', () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Tile ${i}`);
    const config = getTerrainGridConfig('3x3', labels);
    expect(config.cellLabels).toHaveLength(9);
  });

  it('handles fewer labels than cells', () => {
    const config = getTerrainGridConfig('5x5', ['Base', 'Edge']);
    expect(config.cellLabels).toEqual(['Base', 'Edge']);
    expect(config.totalCells).toBe(25);
  });
});

describe('getBackgroundGridConfig', () => {
  it('returns correct parallax config for 1x4', () => {
    const labels = ['Sky', 'Mountains', 'Trees', 'Ground'];
    const config = getBackgroundGridConfig('1x4', labels);
    expect(config.cols).toBe(1);
    expect(config.rows).toBe(4);
    expect(config.totalCells).toBe(4);
    expect(config.cellLabels).toEqual(labels);
  });

  it('returns correct scene config for 2x2', () => {
    const config = getBackgroundGridConfig('2x2', ['Day', 'Night', 'Dawn', 'Dusk']);
    expect(config.cols).toBe(2);
    expect(config.rows).toBe(2);
    expect(config.totalCells).toBe(4);
  });

  it('truncates labels for 1x3', () => {
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const config = getBackgroundGridConfig('1x3', labels);
    expect(config.cellLabels).toHaveLength(3);
  });
});

describe('gridPresetToConfig', () => {
  it('converts a grid preset to GridConfig', () => {
    const preset = {
      id: 42,
      name: 'My Grid',
      spriteType: 'character' as const,
      genre: 'fantasy',
      gridSize: '3x3',
      cols: 3,
      rows: 3,
      cellLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
      cellGroups: [],
      genericGuidance: '',
      aspectRatio: '1:1',
      tileShape: 'square' as const,
    };
    const config = gridPresetToConfig(preset);
    expect(config.id).toBe('preset-42');
    expect(config.label).toBe('My Grid');
    expect(config.cols).toBe(3);
    expect(config.rows).toBe(3);
    expect(config.totalCells).toBe(9);
    expect(config.cellLabels).toEqual(preset.cellLabels);
    expect(config.aspectRatio).toBe('1:1');
  });

  it('falls back to gridSize label when name is absent', () => {
    const preset = {
      id: 1,
      cols: 2,
      rows: 2,
      gridSize: '2x2',
      cellLabels: [],
    };
    const config = gridPresetToConfig(preset, 'building');
    expect(config.label).toBe('Grid 2x2');
  });

  it('uses gridPresetId over id when present', () => {
    const preset = {
      id: 10,
      gridPresetId: 99,
      gridName: 'Linked Grid',
      cols: 4,
      rows: 4,
      gridSize: '4x4',
      cellLabels: [],
    };
    const config = gridPresetToConfig(preset, 'terrain');
    expect(config.id).toBe('preset-99');
    expect(config.label).toBe('Linked Grid');
  });

  it('calculates template params for known grid sizes', () => {
    const preset = {
      id: 1,
      name: 'Test',
      spriteType: 'building' as const,
      genre: '',
      gridSize: '3x3',
      cols: 3,
      rows: 3,
      cellLabels: [],
      cellGroups: [],
      genericGuidance: '',
      aspectRatio: '1:1',
      tileShape: 'square' as const,
    };
    const config = gridPresetToConfig(preset);
    // Should use the known BUILDING_GRIDS['3x3'] templates
    expect(config.templates['2K'].cellW).toBe(680);
    expect(config.templates['4K'].cellW).toBe(1360);
  });

  it('calculates fallback template params for unknown grid sizes', () => {
    const preset = {
      id: 1,
      name: 'Unusual',
      spriteType: 'character' as const,
      genre: '',
      gridSize: '7x7',
      cols: 7,
      rows: 7,
      cellLabels: [],
      cellGroups: [],
      genericGuidance: '',
      aspectRatio: '1:1',
      tileShape: 'square' as const,
    };
    const config = gridPresetToConfig(preset);
    expect(config.templates['2K'].cellW).toBeGreaterThan(0);
    expect(config.templates['4K'].cellW).toBeGreaterThan(config.templates['2K'].cellW);
  });
});
