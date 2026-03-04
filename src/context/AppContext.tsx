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

export type WorkflowStep = 'configure' | 'generating' | 'review' | 'preview';

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
  imageSize: string;

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

  /** Character presets */
  presets: CharacterPreset[];

  /** Building presets */
  buildingPresets: BuildingPreset[];

  /** Terrain presets */
  terrainPresets: TerrainPreset[];

  /** Background presets */
  backgroundPresets: BackgroundPreset[];

  /** Grid presets */
  gridPresets: GridPreset[];
}

const initialState: AppState = {
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
  templateImage: null,
  filledGridImage: null,
  filledGridMimeType: 'image/png',
  geminiText: '',
  sprites: [],
  status: '',
  statusType: 'info',
  error: null,
  historyId: null,
  presets: [],
  buildingPresets: [],
  terrainPresets: [],
  backgroundPresets: [],
  gridPresets: [],
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SPRITE_TYPE'; spriteType: SpriteType }
  | { type: 'SET_CHARACTER'; character: AppState['character'] }
  | { type: 'SET_BUILDING'; building: AppState['building'] }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_IMAGE_SIZE'; imageSize: string }
  | { type: 'GENERATE_START'; templateImage: string }
  | { type: 'GENERATE_COMPLETE'; filledGridImage: string; filledGridMimeType: string; geminiText: string }
  | { type: 'GENERATE_ERROR'; error: string }
  | { type: 'EXTRACTION_COMPLETE'; sprites: ExtractedSprite[] }
  | { type: 'SET_STATUS'; message: string; statusType: AppState['statusType'] }
  | { type: 'CLEAR_STATUS' }
  | { type: 'SET_STEP'; step: WorkflowStep }
  | { type: 'SET_HISTORY_ID'; id: number }
  | { type: 'SET_PRESETS'; presets: CharacterPreset[] }
  | { type: 'LOAD_PRESET'; preset: CharacterPreset }
  | { type: 'SET_BUILDING_PRESETS'; presets: BuildingPreset[] }
  | { type: 'LOAD_BUILDING_PRESET'; preset: BuildingPreset }
  | { type: 'SET_TERRAIN'; terrain: AppState['terrain'] }
  | { type: 'SET_BACKGROUND'; background: AppState['background'] }
  | { type: 'SET_TERRAIN_PRESETS'; presets: TerrainPreset[] }
  | { type: 'LOAD_TERRAIN_PRESET'; preset: TerrainPreset }
  | { type: 'SET_BACKGROUND_PRESETS'; presets: BackgroundPreset[] }
  | { type: 'LOAD_BACKGROUND_PRESET'; preset: BackgroundPreset }
  | { type: 'SET_GRID_PRESETS'; payload: GridPreset[] }
  | { type: 'RESET' };

/** Get the default cell label count for a building grid size */
function gridSizeToCellCount(gridSize: BuildingGridSize): number {
  switch (gridSize) {
    case '3x3': return 9;
    case '2x3': return 6;
    case '2x2': return 4;
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SPRITE_TYPE':
      return { ...state, spriteType: action.spriteType };
    case 'SET_CHARACTER':
      return { ...state, character: action.character };
    case 'SET_BUILDING':
      return { ...state, building: action.building };
    case 'SET_MODEL':
      return { ...state, model: action.model };
    case 'SET_IMAGE_SIZE':
      return { ...state, imageSize: action.imageSize };
    case 'GENERATE_START':
      return {
        ...state,
        step: 'generating',
        templateImage: action.templateImage,
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
    case 'SET_PRESETS':
      return { ...state, presets: action.presets };
    case 'LOAD_PRESET':
      return {
        ...state,
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
      return { ...state, gridPresets: action.payload };
    case 'RESET':
      return {
        ...initialState,
        presets: state.presets,
        buildingPresets: state.buildingPresets,
        terrainPresets: state.terrainPresets,
        backgroundPresets: state.backgroundPresets,
        gridPresets: state.gridPresets,
      };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

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
      }).catch(() => {});
    } else if (curr === null && prev !== null) {
      // historyId was cleared (RESET) — delete it
      fetch('/api/state/lastHistoryId', { method: 'DELETE' }).catch(() => {});
    }
  }, [state.historyId]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export type { Action };
