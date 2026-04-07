/**
 * TypeScript interfaces for API response shapes.
 * Used to replace `any` types throughout the codebase.
 */


/** Response from GET /api/history/:id */
export interface HistoryResponse {
  id: number;
  spriteType?: string;
  gridSize?: string;
  model?: string | null;
  imageSize?: string | null;
  thinkingLevel?: string | null;
  filledGridImage?: string;
  filledGridMimeType?: string;
  geminiText?: string;
  aspectRatio?: string;
  groupId?: string | null;
  contentPresetId?: string | null;
  feedbackJson?: string | null;
  parentHistoryId?: number | null;
  generationVersion?: number;
  content?: {
    name?: string;
    description?: string;
    equipment?: string;
    colorNotes?: string;
    styleNotes?: string;
  };
  sprites?: Array<{
    label: string;
    cellIndex: number;
    imageData: string;
    mimeType: string;
    width?: number;
    height?: number;
  }>;
}

/** Response from POST /api/history */
export interface HistorySaveResponse {
  id: number;
}

/** Response from GET /api/state/:key */
export interface StateResponse {
  value: string | null;
}

/**
 * Content preset as returned by the API and used in prompt building.
 * Superset of all sprite-type preset fields.
 */
export interface ContentPreset {
  id?: string;
  name: string;
  description: string;
  genre?: string;
  /** Character fields */
  equipment?: string;
  colorNotes?: string;
  /** Building fields */
  details?: string;
  cellLabels?: string[];
  /** Terrain fields */
  tileLabels?: string[];
  /** Background fields */
  layerLabels?: string[];
  bgMode?: 'parallax' | 'scene';
  /** Common */
  gridSize?: string;
  styleNotes?: string;
  /** Hierarchical guidance fields (replaces rowGuidance/cellGuidance/tileGuidance/layerGuidance) */
  overallGuidance?: string;
  groupGuidance?: Record<string, string>;
  cellGuidance?: Record<string, string>;
}

/** A single entry in the gallery listing */
export interface GalleryEntry {
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

/** A group of gallery entries sharing the same name or groupId */
export interface GalleryGroup {
  name: string;
  entries: GalleryEntry[];
}

/** Response from GET /api/gallery */
export interface GalleryResponse {
  entries: GalleryEntry[];
  total: number;
  page: number;
  totalPages: number;
}

/** Grid config override for extraction */
export interface GridOverride {
  cols: number;
  rows: number;
  totalCells: number;
  cellLabels: string[];
}
