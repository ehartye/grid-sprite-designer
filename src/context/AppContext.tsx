/**
 * Application state context for the grid sprite designer.
 * Manages the full workflow: configure → generate → extract → review → export
 */

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { ExtractedSprite } from '../lib/spriteExtractor';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CharacterPreset {
  id: string;
  name: string;
  genre: string;
  description: string;
  equipment: string;
  colorNotes: string;
  rowGuidance: string;
}

// ── State ────────────────────────────────────────────────────────────────────

export type WorkflowStep = 'configure' | 'generating' | 'review' | 'preview';

export interface AppState {
  step: WorkflowStep;
  character: {
    name: string;
    description: string;
    equipment: string;
    colorNotes: string;
    styleNotes: string;
    rowGuidance: string;
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
}

const initialState: AppState = {
  step: 'configure',
  character: {
    name: '',
    description: '',
    equipment: '',
    colorNotes: '',
    styleNotes: '',
    rowGuidance: '',
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
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CHARACTER'; character: AppState['character'] }
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
  | { type: 'RESET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CHARACTER':
      return { ...state, character: action.character };
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
      fetch('/api/state/lastHistoryId', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: action.id }),
      }).catch(() => {});
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
    case 'RESET':
      fetch('/api/state/lastHistoryId', { method: 'DELETE' }).catch(() => {});
      return { ...initialState, presets: state.presets };
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
