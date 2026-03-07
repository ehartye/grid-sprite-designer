import { describe, it, expect } from 'vitest';
import { buildBuildingPrompt, type BuildingConfig } from '../buildingPromptBuilder';
import type { GridConfig } from '../gridConfig';

const baseBuilding: BuildingConfig = {
  name: 'Medieval Inn',
  description: 'A cozy two-story stone inn with a thatched roof',
  details: 'Chimney on the right, wooden sign out front',
  colorNotes: 'Warm stone grey, dark brown wood',
  styleNotes: 'Rustic medieval village',
  cellGuidance: 'Cells show day/night variations',
};

const grid3x3: GridConfig = {
  id: 'building-3x3',
  label: 'Building 3x3',
  cols: 3,
  rows: 3,
  totalCells: 9,
  cellLabels: ['Day', 'Night', 'Dawn', 'Damaged', 'Ruined', 'Snow', 'Rain', 'Fog', 'Fire'],
  templates: {
    '2K': { cellW: 680, cellH: 680, headerH: 22, border: 2, fontSize: 14 },
    '4K': { cellW: 1360, cellH: 1360, headerH: 36, border: 4, fontSize: 22 },
  },
};

describe('buildBuildingPrompt', () => {
  it('includes building name in uppercase', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3);
    expect(prompt).toContain('MEDIEVAL INN');
  });

  it('includes description and details', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3);
    expect(prompt).toContain('A cozy two-story stone inn');
    expect(prompt).toContain('Chimney on the right');
  });

  it('includes grid dimensions', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3);
    expect(prompt).toContain('3\u00d73');
    expect(prompt).toContain('9 cells');
  });

  it('lists cell labels in the layout', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3);
    expect(prompt).toContain('"Day"');
    expect(prompt).toContain('"Night"');
    expect(prompt).toContain('"Fire"');
  });

  it('uses generic cell labels when cellLabels are shorter than totalCells', () => {
    const shortGrid: GridConfig = { ...grid3x3, cellLabels: ['A', 'B'] };
    const prompt = buildBuildingPrompt(baseBuilding, shortGrid);
    expect(prompt).toContain('"A"');
    expect(prompt).toContain('"B"');
    expect(prompt).toContain('"Cell 0,2"'); // fallback label
  });

  it('uses gridGenericGuidance when provided', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3, 'Custom generic guidance');
    expect(prompt).toContain('Custom generic guidance');
  });

  it('falls back to building.cellGuidance when no gridGenericGuidance or override', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3);
    expect(prompt).toContain('Cells show day/night variations');
  });

  it('uses guidanceOverride over building.cellGuidance', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3, undefined, 'Override guidance');
    expect(prompt).toContain('Override guidance');
  });

  it('includes chroma key instructions', () => {
    const prompt = buildBuildingPrompt(baseBuilding, grid3x3);
    expect(prompt).toContain('#FF00FF');
    expect(prompt).toContain('CHROMA BACKGROUND IS SACRED');
  });

  it('omits details line when empty', () => {
    const building = { ...baseBuilding, details: '' };
    const prompt = buildBuildingPrompt(building, grid3x3);
    expect(prompt).not.toContain('Structural details:');
  });
});
