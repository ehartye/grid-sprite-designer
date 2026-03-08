/**
 * Application state context for the grid sprite designer.
 * Manages the full workflow: configure → generate → extract → review → export
 */

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { ExtractedSprite } from '../lib/spriteExtractor';
import type { TerrainGridSize, BackgroundGridSize, BackgroundMode } from '../lib/gridConfig';
import { TERRAIN_GRIDS, BACKGROUND_GRIDS } from '../lib/gridConfig';

// ── Types ───────────────────────────────────────────────────────────────────

export type SpriteType = 'character' | 'building' | 'terrain' | 'background';
export type BuildingGridSize = '3x3' | '2x3' | '2x2';

export interface CellGroup {
  name: string;
  cells: number[];
}

export interface GridPreset {
  id: number;
  name: string;
  spriteType: 'character' | 'building' | 'terrain' | 'background';
  genre: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode?: 'parallax' | 'scene' | null;
  aspectRatio: string;
  tileShape: 'square' | 'diamond';
}

export interface GridLink {
  id: number;
  gridPresetId: number;
  guidanceOverride: string;
  sortOrder: number;
  gridName: string;
  gridSize: string;
  cols: number;
  rows: number;
  cellLabels: string[];
  cellGroups: CellGroup[];
  genericGuidance: string;
  bgMode?: 'parallax' | 'scene' | null;
  aspectRatio: string;
  tileShape: 'square' | 'diamond';
}

export interface CharacterPreset {
  id: string;
  name: string;
  genre: string;
  description: string;
  equipment: string;
  colorNotes: string;
  rowGuidance: string;
}

export interface BuildingPreset {
  id: string;
  name: string;
  genre: string;
  gridSize: BuildingGridSize;
  description: string;
  details: string;
  colorNotes: string;
  cellLabels: string[];
  cellGuidance: string;
}

export interface TerrainPreset {
  id: string;
  name: string;
  genre: string;
  gridSize: TerrainGridSize;
  description: string;
  colorNotes: string;
  tileLabels: string[];
  tileGuidance: string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  genre: string;
  gridSize: BackgroundGridSize;
  bgMode: BackgroundMode;
  description: string;
  colorNotes: string;
  layerLabels: string[];
  layerGuidance: string;
}

// ── State ────────────────────────────────────────────────────────────────────

export type WorkflowStep = 'configure' | 'generating' | 'review' | 'preview' | 'run-active';

export interface RunState {
  contentPresetId: string | null;
  spriteType: SpriteType;
  selectedGridLinks: GridLink[];
  currentGridIndex: number;
  referenceSheet: string | null;
  imageSize: '2K' | '4K';
  groupId: string;
}

export interface AppState {
  step: WorkflowStep;

  /** Active sprite type mode */
  spriteType: SpriteType;

  character: {
    name: string;
    description: string;
    equipment: string;
    colorNotes: string;
    styleNotes: string;
    rowGuidance: string;
  };

  building: {
    name: string;
    description: string;
    details: string;
    colorNotes: string;
    styleNotes: string;
    cellGuidance: string;
    gridSize: BuildingGridSize;
    cellLabels: string[];
  };

  terrain: {
    name: string;
    description: string;
    colorNotes: string;
    styleNotes: string;
    tileGuidance: string;
    gridSize: TerrainGridSize;
    cellLabels: string[];
  };

  background: {
    name: string;
    description: string;
    colorNotes: string;
    styleNotes: string;
    layerGuidance: string;
    bgMode: BackgroundMode;
    gridSize: BackgroundGridSize;
    cellLabels: string[];
  };

  model: string;
  imageSize: '2K' | '4K';
  aspectRatio: string;

  /** Currently selected content preset ID per sprite type */
  activeContentPresetIds: Record<SpriteType, string | null>;

  /** Grid config used for the current/last generation */
  activeGridConfig: {
    cols: number;
    rows: number;
    cellLabels: string[];
    cellGroups?: CellGroup[];
    aspectRatio?: string;
  } | null;

