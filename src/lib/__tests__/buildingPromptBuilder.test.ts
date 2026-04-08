import { describe, it, expect } from 'vitest';
import { buildBuildingParts, type BuildingConfig } from '../buildingPromptBuilder';
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

/** Helper: concatenate all text parts from a TypeBuilderResult */
function allText(result: ReturnType<typeof buildBuildingParts>): string {
  return [...result.subject, ...result.instructions]
    .filter(p => p.type === 'text')
    .map(p => (p as any).content)
    .join('\n');
}

describe('buildBuildingParts', () => {
  it('includes building name in uppercase', () => {
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('MEDIEVAL INN');
  });

  it('includes description and details', () => {
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('A cozy two-story stone inn');
    expect(text).toContain('Chimney on the right');
  });

  it('includes total cell count', () => {
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('9');
  });

  it('lists cell labels in the layout', () => {
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('"Day"');
    expect(text).toContain('"Night"');
    expect(text).toContain('"Fire"');
  });

  it('includes gridGuidance overall text when provided', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Custom generic guidance', groups: {}, cells: {} };
    const text = allText(buildBuildingParts(baseBuilding, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('Custom generic guidance');
  });

  it('includes presetGuidance overall text when provided', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Cells show day/night variations', groups: {}, cells: {} };
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('Cells show day/night variations');
  });

  it('includes linkGuidance overall text when provided', () => {
    const linkGuidance: HierarchicalGuidance = { overall: 'Override guidance', groups: {}, cells: {} };
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, linkGuidance, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('Override guidance');
  });

  it('includes chroma key instructions', () => {
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('#FF00FF');
    expect(text).toContain('CHROMA BACKGROUND IS SACRED');
  });

  it('omits details line when empty', () => {
    const building = { ...baseBuilding, details: '' };
    const text = allText(buildBuildingParts(building, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3));
    expect(text).not.toContain('Structural details:');
  });

  it('includes cell-level guidance in output', () => {
    const presetGuidance: HierarchicalGuidance = {
      overall: '',
      groups: {},
      cells: { 'Day': 'Bright sunny day scene' },
    };
    const text = allText(buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels, 3, 3));
    expect(text).toContain('Bright sunny day scene');
  });

  it('includes group-level guidance in output', () => {
    const groups: CellGroup[] = [{ name: 'Lighting', cells: [0, 1, 2] }];
    const gridGuidance: HierarchicalGuidance = {
      overall: '',
      groups: { 'Lighting': 'All lighting variations' },
      cells: {},
    };
    const text = allText(buildBuildingParts(baseBuilding, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, groups, cellLabels, 3, 3));
    expect(text).toContain('All lighting variations');
    expect(text).toContain('GROUP: Lighting');
  });

  it('returns subject and instructions as separate arrays', () => {
    const result = buildBuildingParts(baseBuilding, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels, 3, 3);
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.instructions.length).toBeGreaterThan(0);
  });
});
