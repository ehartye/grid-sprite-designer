/**
 * Gallery page — shows past sprite generations.
 * Fetches from /api/gallery, displays a card grid, and allows
 * clicking to reload a generation or deleting old entries.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { extractSprites } from '../../lib/spriteExtractor';
import { CONFIG_2K } from '../../lib/templateGenerator';

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

        // Populate state with loaded generation
        if (data.character) {
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

          // Re-extract sprites from the grid using current edge-detection pipeline
          const sprites = await extractSprites(
            data.filledGridImage,
            mimeType,
            {
              headerH: CONFIG_2K.headerH,
              border: CONFIG_2K.border,
              templateCellW: CONFIG_2K.cellW,
              templateCellH: CONFIG_2K.cellH,
            },
          );
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
        } else if (data.sprites && data.sprites.length > 0) {
          // Fallback: use stored sprites if no grid image available
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites: data.sprites });
        }
        dispatch({ type: 'SET_HISTORY_ID', id });

        onSwitchToDesigner();
      } catch (err) {
        console.error('Failed to load generation:', err);
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
        console.warn('Failed to delete entry');
      }
      setDeleteConfirm(null);
    },
    [deleteConfirm],
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
              onClick={() => handleLoad(entry.id)}
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
