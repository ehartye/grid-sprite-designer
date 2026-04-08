import { useReducer } from 'react';

/** RGB color as a 3-element tuple [red, green, blue], each 0-255. */
export type RGB = [number, number, number];

export interface PostProcessingState {
  pixelize: { enabled: boolean; size: number };
  outline: { enabled: boolean; outDepth: number; inDepth: number; color: RGB };
  alphaSnap: { enabled: boolean; threshold: number };
  struckColors: RGB[];
  strikeTolerance: number;
  showRareColors: boolean;
  aaInset: number;
  eraserBrushW: number;
  eraserBrushH: number;
}

export type PostProcessingAction =
  | { type: 'SET_PIXELIZE'; enabled: boolean; size?: number }
  | { type: 'SET_PIXELIZE_SIZE'; size: number }
  | { type: 'SET_OUTLINE'; enabled: boolean }
  | { type: 'SET_OUTLINE_DEPTH'; outDepth?: number; inDepth?: number }
  | { type: 'SET_OUTLINE_COLOR'; color: RGB }
  | { type: 'SET_ALPHA_SNAP'; enabled: boolean; threshold?: number }
  | { type: 'SET_ALPHA_SNAP_THRESHOLD'; threshold: number }
  | { type: 'SET_STRIKE_TOLERANCE'; tolerance: number }
  | { type: 'STRIKE_COLOR'; color: RGB }
  | { type: 'UNSTRIKE_COLOR'; color: RGB }
  | { type: 'CLEAR_STRUCK_COLORS' }
  | { type: 'SET_SHOW_RARE_COLORS'; show: boolean }
  | { type: 'SET_AA_INSET'; inset: number }
  | { type: 'SET_ERASER_BRUSH'; w?: number; h?: number }
  | { type: 'RESTORE'; settings: Partial<{
      pixelizeEnabled: boolean; pixelizeSize: number;
      outlineEnabled: boolean; outlineOutDepth: number; outlineInDepth: number; outlineColor: RGB;
      alphaSnapEnabled: boolean; alphaSnapThreshold: number;
      strikeTolerance: number; struckColors: RGB[];
      aaInset: number;
    }> }
  | { type: 'RESET' };

const INITIAL: PostProcessingState = {
  pixelize: { enabled: false, size: 32 },
  outline: { enabled: false, outDepth: 1, inDepth: 0, color: [0, 0, 0] },
  alphaSnap: { enabled: false, threshold: 128 },
  struckColors: [],
  strikeTolerance: 10,
  showRareColors: false,
  aaInset: 3,
  eraserBrushW: 1,
  eraserBrushH: 1,
};

function colorEquals(a: RGB, b: RGB): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function reducer(state: PostProcessingState, action: PostProcessingAction): PostProcessingState {
  switch (action.type) {
    case 'SET_PIXELIZE':
      return { ...state, pixelize: { enabled: action.enabled, size: action.size ?? state.pixelize.size } };
    case 'SET_PIXELIZE_SIZE':
      return { ...state, pixelize: { ...state.pixelize, size: action.size } };
    case 'SET_OUTLINE':
      return { ...state, outline: { ...state.outline, enabled: action.enabled } };
    case 'SET_OUTLINE_DEPTH':
      return { ...state, outline: { ...state.outline, outDepth: action.outDepth ?? state.outline.outDepth, inDepth: action.inDepth ?? state.outline.inDepth } };
    case 'SET_OUTLINE_COLOR':
      return { ...state, outline: { ...state.outline, color: action.color } };
    case 'SET_ALPHA_SNAP':
      return { ...state, alphaSnap: { enabled: action.enabled, threshold: action.threshold ?? state.alphaSnap.threshold } };
    case 'SET_ALPHA_SNAP_THRESHOLD':
      return { ...state, alphaSnap: { ...state.alphaSnap, threshold: action.threshold } };
    case 'SET_STRIKE_TOLERANCE':
      return { ...state, strikeTolerance: action.tolerance };
    case 'STRIKE_COLOR':
      if (state.struckColors.some(c => colorEquals(c, action.color))) return state;
      return { ...state, struckColors: [...state.struckColors, action.color] };
    case 'UNSTRIKE_COLOR':
      return { ...state, struckColors: state.struckColors.filter(c => !colorEquals(c, action.color)) };
    case 'CLEAR_STRUCK_COLORS':
      return { ...state, struckColors: [] };
    case 'SET_SHOW_RARE_COLORS':
      return { ...state, showRareColors: action.show };
    case 'SET_AA_INSET':
      return { ...state, aaInset: action.inset };
    case 'SET_ERASER_BRUSH':
      return { ...state, eraserBrushW: action.w ?? state.eraserBrushW, eraserBrushH: action.h ?? state.eraserBrushH };
    case 'RESTORE': {
      const s = action.settings;
      return {
        ...state,
        pixelize: { enabled: s.pixelizeEnabled ?? state.pixelize.enabled, size: s.pixelizeSize ?? state.pixelize.size },
        outline: {
          enabled: s.outlineEnabled ?? state.outline.enabled,
          outDepth: s.outlineOutDepth ?? state.outline.outDepth,
          inDepth: s.outlineInDepth ?? state.outline.inDepth,
          color: s.outlineColor ?? state.outline.color,
        },
        alphaSnap: { enabled: s.alphaSnapEnabled ?? state.alphaSnap.enabled, threshold: s.alphaSnapThreshold ?? state.alphaSnap.threshold },
        strikeTolerance: s.strikeTolerance ?? state.strikeTolerance,
        struckColors: s.struckColors ?? state.struckColors,
        aaInset: s.aaInset ?? state.aaInset,
      };
    }
    case 'RESET':
      return INITIAL;
    default:
      return state;
  }
}

export function usePostProcessingState() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  return { state, dispatch };
}
