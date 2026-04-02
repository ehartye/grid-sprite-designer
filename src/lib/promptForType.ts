/**
 * Shared prompt building for any sprite type.
 * Extracted from useRunWorkflow to be reused by the add-sheet flow.
 */

import { SpriteType, GridLink } from '../context/AppContext';
import { buildGridFillPrompt, buildGridFillPromptWithReference, type CharacterConfig } from './promptBuilder';
import { buildBuildingPrompt } from './buildingPromptBuilder';
import { buildTerrainPrompt } from './terrainPromptBuilder';
import { buildBackgroundPrompt } from './backgroundPromptBuilder';
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
  gridConfig: GridConfig,
  isSubsequentGrid: boolean,
  pixelizeSize?: number,
): string {
  let prompt: string;

  switch (spriteType) {
    case 'character': {
      // TODO Task 5-7: use full hierarchical guidance from gridLink and contentPreset
      const charConfig: CharacterConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        equipment: contentPreset.equipment || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        rowGuidance: contentPreset.overallGuidance || '',
      };
      if (isSubsequentGrid) {
        prompt = buildGridFillPromptWithReference(
          charConfig,
          gridLink.gridGuidance?.overall || '',
          gridLink.linkGuidance?.overall || '',
          gridLink.cellLabels,
        );
      } else {
        prompt = buildGridFillPrompt(
          charConfig,
          gridLink.gridGuidance?.overall,
          gridLink.linkGuidance?.overall,
          gridLink.cellLabels,
        );
      }
      break;
    }
    case 'building': {
      // TODO Task 5-7: use full hierarchical guidance from gridLink and contentPreset
      const buildingConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        details: contentPreset.details || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        cellGuidance: contentPreset.overallGuidance || '',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildBuildingPrompt(
        buildingConfig,
        gridConfig,
        gridLink.gridGuidance?.overall,
        gridLink.linkGuidance?.overall,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    case 'terrain': {
      // TODO Task 5-7: use full hierarchical guidance from gridLink and contentPreset
      const terrainConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        tileGuidance: contentPreset.overallGuidance || '',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildTerrainPrompt(
        terrainConfig,
        gridConfig,
        gridLink.gridGuidance?.overall,
        gridLink.linkGuidance?.overall,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt.replace('The attached image is', 'IMAGE 2 is');
      break;
    }
    case 'background': {
      // TODO Task 5-7: use full hierarchical guidance from gridLink and contentPreset
      const bgConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        layerGuidance: contentPreset.overallGuidance || '',
        bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildBackgroundPrompt(
        bgConfig,
        gridConfig,
        gridLink.gridGuidance?.overall,
        gridLink.linkGuidance?.overall,
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
