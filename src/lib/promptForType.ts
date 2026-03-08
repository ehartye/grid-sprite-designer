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

export const REFERENCE_PREFIX = `\
You are given two images.
IMAGE 1 is a previously completed sprite sheet for this character — use it as
your visual reference to maintain consistent proportions, color palette, art
style, and character identity.
IMAGE 2 is a blank template grid — fill each labeled cell according to the
guidance below.

`;

/** Fetch a single content preset by type and id */
export async function fetchContentPreset(spriteType: SpriteType, presetId: string): Promise<any> {
  const type = spriteType === 'character' ? 'character' : spriteType;
  const res = await fetch(`/api/presets/${type}/${presetId}`);
  if (!res.ok) throw new Error(`Content preset "${presetId}" not found`);
  return res.json();
}

/** Build prompt for any sprite type */
export function buildPromptForType(
  spriteType: SpriteType,
  contentPreset: any,
  gridLink: GridLink,
  gridConfig: GridConfig,
  isSubsequentGrid: boolean,
): string {
  let prompt: string;

  switch (spriteType) {
    case 'character': {
      const charConfig: CharacterConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        equipment: contentPreset.equipment || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        rowGuidance: contentPreset.rowGuidance || '',
      };
      if (isSubsequentGrid) {
        prompt = buildGridFillPromptWithReference(
          charConfig,
          gridLink.genericGuidance || '',
          gridLink.guidanceOverride || '',
          gridLink.cellLabels,
        );
      } else {
        prompt = buildGridFillPrompt(
          charConfig,
          gridLink.genericGuidance,
          gridLink.guidanceOverride,
          gridLink.cellLabels,
        );
      }
      break;
    }
    case 'building': {
      const buildingConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        details: contentPreset.details || '',
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        cellGuidance: contentPreset.cellGuidance || '',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildBuildingPrompt(
        buildingConfig,
        gridConfig,
        gridLink.genericGuidance,
        gridLink.guidanceOverride,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt;
      break;
    }
    case 'terrain': {
      const terrainConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        tileGuidance: contentPreset.tileGuidance || '',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildTerrainPrompt(
        terrainConfig,
        gridConfig,
        gridLink.genericGuidance,
        gridLink.guidanceOverride,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt;
      break;
    }
    case 'background': {
      const bgConfig = {
        name: contentPreset.name,
        description: contentPreset.description,
        colorNotes: contentPreset.colorNotes || '',
        styleNotes: '',
        layerGuidance: contentPreset.layerGuidance || '',
        bgMode: contentPreset.bgMode || (gridLink.bgMode as 'parallax' | 'scene') || 'parallax',
        gridSize: gridLink.gridSize,
        cellLabels: gridLink.cellLabels,
      };
      prompt = buildBackgroundPrompt(
        bgConfig,
        gridConfig,
        gridLink.genericGuidance,
        gridLink.guidanceOverride,
      );
      if (isSubsequentGrid) prompt = REFERENCE_PREFIX + prompt;
      break;
    }
    default:
      throw new Error(`Unknown sprite type: ${spriteType}`);
  }

  return prompt;
}