  /** Base64 of the template grid sent to Gemini */
  templateImage: string | null;
  /** Base64 of the filled grid returned by Gemini */
  filledGridImage: string | null;
  filledGridMimeType: string;
  /** Text response from Gemini (if any) */
  geminiText: string;

  /** Extracted individual sprites */
  sprites: ExtractedSprite[];

  /** Status message for the UI */
  status: string;
  statusType: 'info' | 'success' | 'error' | 'warning';

  /** Error from last operation */
  error: string | null;

  /** History entry ID if saved */
  historyId: number | null;

  /** Source generation context for add-sheet */
  sourceGroupId: string | null;
  sourceContentPresetId: string | null;

  /** Character presets */
  characterPresets: CharacterPreset[];

  /** Building presets */
  buildingPresets: BuildingPreset[];

  /** Terrain presets */
  terrainPresets: TerrainPreset[];

  /** Background presets */
  backgroundPresets: BackgroundPreset[];

  /** Grid presets */
  gridPresets: GridPreset[];

  /** Multi-grid run state */
  run: RunState | null;
}

export const initialState: AppState = {
  step: 'configure',
  spriteType: 'character',
  character: {
    name: '',
    description: '',
    equipment: '',
    colorNotes: '',
    styleNotes: '',
    rowGuidance: '',
  },
  building: {
    name: '',
    description: '',
    details: '',
    colorNotes: '',
    styleNotes: '',
    cellGuidance: '',
    gridSize: '3x3',
    cellLabels: Array(9).fill(''),
  },
  terrain: {
    name: '',
    description: '',
    colorNotes: '',
    styleNotes: '',
    tileGuidance: '',
    gridSize: '4x4' as TerrainGridSize,
    cellLabels: Array(16).fill(''),
  },
  background: {
    name: '',
    description: '',
    colorNotes: '',
    styleNotes: '',
    layerGuidance: '',
    bgMode: 'parallax' as BackgroundMode,
    gridSize: '1x4' as BackgroundGridSize,
    cellLabels: Array(4).fill(''),
  },
  model: 'nano-banana-pro-preview',
  imageSize: '2K',
  aspectRatio: '1:1',
  activeContentPresetIds: { character: null, building: null, terrain: null, background: null },
  activeGridConfig: null,
  templateImage: null,
  filledGridImage: null,
  filledGridMimeType: 'image/png',
  geminiText: '',
  sprites: [],
  status: '',
  statusType: 'info',
  error: null,
  historyId: null,
  sourceGroupId: null,
  sourceContentPresetId: null,
  characterPresets: [],
  buildingPresets: [],
  terrainPresets: [],
  backgroundPresets: [],
  gridPresets: [],
  run: null,
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SPRITE_TYPE'; spriteType: SpriteType }
  | { type: 'SET_CHARACTER'; character: AppState['character'] }
  | { type: 'SET_BUILDING'; building: AppState['building'] }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_IMAGE_SIZE'; imageSize: '2K' | '4K' }
  | { type: 'SET_ASPECT_RATIO'; payload: string }
  | { type: 'GENERATE_START'; templateImage: string; gridConfig?: { cols: number; rows: number; cellLabels: string[]; cellGroups?: CellGroup[]; aspectRatio?: string } }
  | { type: 'GENERATE_COMPLETE'; filledGridImage: string; filledGridMimeType: string; geminiText: string }
  | { type: 'GENERATE_ERROR'; error: string }
  | { type: 'EXTRACTION_COMPLETE'; sprites: ExtractedSprite[] }
  | { type: 'SET_STATUS'; message: string; statusType: AppState['statusType'] }
  | { type: 'CLEAR_STATUS' }
  | { type: 'SET_STEP'; step: WorkflowStep }
  | { type: 'SET_HISTORY_ID'; id: number }
  | { type: 'SET_SOURCE_CONTEXT'; groupId: string | null; contentPresetId: string | null }
  | { type: 'SET_CHARACTER_PRESETS'; presets: CharacterPreset[] }
  | { type: 'LOAD_CHARACTER_PRESET'; preset: CharacterPreset }
  | { type: 'SET_BUILDING_PRESETS'; presets: BuildingPreset[] }
  | { type: 'LOAD_BUILDING_PRESET'; preset: BuildingPreset }
  | { type: 'SET_TERRAIN'; terrain: AppState['terrain'] }
  | { type: 'SET_BACKGROUND'; background: AppState['background'] }
  | { type: 'SET_TERRAIN_PRESETS'; presets: TerrainPreset[] }
  | { type: 'LOAD_TERRAIN_PRESET'; preset: TerrainPreset }
  | { type: 'SET_BACKGROUND_PRESETS'; presets: BackgroundPreset[] }
  | { type: 'LOAD_BACKGROUND_PRESET'; preset: BackgroundPreset }
  | { type: 'SET_GRID_PRESETS'; presets: GridPreset[] }
  | { type: 'SET_ACTIVE_GRID_CONFIG'; gridConfig: AppState['activeGridConfig'] }
  | { type: 'START_RUN'; payload: { contentPresetId: string; spriteType: SpriteType; gridLinks: GridLink[]; imageSize: '2K' | '4K'; groupId?: string } }
  | { type: 'COMPLETE_GRID'; payload: { filledGridImage: string } }
  | { type: 'NEXT_GRID' }
  | { type: 'END_RUN' }
  | { type: 'RESTORE_SESSION'; payload: RestoreSessionPayload }
  | { type: 'RESET' };

export interface RestoreSessionPayload {
  spriteType: SpriteType;
  character?: AppState['character'];
  building?: AppState['building'];
  terrain?: AppState['terrain'];
  background?: AppState['background'];
  activeGridConfig: AppState['activeGridConfig'];
  filledGridImage: string | null;
  filledGridMimeType: string;
  geminiText: string;
  sprites: ExtractedSprite[];
  historyId: number;
  sourceGroupId: string | null;
  sourceContentPresetId: string | null;
}

/** Get the default cell label count for a building grid size */
function gridSizeToCellCount(gridSize: BuildingGridSize): number {
  switch (gridSize) {
    case '3x3': return 9;
    case '2x3': return 6;
    case '2x2': return 4;
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SPRITE_TYPE':
      if (action.spriteType === state.spriteType) return state;
      return {
        ...state,
        spriteType: action.spriteType,
        // Clear shared workflow state to prevent cross-type contamination
        activeGridConfig: null,
        filledGridImage: null,
        templateImage: null,
        sprites: [],
        historyId: null,
        step: 'configure',
      };
    case 'SET_CHARACTER':
      return { ...state, character: action.character };
    case 'SET_BUILDING':
      return { ...state, building: action.building };
    case 'SET_MODEL':
      return { ...state, model: action.model };
    case 'SET_IMAGE_SIZE':
      return { ...state, imageSize: action.imageSize };
    case 'SET_ASPECT_RATIO':
      return { ...state, aspectRatio: action.payload };
    case 'GENERATE_START':
      return {
        ...state,
        step: 'generating',
        templateImage: action.templateImage,
        activeGridConfig: action.gridConfig ?? state.activeGridConfig,
        filledGridImage: null,
        sprites: [],
        error: null,
        geminiText: '',
        status: 'Generating sprites...',
        statusType: 'info',
      };
    case 'GENERATE_COMPLETE':
      return {
        ...state,
        filledGridImage: action.filledGridImage,
        filledGridMimeType: action.filledGridMimeType,
        geminiText: action.geminiText,
        status: 'Grid received! Extracting sprites...',
        statusType: 'success',
      };
    case 'GENERATE_ERROR':
      return {
        ...state,
        step: 'configure',
        run: null,
        error: action.error,
        status: action.error,
        statusType: 'error',
      };
    case 'EXTRACTION_COMPLETE':
      return {
        ...state,
        step: 'review',
        sprites: action.sprites,
        status: `Extracted ${action.sprites.length} sprites`,
        statusType: 'success',
      };
    case 'SET_STATUS':
      return { ...state, status: action.message, statusType: action.statusType };
    case 'CLEAR_STATUS':
      return { ...state, status: '', statusType: 'info' };
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SET_HISTORY_ID':
      return { ...state, historyId: action.id };
    case 'SET_SOURCE_CONTEXT':
      return { ...state, sourceGroupId: action.groupId, sourceContentPresetId: action.contentPresetId };
    case 'SET_CHARACTER_PRESETS':
      return { ...state, characterPresets: action.presets };
    case 'LOAD_CHARACTER_PRESET':
      return {
        ...state,
        activeContentPresetIds: { ...state.activeContentPresetIds, character: action.preset.id },
        character: {
          name: action.preset.name,
          description: action.preset.description,
          equipment: action.preset.equipment,
          colorNotes: action.preset.colorNotes,
          styleNotes: '',
          rowGuidance: action.preset.rowGuidance,
        },
      };
    case 'SET_BUILDING_PRESETS':
      return { ...state, buildingPresets: action.presets };
    case 'LOAD_BUILDING_PRESET': {
      const cellCount = gridSizeToCellCount(action.preset.gridSize);
      const labels = action.preset.cellLabels.slice(0, cellCount);
      while (labels.length < cellCount) labels.push('');
      return {
        ...state,
        activeContentPresetIds: { ...state.activeContentPresetIds, building: action.preset.id },
        building: {
          name: action.preset.name,
          description: action.preset.description,
          details: action.preset.details,
          colorNotes: action.preset.colorNotes,
          styleNotes: '',
          cellGuidance: action.preset.cellGuidance,
          gridSize: action.preset.gridSize,
          cellLabels: labels,
        },
      };
    }
    case 'SET_TERRAIN':
      return { ...state, terrain: action.terrain };
    case 'SET_BACKGROUND':
      return { ...state, background: action.background };
    case 'SET_TERRAIN_PRESETS':
      return { ...state, terrainPresets: action.presets };
    case 'LOAD_TERRAIN_PRESET': {
      const tGrid = TERRAIN_GRIDS[action.preset.gridSize];
      const tLabels = action.preset.tileLabels.slice(0, tGrid?.totalCells ?? 16);
      while (tLabels.length < (tGrid?.totalCells ?? 16)) tLabels.push('');
      return {
        ...state,
        activeContentPresetIds: { ...state.activeContentPresetIds, terrain: action.preset.id },
        terrain: {
          name: action.preset.name,
          description: action.preset.description,
          colorNotes: action.preset.colorNotes,
          styleNotes: '',
          tileGuidance: action.preset.tileGuidance,
          gridSize: action.preset.gridSize,
          cellLabels: tLabels,
        },
      };
    }
    case 'SET_BACKGROUND_PRESETS':
      return { ...state, backgroundPresets: action.presets };
    case 'LOAD_BACKGROUND_PRESET': {
      const bGrid = BACKGROUND_GRIDS[action.preset.gridSize];
      const bLabels = action.preset.layerLabels.slice(0, bGrid?.totalCells ?? 4);
      while (bLabels.length < (bGrid?.totalCells ?? 4)) bLabels.push('');
      return {
        ...state,
        activeContentPresetIds: { ...state.activeContentPresetIds, background: action.preset.id },
        background: {
          name: action.preset.name,
          description: action.preset.description,
          colorNotes: action.preset.colorNotes,
          styleNotes: '',
          layerGuidance: action.preset.layerGuidance,
          bgMode: action.preset.bgMode,
          gridSize: action.preset.gridSize,
          cellLabels: bLabels,
        },
      };
    }
    case 'SET_GRID_PRESETS':
      return { ...state, gridPresets: action.presets };
    case 'SET_ACTIVE_GRID_CONFIG':
      return { ...state, activeGridConfig: action.gridConfig };
    case 'START_RUN':
      return {
        ...state,
        step: 'run-active',
        activeContentPresetIds: { ...state.activeContentPresetIds, [action.payload.spriteType]: action.payload.contentPresetId },
        run: {
          contentPresetId: action.payload.contentPresetId,
          groupId: action.payload.groupId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          spriteType: action.payload.spriteType,
          selectedGridLinks: action.payload.gridLinks,
          currentGridIndex: 0,
          referenceSheet: null,
          imageSize: action.payload.imageSize,
        },
      };
    case 'COMPLETE_GRID': {
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          // Store the first completed grid as the reference sheet
          referenceSheet: state.run.referenceSheet || action.payload.filledGridImage,
        },
      };
    }
    case 'NEXT_GRID': {
      if (!state.run) return state;
      const nextIndex = state.run.currentGridIndex + 1;
      if (nextIndex >= state.run.selectedGridLinks.length) {
        // Run complete
        return { ...state, step: 'configure', run: null };
      }
      return {
        ...state,
        step: 'run-active',
        run: { ...state.run, currentGridIndex: nextIndex },
      };
    }
    case 'END_RUN':
      return { ...state, step: 'configure', run: null };
    case 'RESTORE_SESSION': {
      const p = action.payload;
      return {
        ...state,
        step: 'review',
        spriteType: p.spriteType,
        ...(p.character ? { character: p.character } : {}),
        ...(p.building ? { building: p.building } : {}),
        ...(p.terrain ? { terrain: p.terrain } : {}),
        ...(p.background ? { background: p.background } : {}),
        activeGridConfig: p.activeGridConfig,
        filledGridImage: p.filledGridImage,
        filledGridMimeType: p.filledGridMimeType,
        geminiText: p.geminiText,
        sprites: p.sprites,
        historyId: p.historyId,
        sourceGroupId: p.sourceGroupId,
        sourceContentPresetId: p.sourceContentPresetId,
        status: `Restored ${p.sprites.length} sprites`,
        statusType: 'success',
        error: null,
      };
    }
    case 'RESET':
      return {
        ...initialState,
        characterPresets: state.characterPresets,
        buildingPresets: state.buildingPresets,
        terrainPresets: state.terrainPresets,
        backgroundPresets: state.backgroundPresets,
        gridPresets: state.gridPresets,
        sourceGroupId: null,
        sourceContentPresetId: null,
      };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<React.Dispatch<Action> | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const prevHistoryIdRef = useRef<number | null>(null);

  // Sync historyId changes to the server (moved out of reducer to avoid side effects)
  useEffect(() => {
    const prev = prevHistoryIdRef.current;
    const curr = state.historyId;
    prevHistoryIdRef.current = curr;

    if (curr !== null && curr !== prev) {
      // historyId was set — persist it
      fetch('/api/state/lastHistoryId', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: curr }),
      }).catch((err) => console.error('Failed to sync historyId:', err));
    } else if (curr === null && prev !== null) {
      // historyId was cleared (RESET) — delete it
      fetch('/api/state/lastHistoryId', { method: 'DELETE' }).catch((err) => console.error('Failed to clear historyId:', err));
    }
  }, [state.historyId]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

/** Read only state — re-renders when state changes */
export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState must be used within AppProvider');
  return state;
}

/** Stable dispatch ref — never triggers re-renders */
export function useAppDispatch(): React.Dispatch<Action> {
  const dispatch = useContext(AppDispatchContext);
  if (!dispatch) throw new Error('useAppDispatch must be used within AppProvider');
  return dispatch;
}

/** Backward-compatible hook returning both state and dispatch */
export function useAppContext() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  return { state, dispatch };
}

export type { Action };
