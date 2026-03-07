/**
 * Gallery page — shows past sprite generations.
 * Fetches from /api/gallery with pagination, search, and type filter.
 * Clicking a card reloads that generation; delete removes it.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { extractSprites } from '../../lib/spriteExtractor';
import { getBuildingGridConfig, getTerrainGridConfig, getBackgroundGridConfig, type BuildingGridSize, type TerrainGridSize, type BackgroundGridSize } from '../../lib/gridConfig';
import type { EditorSettings } from '../../hooks/useEditorSettings';

interface GalleryEntry {
  id: number;
  contentName: string;
  createdAt: string;
  spriteType: string;
  gridSize: string | null;
  groupId: string | null;
  spriteCount: number;
  thumbnailData: string | null;
  thumbnailMime: string | null;
}

interface GalleryGroup {
  name: string;
  entries: GalleryEntry[];
}

interface GalleryResponse {
  entries: GalleryEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const SPRITE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'character', label: 'Characters' },
  { value: 'building', label: 'Buildings' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'background', label: 'Backgrounds' },
];

const PAGE_SIZE = 24;

interface GalleryPageProps {
  /** Switch to the Designer tab after loading a generation */
  onSwitchToDesigner: () => void;
}

export function GalleryPage({ onSwitchToDesigner }: GalleryPageProps) {
  const { dispatch } = useAppContext();
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [spriteType, setSpriteType] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group entries: prefer explicit groupId, fall back to matching character name
  const grouped = useMemo((): (GalleryEntry | GalleryGroup)[] => {
    const groupMap = new Map<string, GalleryEntry[]>();
    const order: string[] = [];
    const assigned = new Set<number>();

    // First pass: group by explicit groupId
    for (const entry of entries) {
      if (entry.groupId) {
        const key = `gid:${entry.groupId}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
          order.push(key);
        }
        groupMap.get(key)!.push(entry);
        assigned.add(entry.id);
      }
    }

    // Second pass: group remaining by character name
    for (const entry of entries) {
      if (assigned.has(entry.id)) continue;
      const key = `name:${entry.contentName}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        order.push(key);
      }
      groupMap.get(key)!.push(entry);
    }

    const result: (GalleryEntry | GalleryGroup)[] = [];
    for (const key of order) {
      const group = groupMap.get(key)!;
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        result.push({ name: group[0].contentName, entries: group });
      }
    }
    return result;
  }, [entries]);

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const fetchGallery = useCallback(async (p: number, q: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(PAGE_SIZE));
      if (q) params.set('search', q);
      if (type) params.set('spriteType', type);
      const res = await fetch(`/api/gallery?${params}`);
      const data: GalleryResponse = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchGallery(page, search, spriteType);
  }, [page, search, spriteType, fetchGallery]);

  // Debounce search input
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleTypeFilter = useCallback((type: string) => {
    setSpriteType(type);
    setPage(1);
  }, []);

  const handleLoad = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/history/${id}`);
        if (!res.ok) throw new Error('Failed to load generation');
        const data = await res.json();

        // Reset previous state before loading new generation
        dispatch({ type: 'RESET' });

        // Set sprite type first
        const loadedSpriteType = data.spriteType || 'character';
        dispatch({ type: 'SET_SPRITE_TYPE', spriteType: loadedSpriteType });

        // Populate config state
        if (loadedSpriteType === 'building' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BUILDING',
            building: {
              name: data.content?.name || '',
              description: data.content?.description || '',
              details: '',
              colorNotes: '',
              styleNotes: '',
              cellGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (loadedSpriteType === 'terrain' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_TERRAIN',
            terrain: {
              name: data.content?.name || '',
              description: data.content?.description || '',
              colorNotes: '',
              styleNotes: '',
              tileGuidance: '',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (loadedSpriteType === 'background' && data.gridSize) {
          const spriteLabels = data.sprites?.map((s: any) => s.label) || [];
          dispatch({
            type: 'SET_BACKGROUND',
            background: {
              name: data.content?.name || '',
              description: data.content?.description || '',
              colorNotes: '',
              styleNotes: '',
              layerGuidance: '',
              bgMode: data.gridSize.startsWith('1x') ? 'parallax' : 'scene',
              gridSize: data.gridSize,
              cellLabels: spriteLabels,
            },
          });
        } else if (data.content) {
          dispatch({ type: 'SET_CHARACTER', character: data.content });
        }

        // Compute grid dimensions — from gridSize if available, otherwise infer from sprite count
        const allLabels = data.sprites?.map((s: any) => s.label) || [];
        let gridCols: number;
        let gridRows: number;
        if (data.gridSize) {
          const [colStr, rowStr] = (data.gridSize as string).split('x');
          gridCols = parseInt(colStr, 10) || 6;
          gridRows = parseInt(rowStr, 10) || 6;
        } else if (allLabels.length > 0 && allLabels.length !== 36) {
          // Infer grid dimensions from sprite count for legacy entries without gridSize
          const total = allLabels.length;
          gridCols = [8, 6, 5, 4, 3, 2, 1].find(c => total % c === 0 && total / c >= 1) || 6;
          gridRows = Math.ceil(total / gridCols);
        } else {
          gridCols = 6;
          gridRows = 6;
        }

        // Set active grid config for the review view
        dispatch({ type: 'SET_ACTIVE_GRID_CONFIG', gridConfig: { cols: gridCols, rows: gridRows, cellLabels: allLabels, aspectRatio: data.aspectRatio } });

        // Load saved editor settings so extraction uses the saved aaInset/posterizeBits
        let savedSettings: EditorSettings | null = null;
        try {
          const settingsRes = await fetch(`/api/history/${id}/settings`);
          savedSettings = await settingsRes.json();
        } catch { /* no saved settings */ }

        const mimeType = data.filledGridMimeType || 'image/png';
        if (data.filledGridImage) {
          dispatch({
            type: 'GENERATE_COMPLETE',
            filledGridImage: data.filledGridImage,
            filledGridMimeType: mimeType,
            geminiText: data.geminiText || '',
          });

          // Build extraction config — use known grid configs for typed grids, generic override otherwise
          let extractionConfig: Parameters<typeof extractSprites>[2] = {
            ...(savedSettings?.aaInset != null ? { aaInset: savedSettings.aaInset } : {}),
            ...(savedSettings?.posterizeBits != null ? { posterizeBits: savedSettings.posterizeBits } : {}),
          };

          if (loadedSpriteType === 'building' && data.gridSize) {
            const gridConfig = getBuildingGridConfig(data.gridSize as BuildingGridSize, allLabels);
            extractionConfig.gridOverride = {
              cols: gridConfig.cols,
              rows: gridConfig.rows,
              totalCells: gridConfig.totalCells,
              cellLabels: gridConfig.cellLabels,
            };
          } else if (loadedSpriteType === 'terrain' && data.gridSize) {
            const gridConfig = getTerrainGridConfig(data.gridSize as TerrainGridSize, allLabels);
            extractionConfig.gridOverride = {
              cols: gridConfig.cols,
              rows: gridConfig.rows,
              totalCells: gridConfig.totalCells,
              cellLabels: gridConfig.cellLabels,
            };
          } else if (loadedSpriteType === 'background' && data.gridSize) {
            const gridConfig = getBackgroundGridConfig(data.gridSize as BackgroundGridSize, allLabels);
            extractionConfig.gridOverride = {
              cols: gridConfig.cols,
              rows: gridConfig.rows,
              totalCells: gridConfig.totalCells,
              cellLabels: gridConfig.cellLabels,
            };
          } else if (gridCols !== 6 || gridRows !== 6) {
            extractionConfig.gridOverride = {
              cols: gridCols,
              rows: gridRows,
              totalCells: gridCols * gridRows,
              cellLabels: allLabels,
            };
          }

          const sprites = await extractSprites(data.filledGridImage, mimeType, extractionConfig);
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites });
        } else if (data.sprites && data.sprites.length > 0) {
          dispatch({ type: 'EXTRACTION_COMPLETE', sprites: data.sprites });
        }
        dispatch({ type: 'SET_HISTORY_ID', id });
        dispatch({
          type: 'SET_SOURCE_CONTEXT',
          groupId: data.groupId || null,
          contentPresetId: data.contentPresetId || null,
        });

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
        // Refetch current page to keep pagination consistent
        fetchGallery(page, search, spriteType);
      } catch {
        dispatch({
          type: 'SET_STATUS',
          message: 'Failed to delete entry',
          statusType: 'error',
        });
      }
      setDeleteConfirm(null);
    },
    [deleteConfirm, dispatch, fetchGallery, page, search, spriteType],
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

  const typeLabel = (type: string) => {
    const match = SPRITE_TYPES.find(t => t.value === type);
    return match ? match.label.replace(/s$/, '') : type;
  };

  return (
    <div className="gallery-page">
      <h2>Gallery</h2>

      {/* Search & Filter Bar */}
      <div className="gallery-toolbar">
        <input
          type="text"
          className="gallery-search"
          placeholder="Search by name..."
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
        <div className="gallery-filters">
          {SPRITE_TYPES.map((t) => (
            <button
              key={t.value}
              className={`gallery-filter-btn ${spriteType === t.value ? 'active' : ''}`}
              onClick={() => handleTypeFilter(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="gallery-empty">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="gallery-empty">
          {search || spriteType
            ? 'No matching generations found.'
            : 'No generations yet. Create your first character!'}
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {grouped.map((item) => {
              if ('entries' in item) {
                // Multi-sheet group
                const group = item as GalleryGroup;
                const isExpanded = expandedGroups.has(group.name);
                const primary = group.entries[0];
                return (
                  <React.Fragment key={`group-${group.name}-${primary.id}`}>
                    <div
                      className={`gallery-card gallery-card-group ${isExpanded ? 'expanded' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleGroup(group.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleGroup(group.name);
                        }
                      }}
                    >
                      <div className="gallery-card-thumb gallery-slideshow">
                        {group.entries.map((e, i) => (
                          e.thumbnailData && (
                            <img
                              key={e.id}
                              className="gallery-slideshow-img"
                              style={{
                                animationDuration: `${group.entries.length * 4}s`,
                                animationDelay: `${i * 4}s`,
                              }}
                              src={`data:${e.thumbnailMime || 'image/png'};base64,${e.thumbnailData}`}
                              alt={e.contentName}
                            />
                          )
                        ))}
                      </div>
                      <div className="gallery-card-info">
                        <div className="gallery-card-name">{group.name}</div>
                        <div className="gallery-card-meta">
                          <span className="gallery-group-badge">{group.entries.length} sheets</span>
                          {' '}&middot;{' '}{formatDate(primary.createdAt)}
                        </div>
                      </div>
                      <div className="gallery-group-expand">
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </div>
                    </div>
                    {isExpanded && group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="gallery-card gallery-card-child"
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
                              alt={entry.contentName}
                            />
                          )}
                        </div>
                        <div className="gallery-card-info">
                          <div className="gallery-card-name">
                            {entry.gridSize || typeLabel(entry.spriteType)}
                          </div>
                          <div className="gallery-card-meta">
                            <span className="gallery-type-badge">{typeLabel(entry.spriteType)}</span>
                            {' '}&middot;{' '}{entry.spriteCount} sprites
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
                  </React.Fragment>
                );
              } else {
                // Single entry
                const entry = item as GalleryEntry;
                return (
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
                          alt={entry.contentName}
                        />
                      )}
                    </div>
                    <div className="gallery-card-info">
                      <div className="gallery-card-name">{entry.contentName}</div>
                      <div className="gallery-card-meta">
                        <span className="gallery-type-badge">{typeLabel(entry.spriteType)}</span>
                        {' '}&middot;{' '}{formatDate(entry.createdAt)} &middot; {entry.spriteCount} sprites
                      </div>
                    </div>
                    <button
                      className="gallery-card-delete"
                      onClick={(e) => handleDelete(entry.id, e)}
                    >
                      {deleteConfirm === entry.id ? 'Confirm?' : 'Delete'}
                    </button>
                  </div>
                );
              }
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="gallery-pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                First
              </button>
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Prev
              </button>
              <span className="gallery-page-info">
                Page {page} of {totalPages} ({total} total)
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
              <button
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Last
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
