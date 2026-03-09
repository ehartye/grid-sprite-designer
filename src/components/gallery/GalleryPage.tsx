/**
 * Gallery page — shows past sprite generations.
 * Fetches from /api/gallery with pagination, search, and type filter.
 * Clicking a card reloads that generation; delete removes it.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAppDispatch, useAppState } from '../../context/AppContext';
import { loadGenerationIntoState } from '../../lib/loadGeneration';
import type { GalleryEntry, GalleryGroup, GalleryResponse } from '../../types/api';

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
  const dispatch = useAppDispatch();
  const state = useAppState();
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

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

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

  const fetchGallery = useCallback(async (p: number, q: string, type: string, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(PAGE_SIZE));
      if (q) params.set('search', q);
      if (type) params.set('spriteType', type);
      const res = await fetch(`/api/gallery?${params}`, { signal });
      const data: GalleryResponse = await res.json();
      if (signal?.aborted) return;
      setEntries(data.entries);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to fetch gallery:', err);
      dispatch({ type: 'SET_STATUS', message: 'Failed to load gallery', statusType: 'warning' });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [dispatch]);

  // Fetch on mount and when filters change
  useEffect(() => {
    const abort = new AbortController();
    fetchGallery(page, search, spriteType, abort.signal);
    return () => { abort.abort(); };
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
      // Confirm before discarding in-progress work
      if (state.step !== 'configure' && !window.confirm('You have work in progress. Load this generation and discard current work?')) {
        return;
      }

      try {
        const res = await fetch(`/api/history/${id}`);
        if (!res.ok) throw new Error('Failed to load generation');
        const data = await res.json();

        // Reset previous state before loading new generation
        dispatch({ type: 'RESET' });

        // Load saved editor settings so extraction uses the saved aaInset/posterizeBits
        let savedSettings: { aaInset?: number; posterizeBits?: number } | null = null;
        try {
          const settingsRes = await fetch(`/api/history/${id}/settings`);
          savedSettings = await settingsRes.json();
        } catch {
          dispatch({ type: 'SET_STATUS', message: 'Failed to load editor settings', statusType: 'warning' });
        }

        await loadGenerationIntoState(data, dispatch, {
          historyId: id,
          editorSettings: savedSettings,
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
    [dispatch, onSwitchToDesigner, state.step],
  );

  const handleDelete = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();

      if (deleteConfirm !== id) {
        setDeleteConfirm(id);
        return;
      }

      try {
        const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          dispatch({
            type: 'SET_STATUS',
            message: `Failed to delete entry (${res.status})`,
            statusType: 'warning',
          });
          return;
        }
        // Refetch current page to keep pagination consistent
        fetchGallery(page, search, spriteType);
      } catch {
        dispatch({
          type: 'SET_STATUS',
          message: 'Failed to delete entry',
          statusType: 'error',
        });
      } finally {
        setDeleteConfirm(null);
      }
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
