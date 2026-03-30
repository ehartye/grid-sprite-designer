/**
 * Compute a square-cell grid layout for a given grid size and resolution.
 * Tries all Gemini-supported aspect ratios and picks the one that maximizes
 * cell size (best use of canvas space). Ties broken by tightest fit.
 */

export const GEMINI_ASPECT_RATIOS: [number, number][] = [
  [1, 1], [2, 3], [3, 2], [3, 4], [4, 3],
  [4, 5], [5, 4], [9, 16], [16, 9], [21, 9],
];

interface ResolutionParams {
  base: number;
  border: number;
  headerH: number;
  fontSize: number;
}

const RESOLUTION_PARAMS: Record<string, ResolutionParams> = {
  '2K': { base: 2048, border: 2, headerH: 14, fontSize: 9 },
  '4K': { base: 4096, border: 4, headerH: 22, fontSize: 14 },
};

export interface SquareLayout {
  cellSize: number;
  headerH: number;
  border: number;
  fontSize: number;
  canvasW: number;
  canvasH: number;
  aspectRatio: string;
}

export function computeSquareLayout(
  cols: number,
  rows: number,
  resolution: '2K' | '4K',
): SquareLayout {
  const params = RESOLUTION_PARAMS[resolution];
  const { base, border, headerH, fontSize } = params;

  let bestCellSize = 0;
  let bestCanvasW = base;
  let bestCanvasH = base;
  let bestRatio = '1:1';
  let bestArea = Infinity;

  for (const [arW, arH] of GEMINI_ASPECT_RATIOS) {
    const arFactor = arW / arH;

    // Canvas dimensions: wider dimension = base
    let canvasW: number;
    let canvasH: number;
    if (arFactor >= 1) {
      canvasW = base;
      canvasH = Math.round(base / arFactor);
    } else {
      canvasW = Math.round(base * arFactor);
      canvasH = base;
    }

    const maxFromWidth = Math.floor((canvasW - (cols + 1) * border) / cols);
    const maxFromHeight = Math.floor((canvasH - (rows + 1) * border) / rows) - headerH;
    const cellSize = Math.min(maxFromWidth, maxFromHeight);

    if (cellSize <= 0) continue;

    const area = canvasW * canvasH;

    if (cellSize > bestCellSize || (cellSize === bestCellSize && area < bestArea)) {
      bestCellSize = cellSize;
      bestCanvasW = canvasW;
      bestCanvasH = canvasH;
      bestRatio = `${arW}:${arH}`;
      bestArea = area;
    }
  }

  return {
    cellSize: bestCellSize,
    headerH,
    border,
    fontSize,
    canvasW: bestCanvasW,
    canvasH: bestCanvasH,
    aspectRatio: bestRatio,
  };
}
