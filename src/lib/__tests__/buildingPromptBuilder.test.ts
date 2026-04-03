import { describe, it, expect } from 'vitest';
import { buildBuildingPrompt, type BuildingConfig } from '../buildingPromptBuilder';
import { EMPTY_GUIDANCE } from '../promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../../context/AppContext';

const baseBuilding: BuildingConfig = {
  name: 'Medieval Inn',
  description: 'A cozy two-story stone inn with a thatched roof',
  details: 'Chimney on the right, wooden sign out front',
  colorNotes: 'Warm stone grey, dark brown wood',
  styleNotes: 'Rustic medieval village',
};

const cellLabels = ['Day', 'Night', 'Dawn', 'Damaged', 'Ruined', 'Snow', 'Rain', 'Fog', 'Fire'];
const cellGroups: CellGroup[] = [];

describe('buildBuildingPrompt', () => {
  it('includes building name in uppercase', () => {
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('MEDIEVAL INN');
  });

  it('includes description and details', () => {
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('A cozy two-story stone inn');
    expect(prompt).toContain('Chimney on the right');
  });

  it('includes grid dimensions', () => {
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('3\u00d73');
    expect(prompt).toContain('9 cells');
  });

  it('lists cell labels in the layout', () => {
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('"Day"');
    expect(prompt).toContain('"Night"');
    expect(prompt).toContain('"Fire"');
  });

  it('includes gridGuidance overall text when provided', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Custom generic guidance', groups: {}, cells: {} };
    const prompt = buildBuildingPrompt(baseBuilding, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('Custom generic guidance');
  });

  it('includes presetGuidance overall text when provided', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Cells show day/night variations', groups: {}, cells: {} };
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('Cells show day/night variations');
  });

  it('includes linkGuidance overall text when provided', () => {
    const linkGuidance: HierarchicalGuidance = { overall: 'Override guidance', groups: {}, cells: {} };
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, linkGuidance, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('Override guidance');
  });

  it('includes chroma key instructions', () => {
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('#FF00FF');
    expect(prompt).toContain('CHROMA BACKGROUND IS SACRED');
  });

  it('omits details line when empty', () => {
    const building = { ...baseBuilding, details: '' };
    const prompt = buildBuildingPrompt(building, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(prompt).not.toContain('Structural details:');
  });

  it('includes cell-level guidance in output', () => {
    const presetGuidance: HierarchicalGuidance = {
      overall: '',
      groups: {},
      cells: { 'Day': 'Bright sunny day scene' },
    };
    const prompt = buildBuildingPrompt(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 3, 3);
    expect(prompt).toContain('Bright sunny day scene');
  });

  it('includes group-level guidance in output', () => {
    const groups: CellGroup[] = [{ name: 'Lighting', cells: [0, 1, 2] }];
    const gridGuidance: HierarchicalGuidance = {
      overall: '',
      groups: { 'Lighting': 'All lighting variations' },
      cells: {},
    };
    const prompt = buildBuildingPrompt(baseBuilding, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, groups, cellLabels, 3, 3);
    expect(prompt).toContain('All lighting variations');
    expect(prompt).toContain('GROUP: Lighting');
  });
});
