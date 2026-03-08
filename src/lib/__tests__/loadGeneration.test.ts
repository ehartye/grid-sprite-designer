import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadGenerationIntoState } from '../loadGeneration';
import type { Action, RestoreSessionPayload } from '../../context/AppContext';
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

function getPayload(dispatched: Action[]): RestoreSessionPayload {
  const action = dispatched.find(a => a.type === 'RESTORE_SESSION');
  if (!action || action.type !== 'RESTORE_SESSION') {
    throw new Error('RESTORE_SESSION not dispatched');
  }
  return action.payload;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loadGenerationIntoState', () => {
  let dispatched: ReturnType<typeof makeDispatch>;

  beforeEach(() => {
    dispatched = makeDispatch();
    vi.clearAllMocks();
  });

  // ── Single dispatch ──────────────────────────────────────────────────────

  it('dispatches exactly one RESTORE_SESSION action', async () => {
    await loadGenerationIntoState(makeData(), dispatched.fn, { historyId: 1 });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('RESTORE_SESSION');
  });

  it('does not dispatch GENERATE_COMPLETE (no spurious "Grid received!" message)', async () => {
    await loadGenerationIntoState(makeData(), dispatched.fn, { historyId: 1 });
    expect(dispatched.find(a => a.type === 'GENERATE_COMPLETE')).toBeUndefined();
  });

  // ── Sprite type ──────────────────────────────────────────────────────────

  it('sets spriteType to character by default', async () => {
    await loadGenerationIntoState(makeData({ spriteType: 'character' }), dispatched.fn, { historyId: 1 });
    expect(getPayload(dispatched).spriteType).toBe('character');
  });

  it('sets spriteType for non-character types', async () => {
    await loadGenerationIntoState(makeData({ spriteType: 'building', gridSize: '3x3' }), dispatched.fn, { historyId: 1 });
    expect(getPayload(dispatched).spriteType).toBe('building');
  });

  it('defaults to character when spriteType is missing', async () => {
    await loadGenerationIntoState(makeData({ spriteType: undefined }), dispatched.fn, { historyId: 1 });
    expect(getPayload(dispatched).spriteType).toBe('character');
  });

  // ── Config per sprite type ───────────────────────────────────────────────

  it('includes character config for character with content', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'character', content: { name: 'Hero', description: 'Brave', equipment: 'Sword' } }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.character).toBeDefined();
    expect(p.character!.name).toBe('Hero');
    expect(p.character!.equipment).toBe('Sword');
  });

  it('includes building config for building with valid gridSize', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'building', gridSize: '3x3', content: { name: 'Castle', description: 'Big' } }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.building).toBeDefined();
    expect(p.building!.gridSize).toBe('3x3');
    expect(p.building!.name).toBe('Castle');
  });

  it('includes terrain config for terrain with valid gridSize', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'terrain', gridSize: '4x4', content: { name: 'Forest', description: 'Dense' } }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.terrain).toBeDefined();
    expect(p.terrain!.gridSize).toBe('4x4');
  });

  it('includes background config for background with valid gridSize', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'background', gridSize: '1x4', content: { name: 'Sky', description: 'Blue' } }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.background).toBeDefined();
    expect(p.background!.gridSize).toBe('1x4');
    expect(p.background!.bgMode).toBe('parallax');
  });

  it('sets bgMode to scene for non-1x background grids', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'background', gridSize: '2x2', content: { name: 'Town', description: 'Busy' } }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.background!.bgMode).toBe('scene');
  });

  // ── Invalid gridSize validation ─────────────────────────────────────────

  it('skips building config for invalid gridSize', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadGenerationIntoState(
      makeData({ spriteType: 'building', gridSize: '99x99' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).building).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid building gridSize'));
    warn.mockRestore();
  });

  it('skips terrain config for invalid gridSize', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadGenerationIntoState(
      makeData({ spriteType: 'terrain', gridSize: '99x99' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).terrain).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid terrain gridSize'));
    warn.mockRestore();
  });

  it('skips background config for invalid gridSize', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadGenerationIntoState(
      makeData({ spriteType: 'background', gridSize: '99x99' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).background).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid background gridSize'));
    warn.mockRestore();
  });

  // ── Grid dimension inference ────────────────────────────────────────────

  it('infers grid dimensions from gridSize string', async () => {
    await loadGenerationIntoState(
      makeData({ gridSize: '3x3' }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.activeGridConfig?.cols).toBe(3);
    expect(p.activeGridConfig?.rows).toBe(3);
  });

  it('defaults to 6x6 when no gridSize and 36 sprites', async () => {
    const sprites = Array.from({ length: 36 }, (_, i) => ({
      label: `cell-${i}`, cellIndex: i, imageData: 'data', mimeType: 'image/png',
    }));
    await loadGenerationIntoState(
      makeData({ gridSize: undefined, sprites }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.activeGridConfig?.cols).toBe(6);
    expect(p.activeGridConfig?.rows).toBe(6);
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
    const p = getPayload(dispatched);
    expect(p.activeGridConfig?.cols).toBe(8);
    expect(p.activeGridConfig?.rows).toBe(1);
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
    const p = getPayload(dispatched);
    // 7 is not divisible by 8,6,5,4,3,2 — but IS divisible by 1
    expect(p.activeGridConfig?.cols).toBe(1);
    expect(p.activeGridConfig?.rows).toBe(7);
  });

  it('defaults to 6x6 when no gridSize and no sprites', async () => {
    await loadGenerationIntoState(
      makeData({ gridSize: undefined, sprites: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.activeGridConfig?.cols).toBe(6);
    expect(p.activeGridConfig?.rows).toBe(6);
  });

  // ── Filled grid / extraction ────────────────────────────────────────────

  it('extracts sprites when filledGridImage present', async () => {
    await loadGenerationIntoState(
      makeData({ filledGridImage: 'img-data', filledGridMimeType: 'image/webp' }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.filledGridImage).toBe('img-data');
    expect(p.filledGridMimeType).toBe('image/webp');
    expect(p.sprites.length).toBeGreaterThan(0);
  });

  it('defaults mimeType to image/png when not provided', async () => {
    await loadGenerationIntoState(
      makeData({ filledGridMimeType: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).filledGridMimeType).toBe('image/png');
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
    const p = getPayload(dispatched);
    expect(p.sprites[0].width).toBe(0);
    expect(p.sprites[0].height).toBe(0);
  });

  it('uses empty sprites when no image and no sprites', async () => {
    await loadGenerationIntoState(
      makeData({ filledGridImage: undefined, sprites: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).sprites).toEqual([]);
  });

  // ── History and source context ──────────────────────────────────────────

  it('includes historyId and source context in payload', async () => {
    await loadGenerationIntoState(
      makeData({ groupId: 'g1', contentPresetId: 'p1' }),
      dispatched.fn, { historyId: 42 },
    );
    const p = getPayload(dispatched);
    expect(p.historyId).toBe(42);
    expect(p.sourceGroupId).toBe('g1');
    expect(p.sourceContentPresetId).toBe('p1');
  });

  it('passes null for missing groupId and contentPresetId', async () => {
    await loadGenerationIntoState(
      makeData({ groupId: undefined, contentPresetId: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.sourceGroupId).toBeNull();
    expect(p.sourceContentPresetId).toBeNull();
  });

  // ── Aspect ratio passthrough ────────────────────────────────────────────

  it('passes aspectRatio through to activeGridConfig', async () => {
    await loadGenerationIntoState(
      makeData({ aspectRatio: '16:9' }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).activeGridConfig?.aspectRatio).toBe('16:9');
  });

  // ── Content field fallbacks ─────────────────────────────────────────────

  it('handles missing content fields gracefully', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'character', content: {} }),
      dispatched.fn, { historyId: 1 },
    );
    const p = getPayload(dispatched);
    expect(p.character!.name).toBe('');
    expect(p.character!.description).toBe('');
    expect(p.character!.equipment).toBe('');
  });

  it('does not include character config when content is missing', async () => {
    await loadGenerationIntoState(
      makeData({ spriteType: 'character', content: undefined }),
      dispatched.fn, { historyId: 1 },
    );
    expect(getPayload(dispatched).character).toBeUndefined();
  });
});
