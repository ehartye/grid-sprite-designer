import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadGenerationIntoState } from '../loadGeneration';
import type { Action } from '../../context/AppContext';
import type { HistoryResponse } from '../../types/api';

// Mock extractSprites — it depends on canvas which isn't available in Node
vi.mock('../spriteExtractor', () => ({
  extractSprites: vi.fn().mockResolvedValue([
    { cellIndex: 0, label: 'idle', imageData: 'base64', mimeType: 'image/png', width: 64, height: 64 },
  ]),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDispatch(): Action[] & { fn: (action: Action) => void } {
  const actions: Action[] = [];
  const fn = (action: Action) => { actions.push(action); };
  return Object.assign(actions, { fn });
}

function makeData(overrides: Partial<HistoryResponse> = {}): HistoryResponse {
  return {
    id: 1,
    spriteType: 'character',
    filledGridImage: 'base64-image',
    filledGridMimeType: 'image/png',
    geminiText: 'Generated',
    content: { name: 'Hero', description: 'A brave hero' },
    sprites: [{ label: 'idle', cellIndex: 0, imageData: 'data', mimeType: 'image/png' }],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loadGenerationIntoState', () => {
  let dispatched: ReturnType<typeof makeDispatch>;

  beforeEach(() => {
    dispatched = makeDispatch();
    vi.clearAllMocks();
  });

  // ── Sprite type dispatch ────────────────────────────────────────────────

  it('does not dispatch SET_SPRITE_TYPE for character', async () => {
    await loadGenerationIntoState(makeData({ spriteType: 'character' }), dispatched.fn, { historyId: 1 });
    expect(dispatched.find(a => a.type === 'SET_SPRITE_TYPE')).toBeUndefined();
  });

  it('dispatches SET_SPRITE_TYPE for non-character types', async () => {
    await loadGenerationIntoState(makeData({ spriteType: 'building', gridSize: '3x3' }), dispatched.fn, { historyId: 1 });
    const action = dispatched.find(a => a.type === 'SET_SPRITE_TYPE');
    expect(action).toBeDefined();
    expect(action!.type === 'SET_SPRITE_TYPE' && action!.spriteType).toBe('building');
  });

  it('defaults to character when spriteType is missing', async () => {
    await loadGenerationIntoState(makeData({ spriteType: undefined }), dispatched.fn, { historyId: 1 });
    expect(dispatched.find(a => a.type === 'SET_SPRITE_TYPE')).toBeUndefined();
  });

  // ── Config dispatch per sprite type ─────────────────────────────────────

  it('dispatches SET_CHARACTER for character with content', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'character', content: { name: 'Hero', description: 'Brave', equipment: 'Sword' } }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_CHARACTER');
    expect(action).toBeDefined();
    if (action?.type === 'SET_CHARACTER') {
      expect(action.character.name).toBe('Hero');
      expect(action.character.equipment).toBe('Sword');
    }
  });

  it('dispatches SET_BUILDING for building with valid gridSize', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'building', gridSize: '3x3', content: { name: 'Castle', description: 'Big' } }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_BUILDING');
    expect(action).toBeDefined();
    if (action?.type === 'SET_BUILDING') {
      expect(action.building.gridSize).toBe('3x3');
      expect(action.building.name).toBe('Castle');
    }
  });

  it('dispatches SET_TERRAIN for terrain with valid gridSize', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'terrain', gridSize: '4x4', content: { name: 'Forest', description: 'Dense' } }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_TERRAIN');
    expect(action).toBeDefined();
    if (action?.type === 'SET_TERRAIN') {
      expect(action.terrain.gridSize).toBe('4x4');
    }
  });

  it('dispatches SET_BACKGROUND for background with valid gridSize', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'background', gridSize: '1x4', content: { name: 'Sky', description: 'Blue' } }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_BACKGROUND');
    expect(action).toBeDefined();
    if (action?.type === 'SET_BACKGROUND') {
      expect(action.background.gridSize).toBe('1x4');
      expect(action.background.bgMode).toBe('parallax');
    }
  });

  it('sets bgMode to scene for non-1x background grids', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'background', gridSize: '2x2', content: { name: 'Town', description: 'Busy' } }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_BACKGROUND');
    if (action?.type === 'SET_BACKGROUND') {
      expect(action.background.bgMode).toBe('scene');
    }
  });

  // ── Invalid gridSize validation ─────────────────────────────────────────

  it('skips SET_BUILDING for invalid gridSize', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadGenerationIntoState(
      makeData({ spriteType: 'building', gridSize: '99x99' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(dispatched.find(a => a.type === 'SET_BUILDING')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid building gridSize'));
    warn.mockRestore();
  });

  it('skips SET_TERRAIN for invalid gridSize', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadGenerationIntoState(
      makeData({ spriteType: 'terrain', gridSize: '99x99' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(dispatched.find(a => a.type === 'SET_TERRAIN')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid terrain gridSize'));
    warn.mockRestore();
  });

  it('skips SET_BACKGROUND for invalid gridSize', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadGenerationIntoState(
      makeData({ spriteType: 'background', gridSize: '99x99' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(dispatched.find(a => a.type === 'SET_BACKGROUND')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid background gridSize'));
    warn.mockRestore();
  });

  // ── Grid dimension inference ────────────────────────────────────────────

  it('infers grid dimensions from gridSize string', async () => {
    await loadGenerationIntoState(
      makeData({ gridSize: '3x3' }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_ACTIVE_GRID_CONFIG');
    expect(action).toBeDefined();
    if (action?.type === 'SET_ACTIVE_GRID_CONFIG') {
      expect(action.gridConfig?.cols).toBe(3);
      expect(action.gridConfig?.rows).toBe(3);
    }
  });

  it('defaults to 6x6 when no gridSize and 36 sprites', async () => {
    const sprites = Array.from({ length: 36 }, (_, i) => ({
      label: `cell-${i}`, cellIndex: i, imageData: 'data', mimeType: 'image/png',
    }));
    await loadGenerationIntoState(
      makeData({ gridSize: undefined, sprites }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_ACTIVE_GRID_CONFIG');
    if (action?.type === 'SET_ACTIVE_GRID_CONFIG') {
      expect(action.gridConfig?.cols).toBe(6);
      expect(action.gridConfig?.rows).toBe(6);
    }
  });

  it('infers non-6x6 grid from sprite count', async () => {
    // 8 sprites -> best fit is 8 cols x 1 row
    const sprites = Array.from({ length: 8 }, (_, i) => ({
      label: `cell-${i}`, cellIndex: i, imageData: 'data', mimeType: 'image/png',
    }));
    await loadGenerationIntoState(
      makeData({ gridSize: undefined, sprites }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_ACTIVE_GRID_CONFIG');
    if (action?.type === 'SET_ACTIVE_GRID_CONFIG') {
      expect(action.gridConfig?.cols).toBe(8);
      expect(action.gridConfig?.rows).toBe(1);
    }
  });

  it('infers grid from 7 sprites (prime number)', async () => {
    // 7 sprites -> [8,6,5,4,3,2,1] -> 1 divides 7 -> 1 col, 7 rows
    const sprites = Array.from({ length: 7 }, (_, i) => ({
      label: `cell-${i}`, cellIndex: i, imageData: 'data', mimeType: 'image/png',
    }));
    await loadGenerationIntoState(
      makeData({ gridSize: undefined, sprites }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_ACTIVE_GRID_CONFIG');
    if (action?.type === 'SET_ACTIVE_GRID_CONFIG') {
      // 7 is not divisible by 8,6,5,4,3,2 — but IS divisible by 1
      expect(action.gridConfig?.cols).toBe(1);
      expect(action.gridConfig?.rows).toBe(7);
    }
  });

  it('defaults to 6x6 when no gridSize and no sprites', async () => {
    await loadGenerationIntoState(
      makeData({ gridSize: undefined, sprites: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_ACTIVE_GRID_CONFIG');
    if (action?.type === 'SET_ACTIVE_GRID_CONFIG') {
      expect(action.gridConfig?.cols).toBe(6);
      expect(action.gridConfig?.rows).toBe(6);
    }
  });

  // ── Filled grid / extraction ────────────────────────────────────────────

  it('dispatches GENERATE_COMPLETE and EXTRACTION_COMPLETE when filledGridImage present', async () => {
    await loadGenerationIntoState(
      makeData({ filledGridImage: 'img-data', filledGridMimeType: 'image/webp' }),
      dispatched.fn, { historyId: 1 },
    );
    const genComplete = dispatched.find(a => a.type === 'GENERATE_COMPLETE');
    expect(genComplete).toBeDefined();
    if (genComplete?.type === 'GENERATE_COMPLETE') {
      expect(genComplete.filledGridImage).toBe('img-data');
      expect(genComplete.filledGridMimeType).toBe('image/webp');
    }
    expect(dispatched.find(a => a.type === 'EXTRACTION_COMPLETE')).toBeDefined();
  });

  it('defaults mimeType to image/png when not provided', async () => {
    await loadGenerationIntoState(
      makeData({ filledGridMimeType: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    const genComplete = dispatched.find(a => a.type === 'GENERATE_COMPLETE');
    if (genComplete?.type === 'GENERATE_COMPLETE') {
      expect(genComplete.filledGridMimeType).toBe('image/png');
    }
  });

  // ── Sprites from history (no filledGridImage) ───────────────────────────

  it('restores sprites from history with default width/height', async () => {
    const sprites = [
      { label: 'idle', cellIndex: 0, imageData: 'data', mimeType: 'image/png' },
    ];
    await loadGenerationIntoState(
      makeData({ filledGridImage: undefined, sprites }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'EXTRACTION_COMPLETE');
    expect(action).toBeDefined();
    if (action?.type === 'EXTRACTION_COMPLETE') {
      expect(action.sprites[0].width).toBe(0);
      expect(action.sprites[0].height).toBe(0);
    }
  });

  it('does not dispatch EXTRACTION_COMPLETE when no image and no sprites', async () => {
    await loadGenerationIntoState(
      makeData({ filledGridImage: undefined, sprites: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    expect(dispatched.find(a => a.type === 'EXTRACTION_COMPLETE')).toBeUndefined();
  });

  // ── History and source context ──────────────────────────────────────────

  it('dispatches SET_HISTORY_ID and SET_SOURCE_CONTEXT', async () => {
    await loadGenerationIntoState(
      makeData({ groupId: 'g1', contentPresetId: 'p1' }),
      dispatched.fn, { historyId: 42 },
    );
    const historyAction = dispatched.find(a => a.type === 'SET_HISTORY_ID');
    expect(historyAction).toBeDefined();
    if (historyAction?.type === 'SET_HISTORY_ID') {
      expect(historyAction.id).toBe(42);
    }
    const sourceAction = dispatched.find(a => a.type === 'SET_SOURCE_CONTEXT');
    expect(sourceAction).toBeDefined();
    if (sourceAction?.type === 'SET_SOURCE_CONTEXT') {
      expect(sourceAction.groupId).toBe('g1');
      expect(sourceAction.contentPresetId).toBe('p1');
    }
  });

  it('passes null for missing groupId and contentPresetId', async () => {
    await loadGenerationIntoState(
      makeData({ groupId: undefined, contentPresetId: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_SOURCE_CONTEXT');
    if (action?.type === 'SET_SOURCE_CONTEXT') {
      expect(action.groupId).toBeNull();
      expect(action.contentPresetId).toBeNull();
    }
  });

  // ── Aspect ratio passthrough ────────────────────────────────────────────

  it('passes aspectRatio through to SET_ACTIVE_GRID_CONFIG', async () => {
    await loadGenerationIntoState(
      makeData({ aspectRatio: '16:9' }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_ACTIVE_GRID_CONFIG');
    if (action?.type === 'SET_ACTIVE_GRID_CONFIG') {
      expect(action.gridConfig?.aspectRatio).toBe('16:9');
    }
  });

  // ── Content field fallbacks ─────────────────────────────────────────────

  it('handles missing content fields gracefully', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'character', content: {} }),
      dispatched.fn, { historyId: 1 },
    );
    const action = dispatched.find(a => a.type === 'SET_CHARACTER');
    if (action?.type === 'SET_CHARACTER') {
      expect(action.character.name).toBe('');
      expect(action.character.description).toBe('');
      expect(action.character.equipment).toBe('');
    }
  });

  it('does not dispatch config action when content is missing for character', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'character', content: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    expect(dispatched.find(a => a.type === 'SET_CHARACTER')).toBeUndefined();
  });
});
