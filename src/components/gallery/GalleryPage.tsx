/**
 * Gallery page — shows past sprite generations.
 * Fetches from /api/gallery, displays a card grid, and allows
 * clicking to reload a generation or deleting old entries.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { extractSprites } from '../../lib/spriteExtractor';
import { CONFIG_2K } from '../../lib/templateGenerator';
import { getBuildingGridConfig, getTerrainGridConfig, getBackgroundGridConfig, type BuildingGridSize, type TerrainGridSize, type BackgroundGridSize } from '../../lib/gridConfig';

interface GalleryEntry {
  id: number;
  characterName: string;
  createdAt: string;
  spriteCount: number;
  thumbnailData: string | null;
  thumbnailMime: string | null;
}

interface GalleryPageProps {
  /** Switch to the Designer tab after loading a generation */
  onSwitchToDesigner: () => void;
}

export function GalleryPage({ onSwitchToDesigner }: GalleryPageProps) {
  const { dispatch } = useAppContext();
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery');
      const data: GalleryEntry[] = await res.json();
      setEntries(data);
    } catch {
      console.warn('Failed to fetch gallery');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const handleLoad = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/history/${id}`);
        if (!res.ok) throw new Error('Failed to load generation');
        const data = await res.json();

        // Reset previous state before loading new generation
        dispatch({ type: 'RESET' });

        // Set sprite type first
        const spriteType = data.spriteType || 'character';
        dispatch({ type: 'SET_SPRITE_TYPE', spriteType });

        // Populate config state
        if (spriteType === 'building' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BUILDING',
            building: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              details: '',
              colorNotes: '',
              styleNotes: '',
              cellGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (spriteType === 'terrain' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_TERRAIN',
            terrain: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '',
              styleNotes: '',
              tileGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (spriteType === 'background' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BACKGROUND',
            background: {
              name: data.character?.name || '',
              description: data.character?.description || '',
              colorNotes: '',
              styleNotes: '',
              layerGuidance: '',
              bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (data.character) {
          dispatch({ type: 'SET_CHARACTER', character: data.character });
        }

        const mimeType = data.filledGridMimeType || 'image/png';
        if (data.filledGridImage) {
          dispatch({
            type: 'GENERATE_COMPLETE',
            filledGridImage: data.filledGridImage,
            filledGridMimeType: mimeType,
            geminiText: data.geminiText || '',
          });

          // Build extraction config based on sprite type
          let extractionConfig: Parameters<typeof extractSprites>[2] = {
            headerH: CONFIG_2K.headerH,
            border: CONFIG_2K.border,
            templateCellW: CONFIG_2K.cellW,
            templateCellH: CONFIG_2K.cellH,
          };

          if (spriteType === 'building' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getBuildingGridConfig(data.gridSize as BuildingGridSize, spriteLabels);
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
              gridOverride: {
                cols: gridConfig.cols,
                rows: gridConfig.rows,
                totalCells: gridConfig.totalCells,
                cellLabels: gridConfig.cellLabels,
              },
            };
          } else if (spriteType === 'terrain' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getTerrainGridConfig(data.gridSize as TerrainGridSize, spriteLabels);
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
              gridOverride: {
                cols: gridConfig.cols,
                rows: gridConfig.rows,
                totalCells: gridConfig.totalCells,
                cellLabels: gridConfig.cellLabels,
              },
            };
          } else if (spriteType === 'background' && data.gridSize) {
            const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
            const gridConfig = getBackgroundGridConfig(data.gridSize as BackgroundGridSize, spriteLabels);
            const templateParams = gridConfig.templates['2K'];
            extractionConfig = {
              headerH: templateParams.headerH,
              border: templateParams.border,
              templateCellW: templateParams.cellW,
              templateCellH: templateParams.cellH,
              gridOverride: {
                cols: gridConfig.cols,
                rows: gridConfig.rows,
                totalCells: gridConfig.totalCells,
                cellLabels: gridConfig.cellLabels,
              },
            };
          }

          const sprites = await extractSprites(data.filledGridImage, mimeType, extractionConfig);
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
        } else if (data.sprites && data.sprites.length > 0) {
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites: data.sprites });
        }
        dispatch({ type: 'SET_HISTORY_ID', id });

        onSwitchToDesigner();
      } catch (err) {
        dispatch({
          type: 'SET_STATUS',
          message: `Failed to load generation: ${err instanceof Error ? err.message : String(err)}`,
          statusType: 'error',
        });
      }
    },
    [dispatch, onSwitchToDesigner],
  );

  const handleDelete = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();

      if (deleteConfirm !== id) {
        setDeleteConfirm(id);
        return;
      }

      try {
        await fetch(`/api/history/${id}`, { method: 'DELETE' });
        setEntries((prev) => prev.filter((entry) => entry.id !== id));
      } catch {
        dispatch({
          type: 'SET_STATUS',
          message: 'Failed to delete entry',
          statusType: 'error',
        });
      }
      setDeleteConfirm(null);
    },
    [deleteConfirm, dispatch],
  );

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="gallery-page">
        <h2>Gallery</h2>
        <div className="gallery-empty">Loading...</div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <h2>Gallery</h2>

      {entries.length === 0 ? (
        <div className="gallery-empty">
          No generations yet. Create your first character!
        </div>
      ) : (
        <div className="gallery-grid">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="gallery-card"
              role="button"
              tabIndex={0}
              onClick={() => handleLoad(entry.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleLoad(entry.id);
                }
              }}
            >
              <div className="gallery-card-thumb">
                {entry.thumbnailData && (
                  <img
                    src={`data:${entry.thumbnailMime || 'image/png'};base64,${entry.thumbnailData}`}
                    alt={entry.characterName}
                  />
                )}
              </div>
              <div className="gallery-card-info">
                <div className="gallery-card-name">{entry.characterName}</div>
                <div className="gallery-card-meta">
                  {formatDate(entry.createdAt)} &middot; {entry.spriteCount} sprites
                </div>
              </div>
              <button
                className="gallery-card-delete"
                onClick={(e) => handleDelete(entry.id, e)}
              >
                {deleteConfirm === entry.id ? 'Confirm?' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
