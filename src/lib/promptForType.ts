/**
 * Shared prompt building for any sprite type.
 * Extracted from useRunWorkflow to be reused by the add-sheet flow.
 */

import { SpriteType, GridLink, HierarchicalGuidance } from '../context/AppContext';
import { buildGridFillPrompt, buildGridFillPromptWithReference, type CharacterConfig } from './promptBuilder';
import { buildBuildingPrompt, type BuildingConfig } from './buildingPromptBuilder';
import { buildTerrainPrompt, type TerrainConfig } from './terrainPromptBuilder';
import { buildBackgroundPrompt, type BackgroundConfig } from './backgroundPromptBuilder';
import { type GridConfig } from './gridConfig';
import { REFERENCE_PREFIX, getPixelizeGuidance } from './promptBuilderBase';
import type { ContentPreset } from '../types/api';

export { REFERENCE_PREFIX };

/** Fetch a single content preset by type and id */
export async function fetchContentPreset(spriteType: SpriteType, presetId: string): Promise<ContentPreset> {
  const res = await fetch(`/api/presets/${spriteType}/${presetId}`);
  if (!res.ok) throw new Error(`Content preset "${presetId}" not found`);
  return res.json();
}

/** Build prompt for any sprite type */
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: ContentPreset,
  gridLink: GridLink,
  _gridConfig: GridConfig,
  isSubsequentGrid: boolean,
  pixelizeSize?: number,
  cellAnnotations?: Record<string, string>,
  groupAnnotations?: Record<string, string>,
): string {
  const { gridGuidance, linkGuidance, cellGroups, cellLabels, cols, rows } = gridLink;

  const presetGuidance: HierarchicalGuidance = {
    overall: contentPreset.overallGuidance || '',
    groups: contentPreset.groupGuidance || {},
    cells: contentPreset.cellGuidance || {},
  };

  let prompt: string;

  switch (spriteType) {
    case 'character': {
      const charConfig: CharacterConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        equipment: contentPreset.equipment || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
      };
      if (isSubsequentGrid) {
        prompt = buildGridFillPromptWithReference(
          charConfig, gridGuidance, linkGuidance, presetGuidance,
          cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
        );
      } else {
        prompt = buildGridFillPrompt(
          charConfig, gridGuidance, linkGuidance, presetGuidance,
          cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
        );
      }
      break;
    }
    case 'building': {
      const buildingConfig: BuildingConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        details: contentPreset.details || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
      };
      prompt = buildBuildingPrompt(
        buildingConfig, gridGuidance, linkGuidance, presetGuidance,
        cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    case 'terrain': {
      const terrainConfig: TerrainConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
      };
      prompt = buildTerrainPrompt(
        terrainConfig, gridGuidance, linkGuidance, presetGuidance,
        cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    case 'background': {
      const bgConfig: BackgroundConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax',
      };
      prompt = buildBackgroundPrompt(
        bgConfig, gridGuidance, linkGuidance, presetGuidance,
        cellGroups, cellLabels, cols, rows, cellAnnotations, groupAnnotations,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    default:
      throw new Error(`Unknown sprite type: ${spriteType}`);
  }

  const g = getPixelizeGuidance(pixelizeSize);
  if (g) prompt += '\n\n' + g;

  return prompt;
}
