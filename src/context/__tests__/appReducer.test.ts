import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../AppContext';
import type {
  AppState,
  RunState,
  GridLink,
  CharacterPreset,
  BuildingPreset,
  TerrainPreset,
  BackgroundPreset,
  GridPreset,
} from '../AppContext';
import type { ExtractedSprite } from '../../lib/spriteExtractor';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    active: true,
    contentPresetId: 'preset-1',
    spriteType: 'character',
    selectedGridLinks: [{} as GridLink, {} as GridLink, {} as GridLink],
    currentGridIndex: 0,
    referenceSheet: null,
    imageSize: '2K',
    groupId: 'test-group',
    ...overrides,
  };
}

function makeSprite(overrides: Partial<ExtractedSprite> = {}): ExtractedSprite {
  return {
    cellIndex: 0,
    label: 'idle',
    imageData: 'base64data',
    mimeType: 'image/png',
    width: 64,
    height: 64,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('appReducer', () => {
  // ── SET_SPRITE_TYPE ──────────────────────────────────────────────────────

  describe('SET_SPRITE_TYPE', () => {
    it('updates spriteType', () => {
      const result = reducer(initialState, { type: 'SET_SPRITE_TYPE', spriteType: 'building' });
      expect(result.spriteType).toBe('building');
    });

    it('clears shared workflow state to prevent cross-type contamination', () => {
      const state: AppState = {
        ...initialState,
        spriteType: 'character',
        step: 'review',
        activeGridConfig: { cols: 6, rows: 6, cellLabels: ['a'] },
        filledGridImage: 'some-image',
        templateImage: 'some-template',
        sprites: [makeSprite()],
        historyId: 42,
      };
      const result = reducer(state, { type: 'SET_SPRITE_TYPE', spriteType: 'building' });
      expect(result.spriteType).toBe('building');
      expect(result.activeGridConfig).toBeNull();
      expect(result.filledGridImage).toBeNull();
      expect(result.templateImage).toBeNull();
      expect(result.sprites).toEqual([]);
      expect(result.historyId).toBeNull();
      expect(result.step).toBe('configure');
    });

    it('preserves per-type config and presets', () => {
      const state: AppState = {
        ...initialState,
        character: { ...initialState.character, name: 'Hero' },
        presets: [{ id: '1', name: 'A', genre: 'g', description: '', equipment: '', colorNotes: '', rowGuidance: '' }],
      };
      const result = reducer(state, { type: 'SET_SPRITE_TYPE', spriteType: 'terrain' });
      expect(result.character.name).toBe('Hero');
      expect(result.presets).toBe(state.presets);
    });
  });

  // ── SET_CHARACTER / SET_BUILDING / SET_TERRAIN / SET_BACKGROUND ─────────

  describe('SET_CHARACTER', () => {
    it('replaces the character config', () => {
      const character: AppState['character'] = {
        name: 'Hero',
        description: 'A brave warrior',
        equipment: 'Sword',
        colorNotes: 'Blue',
        styleNotes: 'Pixel',
        rowGuidance: 'Walk cycle',
      };
      const result = reducer(initialState, { type: 'SET_CHARACTER', character });
      expect(result.character).toEqual(character);
    });
  });

  describe('SET_BUILDING', () => {
    it('replaces the building config', () => {
      const building: AppState['building'] = {
        name: 'Castle',
        description: 'A stone castle',
        details: 'Tall towers',
        colorNotes: 'Grey',
        styleNotes: 'Medieval',
        cellGuidance: 'Front view',
        gridSize: '2x2',
        cellLabels: ['a', 'b', 'c', 'd'],
      };
      const result = reducer(initialState, { type: 'SET_BUILDING', building });
      expect(result.building).toEqual(building);
    });
  });

  describe('SET_TERRAIN', () => {
    it('replaces the terrain config', () => {
      const terrain: AppState['terrain'] = {
        name: 'Forest',
        description: 'Dense forest',
        colorNotes: 'Green',
        styleNotes: 'Lush',
        tileGuidance: 'Top-down',
        gridSize: '3x3',
        cellLabels: Array(9).fill('tree'),
      };
      const result = reducer(initialState, { type: 'SET_TERRAIN', terrain });
      expect(result.terrain).toEqual(terrain);
    });
  });

  describe('SET_BACKGROUND', () => {
    it('replaces the background config', () => {
      const background: AppState['background'] = {
        name: 'Sky',
        description: 'Blue sky',
        colorNotes: 'Gradient',
        styleNotes: 'Soft',
        layerGuidance: 'Parallax layers',
        bgMode: 'parallax',
        gridSize: '1x4',
        cellLabels: ['sky', 'clouds', 'mountains', 'ground'],
      };
      const result = reducer(initialState, { type: 'SET_BACKGROUND', background });
      expect(result.background).toEqual(background);
    });
  });

  // ── SET_MODEL / SET_IMAGE_SIZE / SET_ASPECT_RATIO ───────────────────────

  describe('SET_MODEL', () => {
    it('updates model', () => {
      const result = reducer(initialState, { type: 'SET_MODEL', model: 'gemini-pro' });
      expect(result.model).toBe('gemini-pro');
    });
  });

  describe('SET_IMAGE_SIZE', () => {
    it('updates imageSize', () => {
      const result = reducer(initialState, { type: 'SET_IMAGE_SIZE', imageSize: '4K' });
      expect(result.imageSize).toBe('4K');
    });
  });

  describe('SET_ASPECT_RATIO', () => {
    it('updates aspectRatio', () => {
      const result = reducer(initialState, { type: 'SET_ASPECT_RATIO', payload: '16:9' });
      expect(result.aspectRatio).toBe('16:9');
    });
  });

  // ── GENERATE_START ──────────────────────────────────────────────────────

  describe('GENERATE_START', () => {
    it('sets step to generating and clears previous results', () => {
      const state: AppState = {
        ...initialState,
        filledGridImage: 'old-image',
        sprites: [makeSprite()],
        error: 'old error',
      };
      const result = reducer(state, {
        type: 'GENERATE_START',
        templateImage: 'template-base64',
      });
      expect(result.step).toBe('generating');
      expect(result.templateImage).toBe('template-base64');
      expect(result.filledGridImage).toBeNull();
      expect(result.sprites).toEqual([]);
      expect(result.error).toBeNull();
      expect(result.geminiText).toBe('');
      expect(result.status).toBe('Generating sprites...');
      expect(result.statusType).toBe('info');
    });

    it('updates activeGridConfig when provided', () => {
      const gridConfig = { cols: 6, rows: 6, cellLabels: ['a', 'b'] };
      const result = reducer(initialState, {
        type: 'GENERATE_START',
        templateImage: 'img',
        gridConfig,
      });
      expect(result.activeGridConfig).toEqual(gridConfig);
    });

    it('preserves existing activeGridConfig when not provided', () => {
      const existing = { cols: 3, rows: 3, cellLabels: ['x'] };
      const state: AppState = { ...initialState, activeGridConfig: existing };
      const result = reducer(state, {
        type: 'GENERATE_START',
        templateImage: 'img',
      });
      expect(result.activeGridConfig).toEqual(existing);
    });
  });

  // ── GENERATE_COMPLETE ───────────────────────────────────────────────────

  describe('GENERATE_COMPLETE', () => {
    it('stores the filled grid image and text', () => {
      const state: AppState = { ...initialState, step: 'generating' };
      const result = reducer(state, {
        type: 'GENERATE_COMPLETE',
        filledGridImage: 'filled-base64',
        filledGridMimeType: 'image/webp',
        geminiText: 'Generation notes',
      });
      expect(result.filledGridImage).toBe('filled-base64');
      expect(result.filledGridMimeType).toBe('image/webp');
      expect(result.geminiText).toBe('Generation notes');
      expect(result.status).toContain('Extracting');
      expect(result.statusType).toBe('success');
    });
  });

  // ── GENERATE_ERROR ──────────────────────────────────────────────────────

  describe('GENERATE_ERROR', () => {
    it('resets step to configure and sets error', () => {
      const state: AppState = { ...initialState, step: 'generating' };
      const result = reducer(state, {
        type: 'GENERATE_ERROR',
        error: 'API timeout',
      });
      expect(result.step).toBe('configure');
      expect(result.error).toBe('API timeout');
      expect(result.status).toBe('API timeout');
      expect(result.statusType).toBe('error');
    });

    it('clears state.run to prevent auto-trigger loops', () => {
      const state: AppState = {
        ...initialState,
        step: 'run-active',
        run: makeRunState(),
      };
      const result = reducer(state, {
        type: 'GENERATE_ERROR',
        error: 'Network failure',
      });
      expect(result.run).toBeNull();
      expect(result.step).toBe('configure');
    });
  });

  // ── EXTRACTION_COMPLETE ─────────────────────────────────────────────────

  describe('EXTRACTION_COMPLETE', () => {
    it('sets step to review and stores sprites', () => {
      const sprites = [makeSprite({ cellIndex: 0 }), makeSprite({ cellIndex: 1 })];
      const state: AppState = { ...initialState, step: 'generating' };
      const result = reducer(state, { type: 'EXTRACTION_COMPLETE', sprites });
      expect(result.step).toBe('review');
      expect(result.sprites).toEqual(sprites);
      expect(result.status).toBe('Extracted 2 sprites');
      expect(result.statusType).toBe('success');
    });

    it('handles zero sprites', () => {
      const result = reducer(initialState, { type: 'EXTRACTION_COMPLETE', sprites: [] });
      expect(result.sprites).toEqual([]);
      expect(result.status).toBe('Extracted 0 sprites');
    });
  });

  // ── SET_STATUS / CLEAR_STATUS ───────────────────────────────────────────

  describe('SET_STATUS', () => {
    it('sets status message and type', () => {
      const result = reducer(initialState, {
        type: 'SET_STATUS',
        message: 'Processing...',
        statusType: 'warning',
      });
      expect(result.status).toBe('Processing...');
      expect(result.statusType).toBe('warning');
    });
  });

  describe('CLEAR_STATUS', () => {
    it('clears status to empty info', () => {
      const state: AppState = { ...initialState, status: 'Something', statusType: 'error' };
      const result = reducer(state, { type: 'CLEAR_STATUS' });
      expect(result.status).toBe('');
      expect(result.statusType).toBe('info');
    });
  });

  // ── SET_STEP ────────────────────────────────────────────────────────────

  describe('SET_STEP', () => {
    it('updates the workflow step', () => {
      const result = reducer(initialState, { type: 'SET_STEP', step: 'review' });
      expect(result.step).toBe('review');
    });
  });

  // ── SET_HISTORY_ID ──────────────────────────────────────────────────────

  describe('SET_HISTORY_ID', () => {
    it('sets historyId', () => {
      const result = reducer(initialState, { type: 'SET_HISTORY_ID', id: 42 });
      expect(result.historyId).toBe(42);
    });
  });

  // ── SET_SOURCE_CONTEXT ──────────────────────────────────────────────────

  describe('SET_SOURCE_CONTEXT', () => {
    it('sets source groupId and contentPresetId', () => {
      const result = reducer(initialState, {
        type: 'SET_SOURCE_CONTEXT',
        groupId: 'g1',
        contentPresetId: 'p1',
      });
      expect(result.sourceGroupId).toBe('g1');
      expect(result.sourceContentPresetId).toBe('p1');
    });

    it('clears source context with nulls', () => {
      const state: AppState = { ...initialState, sourceGroupId: 'g1', sourceContentPresetId: 'p1' };
      const result = reducer(state, { type: 'SET_SOURCE_CONTEXT', groupId: null, contentPresetId: null });
      expect(result.sourceGroupId).toBeNull();
      expect(result.sourceContentPresetId).toBeNull();
    });
  });

  // ── LOAD_PRESET (character) ─────────────────────────────────────────────

  describe('LOAD_PRESET', () => {
    it('loads character preset into character config', () => {
      const preset: CharacterPreset = {
        id: 'char-1',
        name: 'Knight',
        genre: 'fantasy',
        description: 'A noble knight',
        equipment: 'Plate armor, sword',
        colorNotes: 'Silver and blue',
        rowGuidance: 'Walk, attack, idle',
      };
      const result = reducer(initialState, { type: 'LOAD_PRESET', preset });
      expect(result.activeContentPresetIds.character).toBe('char-1');
      expect(result.character.name).toBe('Knight');
      expect(result.character.description).toBe('A noble knight');
      expect(result.character.equipment).toBe('Plate armor, sword');
      expect(result.character.colorNotes).toBe('Silver and blue');
      expect(result.character.styleNotes).toBe('');
      expect(result.character.rowGuidance).toBe('Walk, attack, idle');
    });
  });

  // ── LOAD_BUILDING_PRESET ────────────────────────────────────────────────

  describe('LOAD_BUILDING_PRESET', () => {
    it('loads building preset with correct cell count for 3x3', () => {
      const preset: BuildingPreset = {
        id: 'bld-1',
        name: 'Tower',
        genre: 'fantasy',
        gridSize: '3x3',
        description: 'A stone tower',
        details: 'Tall',
        colorNotes: 'Grey',
        cellLabels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
        cellGuidance: 'Front',
      };
      const result = reducer(initialState, { type: 'LOAD_BUILDING_PRESET', preset });
      expect(result.activeContentPresetIds.building).toBe('bld-1');
      expect(result.building.cellLabels).toHaveLength(9);
      expect(result.building.gridSize).toBe('3x3');
    });

    it('pads labels when preset has fewer than grid requires', () => {
      const preset: BuildingPreset = {
        id: 'bld-2',
        name: 'Hut',
        genre: 'fantasy',
        gridSize: '2x3',
        description: 'A small hut',
        details: 'Tiny',
        colorNotes: 'Brown',
        cellLabels: ['front', 'side'],
        cellGuidance: 'Top',
      };
      const result = reducer(initialState, { type: 'LOAD_BUILDING_PRESET', preset });
      expect(result.building.cellLabels).toHaveLength(6);
      expect(result.building.cellLabels[0]).toBe('front');
      expect(result.building.cellLabels[1]).toBe('side');
      expect(result.building.cellLabels[2]).toBe('');
    });

    it('truncates labels when preset has more than grid requires', () => {
      const preset: BuildingPreset = {
        id: 'bld-3',
        name: 'Wall',
        genre: 'fantasy',
        gridSize: '2x2',
        description: 'A wall',
        details: 'Thick',
        colorNotes: 'Stone',
        cellLabels: ['a', 'b', 'c', 'd', 'e', 'f'],
        cellGuidance: 'Side',
      };
      const result = reducer(initialState, { type: 'LOAD_BUILDING_PRESET', preset });
      expect(result.building.cellLabels).toHaveLength(4);
    });
  });

  // ── LOAD_TERRAIN_PRESET ─────────────────────────────────────────────────

  describe('LOAD_TERRAIN_PRESET', () => {
    it('loads terrain preset and pads labels to grid cell count', () => {
      const preset: TerrainPreset = {
        id: 'ter-1',
        name: 'Grasslands',
        genre: 'nature',
        gridSize: '4x4',
        description: 'Green fields',
        colorNotes: 'Green shades',
        tileLabels: ['grass'],
        tileGuidance: 'Top-down view',
      };
      const result = reducer(initialState, { type: 'LOAD_TERRAIN_PRESET', preset });
      expect(result.activeContentPresetIds.terrain).toBe('ter-1');
      expect(result.terrain.name).toBe('Grasslands');
      expect(result.terrain.gridSize).toBe('4x4');
      // 4x4 grid = 16 cells, so labels should be padded
      expect(result.terrain.cellLabels).toHaveLength(16);
      expect(result.terrain.cellLabels[0]).toBe('grass');
      expect(result.terrain.cellLabels[1]).toBe('');
    });

    it('truncates terrain labels when too many provided', () => {
      const preset: TerrainPreset = {
        id: 'ter-2',
        name: 'Desert',
        genre: 'arid',
        gridSize: '3x3',
        description: 'Sandy terrain',
        colorNotes: 'Tan',
        tileLabels: Array(20).fill('sand'),
        tileGuidance: 'View',
      };
      const result = reducer(initialState, { type: 'LOAD_TERRAIN_PRESET', preset });
      // 3x3 = 9 cells
      expect(result.terrain.cellLabels).toHaveLength(9);
    });
  });

  // ── LOAD_BACKGROUND_PRESET ──────────────────────────────────────────────

  describe('LOAD_BACKGROUND_PRESET', () => {
    it('loads background preset with bgMode', () => {
      const preset: BackgroundPreset = {
        id: 'bg-1',
        name: 'Sunset',
        genre: 'nature',
        gridSize: '1x4',
        bgMode: 'parallax',
        description: 'Evening sky',
        colorNotes: 'Orange, red',
        layerLabels: ['sky', 'clouds', 'hills', 'ground'],
        layerGuidance: 'Horizontal strips',
      };
      const result = reducer(initialState, { type: 'LOAD_BACKGROUND_PRESET', preset });
      expect(result.activeContentPresetIds.background).toBe('bg-1');
      expect(result.background.bgMode).toBe('parallax');
      expect(result.background.gridSize).toBe('1x4');
      expect(result.background.cellLabels).toHaveLength(4);
    });

    it('pads background labels when fewer than required', () => {
      const preset: BackgroundPreset = {
        id: 'bg-2',
        name: 'Night',
        genre: 'dark',
        gridSize: '1x3',
        bgMode: 'parallax',
        description: 'Night sky',
        colorNotes: 'Dark',
        layerLabels: ['stars'],
        layerGuidance: 'Layers',
      };
      const result = reducer(initialState, { type: 'LOAD_BACKGROUND_PRESET', preset });
      expect(result.background.cellLabels).toHaveLength(3);
      expect(result.background.cellLabels[0]).toBe('stars');
      expect(result.background.cellLabels[1]).toBe('');
    });
  });

  // ── SET_PRESETS / SET_*_PRESETS / SET_GRID_PRESETS ───────────────────────

  describe('SET_PRESETS', () => {
    it('sets character presets', () => {
      const presets: CharacterPreset[] = [
        { id: '1', name: 'A', genre: 'g', description: '', equipment: '', colorNotes: '', rowGuidance: '' },
      ];
      const result = reducer(initialState, { type: 'SET_PRESETS', presets });
      expect(result.presets).toEqual(presets);
    });
  });

  describe('SET_BUILDING_PRESETS', () => {
    it('sets building presets', () => {
      const presets: BuildingPreset[] = [];
      const result = reducer(initialState, { type: 'SET_BUILDING_PRESETS', presets });
      expect(result.buildingPresets).toEqual(presets);
    });
  });

  describe('SET_TERRAIN_PRESETS', () => {
    it('sets terrain presets', () => {
      const presets: TerrainPreset[] = [];
      const result = reducer(initialState, { type: 'SET_TERRAIN_PRESETS', presets });
      expect(result.terrainPresets).toEqual(presets);
    });
  });

  describe('SET_BACKGROUND_PRESETS', () => {
    it('sets background presets', () => {
      const presets: BackgroundPreset[] = [];
      const result = reducer(initialState, { type: 'SET_BACKGROUND_PRESETS', presets });
      expect(result.backgroundPresets).toEqual(presets);
    });
  });

  describe('SET_GRID_PRESETS', () => {
    it('sets grid presets', () => {
      const presets: GridPreset[] = [];
      const result = reducer(initialState, { type: 'SET_GRID_PRESETS', presets });
      expect(result.gridPresets).toEqual(presets);
    });
  });

  // ── SET_ACTIVE_GRID_CONFIG ──────────────────────────────────────────────

  describe('SET_ACTIVE_GRID_CONFIG', () => {
    it('sets the active grid config', () => {
      const gridConfig = { cols: 4, rows: 4, cellLabels: ['a'] };
      const result = reducer(initialState, { type: 'SET_ACTIVE_GRID_CONFIG', gridConfig });
      expect(result.activeGridConfig).toEqual(gridConfig);
    });

    it('clears grid config with null', () => {
      const state: AppState = { ...initialState, activeGridConfig: { cols: 2, rows: 2, cellLabels: [] } };
      const result = reducer(state, { type: 'SET_ACTIVE_GRID_CONFIG', gridConfig: null });
      expect(result.activeGridConfig).toBeNull();
    });
  });

  // ── START_RUN ───────────────────────────────────────────────────────────

  describe('START_RUN', () => {
    it('initializes run state with step run-active', () => {
      const gridLinks = [{} as GridLink, {} as GridLink];
      const result = reducer(initialState, {
        type: 'START_RUN',
        payload: {
          contentPresetId: 'p1',
          spriteType: 'character',
          gridLinks,
          imageSize: '4K',
          groupId: 'custom-group',
        },
      });
      expect(result.step).toBe('run-active');
      expect(result.activeContentPresetIds.character).toBe('p1');
      expect(result.run).not.toBeNull();
      expect(result.run!.active).toBe(true);
      expect(result.run!.currentGridIndex).toBe(0);
      expect(result.run!.referenceSheet).toBeNull();
      expect(result.run!.imageSize).toBe('4K');
      expect(result.run!.groupId).toBe('custom-group');
      expect(result.run!.selectedGridLinks).toBe(gridLinks);
    });

    it('generates a groupId when none provided', () => {
      const result = reducer(initialState, {
        type: 'START_RUN',
        payload: {
          contentPresetId: 'p1',
          spriteType: 'building',
          gridLinks: [],
          imageSize: '2K',
        },
      });
      expect(result.run!.groupId).toMatch(/^run-/);
    });
  });

  // ── COMPLETE_GRID ───────────────────────────────────────────────────────

  describe('COMPLETE_GRID', () => {
    it('stores first completed grid as reference sheet', () => {
      const state: AppState = { ...initialState, run: makeRunState() };
      const result = reducer(state, {
        type: 'COMPLETE_GRID',
        payload: { filledGridImage: 'first-grid' },
      });
      expect(result.run!.referenceSheet).toBe('first-grid');
    });

    it('does not overwrite existing reference sheet', () => {
      const state: AppState = {
        ...initialState,
        run: makeRunState({ referenceSheet: 'existing-ref' }),
      };
      const result = reducer(state, {
        type: 'COMPLETE_GRID',
        payload: { filledGridImage: 'second-grid' },
      });
      expect(result.run!.referenceSheet).toBe('existing-ref');
    });

    it('returns state unchanged when no run is active', () => {
      const result = reducer(initialState, {
        type: 'COMPLETE_GRID',
        payload: { filledGridImage: 'img' },
      });
      expect(result).toBe(initialState);
    });
  });

  // ── NEXT_GRID ───────────────────────────────────────────────────────────

  describe('NEXT_GRID', () => {
    it('advances to the next grid index', () => {
      const state: AppState = {
        ...initialState,
        step: 'run-active',
        run: makeRunState({ currentGridIndex: 0 }),
      };
      const result = reducer(state, { type: 'NEXT_GRID' });
      expect(result.run!.currentGridIndex).toBe(1);
      expect(result.step).toBe('run-active');
    });

    it('completes run when reaching last grid (off-by-one check)', () => {
      const gridLinks = [{} as GridLink, {} as GridLink];
      const state: AppState = {
        ...initialState,
        step: 'run-active',
        run: makeRunState({ currentGridIndex: 1, selectedGridLinks: gridLinks }),
      };
      const result = reducer(state, { type: 'NEXT_GRID' });
      expect(result.run).toBeNull();
      expect(result.step).toBe('configure');
    });

    it('does not complete run on second-to-last grid', () => {
      const gridLinks = [{} as GridLink, {} as GridLink, {} as GridLink];
      const state: AppState = {
        ...initialState,
        step: 'run-active',
        run: makeRunState({ currentGridIndex: 1, selectedGridLinks: gridLinks }),
      };
      const result = reducer(state, { type: 'NEXT_GRID' });
      expect(result.run).not.toBeNull();
      expect(result.run!.currentGridIndex).toBe(2);
    });

    it('returns state unchanged when no run is active', () => {
      const result = reducer(initialState, { type: 'NEXT_GRID' });
      expect(result).toBe(initialState);
    });

    it('completes single-grid run on NEXT_GRID', () => {
      const state: AppState = {
        ...initialState,
        step: 'run-active',
        run: makeRunState({ currentGridIndex: 0, selectedGridLinks: [{} as GridLink] }),
      };
      const result = reducer(state, { type: 'NEXT_GRID' });
      expect(result.run).toBeNull();
      expect(result.step).toBe('configure');
    });
  });

  // ── END_RUN ─────────────────────────────────────────────────────────────

  describe('END_RUN', () => {
    it('clears run state and returns to configure', () => {
      const state: AppState = {
        ...initialState,
        step: 'run-active',
        run: makeRunState(),
      };
      const result = reducer(state, { type: 'END_RUN' });
      expect(result.run).toBeNull();
      expect(result.step).toBe('configure');
    });
  });

  // ── RESET ───────────────────────────────────────────────────────────────

  describe('RESET', () => {
    it('resets to initial state but preserves presets', () => {
      const charPresets: CharacterPreset[] = [
        { id: '1', name: 'A', genre: 'g', description: '', equipment: '', colorNotes: '', rowGuidance: '' },
      ];
      const buildPresets: BuildingPreset[] = [];
      const terrPresets: TerrainPreset[] = [];
      const bgPresets: BackgroundPreset[] = [];
      const gridPresets: GridPreset[] = [];
      const state: AppState = {
        ...initialState,
        step: 'review',
        character: { ...initialState.character, name: 'Modified' },
        filledGridImage: 'some-image',
        historyId: 99,
        presets: charPresets,
        buildingPresets: buildPresets,
        terrainPresets: terrPresets,
        backgroundPresets: bgPresets,
        gridPresets,
        sourceGroupId: 'old-group',
        sourceContentPresetId: 'old-preset',
      };
      const result = reducer(state, { type: 'RESET' });
      expect(result.step).toBe('configure');
      expect(result.character.name).toBe('');
      expect(result.filledGridImage).toBeNull();
      expect(result.historyId).toBeNull();
      expect(result.presets).toBe(charPresets);
      expect(result.buildingPresets).toBe(buildPresets);
      expect(result.terrainPresets).toBe(terrPresets);
      expect(result.backgroundPresets).toBe(bgPresets);
      expect(result.gridPresets).toBe(gridPresets);
      expect(result.sourceGroupId).toBeNull();
      expect(result.sourceContentPresetId).toBeNull();
    });

    it('clears run state on reset', () => {
      const state: AppState = { ...initialState, run: makeRunState() };
      const result = reducer(state, { type: 'RESET' });
      expect(result.run).toBeNull();
    });
  });

  // ── Default / unknown action ────────────────────────────────────────────

  describe('unknown action', () => {
    it('returns state unchanged for unknown action type', () => {
      const result = reducer(initialState, { type: 'NONEXISTENT' } as never);
      expect(result).toBe(initialState);
    });
  });
});
