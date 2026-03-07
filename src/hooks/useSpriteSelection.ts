import { useState, useCallback, useMemo } from 'react';
import type { ExtractedSprite } from '../lib/spriteExtractor';

interface UseSpriteSelectionOptions {
  spriteCount: number;
  cellCount: number;
}

export interface SpriteSelectionState {
  swapSource: number | null;
  displayOrder: number[];
  mirroredCells: Set<number>;
  thumbnailCell: number | null;
  zoomSpriteIndex: number | null;
  erasedPixels: Map<number, Set<string>>;
  erasedKey: number;
  isOrderModified: boolean;
  handleCellClick: (cellIndex: number) => void;
  handleMirrorToggle: (cellIndex: number) => void;
  handleZoomClick: (cellIndex: number) => void;
  handleErasePixel: (x: number, y: number) => void;
  setThumbnailCell: (v: number | null) => void;
  setZoomSpriteIndex: (v: number | null) => void;
  setDisplayOrder: React.Dispatch<React.SetStateAction<number[]>>;
  setSwapSource: (v: number | null) => void;
  setMirroredCells: React.Dispatch<React.SetStateAction<Set<number>>>;
  resetSelection: () => void;
  restoreSelection: (opts: {
    mirroredCells?: number[];
    cellOrder?: number[];
    thumbnailCell?: number | null;
  }) => void;
  getDisplaySprites: (processedSprites: ExtractedSprite[]) => ExtractedSprite[];
}

export function useSpriteSelection({ spriteCount, cellCount }: UseSpriteSelectionOptions): SpriteSelectionState {
  const defaultOrder = () => Array.from({ length: spriteCount || cellCount }, (_, i) => i);

  const [swapSource, setSwapSource] = useState<number | null>(null);
  const [displayOrder, setDisplayOrder] = useState<number[]>(defaultOrder);
  const [mirroredCells, setMirroredCells] = useState<Set<number>>(new Set());
  const [thumbnailCell, setThumbnailCell] = useState<number | null>(null);
  const [zoomSpriteIndex, setZoomSpriteIndex] = useState<number | null>(null);
  const [erasedPixels, setErasedPixels] = useState<Map<number, Set<string>>>(new Map());

  const erasedKey = useMemo(() => {
    let total = 0;
    for (const s of erasedPixels.values()) total += s.size;
    return total;
  }, [erasedPixels]);

  const isOrderModified = useMemo(
    () => displayOrder.some((v, i) => v !== i),
    [displayOrder],
  );

  const handleCellClick = useCallback((cellIndex: number) => {
    if (swapSource === null) {
      setSwapSource(cellIndex);
    } else if (swapSource === cellIndex) {
      setSwapSource(null);
    } else {
      setDisplayOrder((prev) => {
        const next = [...prev];
        const temp = next[swapSource];
        next[swapSource] = next[cellIndex];
        next[cellIndex] = temp;
        return next;
      });
      setSwapSource(null);
    }
  }, [swapSource]);

  const handleMirrorToggle = useCallback((cellIndex: number) => {
    setMirroredCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellIndex)) next.delete(cellIndex);
      else next.add(cellIndex);
      return next;
    });
  }, []);

  const handleZoomClick = useCallback((cellIndex: number) => {
    setZoomSpriteIndex(cellIndex);
  }, []);

  const handleErasePixel = useCallback((x: number, y: number) => {
    if (zoomSpriteIndex === null) return;
    const srcIdx = displayOrder[zoomSpriteIndex];
    setErasedPixels((prev) => {
      const next = new Map(prev);
      const existing = next.get(srcIdx);
      const copy = existing ? new Set(existing) : new Set<string>();
      copy.add(`${x},${y}`);
      next.set(srcIdx, copy);
      return next;
    });
  }, [zoomSpriteIndex, displayOrder]);

  const resetSelection = useCallback(() => {
    setDisplayOrder(Array.from({ length: spriteCount || cellCount }, (_, i) => i));
    setSwapSource(null);
    setMirroredCells(new Set());
    setThumbnailCell(null);
  }, [spriteCount, cellCount]);

  const restoreSelection = useCallback((opts: {
    mirroredCells?: number[];
    cellOrder?: number[];
    thumbnailCell?: number | null;
  }) => {
    if (opts.mirroredCells && opts.mirroredCells.length > 0) setMirroredCells(new Set(opts.mirroredCells));
    if (opts.cellOrder && opts.cellOrder.length > 0) setDisplayOrder(opts.cellOrder);
    if (opts.thumbnailCell != null) setThumbnailCell(opts.thumbnailCell);
  }, []);

  const getDisplaySprites = useCallback((processedSprites: ExtractedSprite[]) => {
    const byCell = new Map<number, ExtractedSprite>();
    for (const s of processedSprites) byCell.set(s.cellIndex, s);

    return displayOrder.map((srcIdx, displayIdx) => {
      const sprite = byCell.get(srcIdx);
      if (!sprite) return null;
      return { ...sprite, cellIndex: displayIdx };
    }).filter(Boolean) as ExtractedSprite[];
  }, [displayOrder]);

  return {
    swapSource,
    displayOrder,
    mirroredCells,
    thumbnailCell,
    zoomSpriteIndex,
    erasedPixels,
    erasedKey,
    isOrderModified,
    handleCellClick,
    handleMirrorToggle,
    handleZoomClick,
    handleErasePixel,
    setThumbnailCell,
    setZoomSpriteIndex,
    setDisplayOrder,
    setSwapSource,
    setMirroredCells,
    resetSelection,
    restoreSelection,
    getDisplaySprites,
  };
}
