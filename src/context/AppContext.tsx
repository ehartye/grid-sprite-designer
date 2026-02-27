/**
 * Application state context for the grid sprite designer.
 * Manages the full workflow: configure → generate → extract → review → export
 */

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { ExtractedSprite } from '../lib/spriteExtractor';
import { CharacterConfig } from '../lib/promptBuilder';

// ── State ────────────────────────────────────────────────────────────────────

export type WorkflowStep = 'configure' | 'generating' | 'review' | 'preview';

export interface AppState {
  step: WorkflowStep;
  character: CharacterConfig;
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
  /** Chroma key tolerance */
  chromaTolerance: number;

  /** Status message for the UI */
  status: string;
  statusType: 'info' | 'success' | 'error' | 'warning';

  /** Error from last operation */
  error: string | null;

  /** History entry ID if saved */
  historyId: number | null;
}

const initialState: AppState = {
  step: 'configure',
  character: { name: '', description: '', styleNotes: '' },
  model: 'gemini-2.5-flash-image',
  imageSize: '2K',
  templateImage: null,
  filledGridImage: null,
  filledGridMimeType: 'image/png',
  geminiText: '',
  sprites: [],
  chromaTolerance: 80,
  status: '',
  statusType: 'info',
  error: null,
  historyId: null,
};

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CHARACTER'; character: CharacterConfig }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_IMAGE_SIZE'; imageSize: string }
  | { type: 'SET_CHROMA_TOLERANCE'; tolerance: number }
  | { type: 'GENERATE_START'; templateImage: string }
  | { type: 'GENERATE_COMPLETE'; filledGridImage: string; filledGridMimeType: string; geminiText: string }
  | { type: 'GENERATE_ERROR'; error: string }
  | { type: 'EXTRACTION_COMPLETE'; sprites: ExtractedSprite[] }
  | { type: 'SET_STATUS'; message: string; statusType: AppState['statusType'] }
  | { type: 'CLEAR_STATUS' }
  | { type: 'SET_STEP'; step: WorkflowStep }
  | { type: 'SET_HISTORY_ID'; id: number }
  | { type: 'RESET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CHARACTER':
      return { ...state, character: action.character };
    case 'SET_MODEL':
      return { ...state, model: action.model };
    case 'SET_IMAGE_SIZE':
      return { ...state, imageSize: action.imageSize };
    case 'SET_CHROMA_TOLERANCE':
      return { ...state, chromaTolerance: action.tolerance };
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
    case 'RESET':
      return { ...initialState };
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
