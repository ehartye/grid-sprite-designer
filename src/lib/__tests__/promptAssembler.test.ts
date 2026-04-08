import { describe, it, expect } from 'vitest';
import { assemblePrompt, assembleEditPrompt } from '../promptForType';

function makeGridLink(overrides: Record<string, any> = {}) {
  return {
    id: 1, gridPresetId: 1,
    gridGuidance: { overall: '', groups: {}, cells: {} },
    linkGuidance: { overall: '', groups: {}, cells: {} },
    sortOrder: 0, gridName: 'Test', gridSize: '3x3',
    cols: 3, rows: 3,
    cellLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    cellGroups: [], aspectRatio: '1:1', tileShape: 'square' as const,
    ...overrides,
  };
}

describe('assemblePrompt', () => {
  const preset = { name: 'Knight', description: 'A noble knight', equipment: 'Sword', colorNotes: '' };

  it('returns StructuredPrompt with correct part types', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false,
    });
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.parts.every(p => p.type === 'text' || p.type === 'image')).toBe(true);
    expect(result.meta.spriteType).toBe('character');
    expect(result.meta.hasReference).toBe(false);
  });

  it('includes reference image part when isSubsequentGrid with referenceImage', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: true,
      referenceImage: { data: 'base64ref', mimeType: 'image/png' },
    });
    const imageParts = result.parts.filter(p => p.type === 'image');
    expect(imageParts.length).toBe(1); // reference image only; template added by pipeline
    expect(result.meta.hasReference).toBe(true);
  });

  it('includes template image part when provided', () => {
    const result = assemblePrompt({
      spriteType: 'building', contentPreset: { name: 'Castle', description: 'A castle', details: '' },
      gridLink: makeGridLink(), isSubsequentGrid: false,
      templateImage: { data: 'base64tmpl', mimeType: 'image/png' },
    });
    const imageParts = result.parts.filter(p => p.type === 'image');
    expect(imageParts.length).toBe(1); // template
  });

  it('section breakdown includes expected sections', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false,
    });
    const names = result.meta.sectionBreakdown.map(s => s.name);
    expect(names).toContain('role');
    expect(names).toContain('subject');
    expect(names).toContain('instructions');
  });

  it('includes pixelize guidance when pixelizeSize provided', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false, pixelizeSize: 32,
    });
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('TARGET PIXEL SIZE: 32');
  });

  it('includes feedback preamble when feedbackState provided', () => {
    const result = assemblePrompt({
      spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: true,
      referenceImage: { data: 'ref', mimeType: 'image/png' },
      feedbackState: { global: 'Make it better', groups: {}, cells: {} },
    });
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('REGENERATION CONTEXT');
    expect(textContent).toContain('Make it better');
    expect(result.meta.hasFeedback).toBe(true);
  });

  it('builds terrain prompt with correct content', () => {
    const result = assemblePrompt({
      spriteType: 'terrain',
      contentPreset: { name: 'Grass', description: 'Lush green grass' },
      gridLink: makeGridLink(), isSubsequentGrid: false,
    });
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('GRASS');
    expect(textContent).toContain('Lush green grass');
    expect(result.meta.spriteType).toBe('terrain');
  });

  it('builds background prompt with correct mode', () => {
    const result = assemblePrompt({
      spriteType: 'background',
      contentPreset: { name: 'Forest', description: 'Dense forest', bgMode: 'parallax' },
      gridLink: makeGridLink({ bgMode: 'parallax' }), isSubsequentGrid: false,
    });
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('FOREST');
    expect(textContent).toContain('PARALLAX LAYER DESIGN');
  });

  it('throws for unknown sprite type', () => {
    expect(() => assemblePrompt({
      spriteType: 'unknown' as any, contentPreset: preset, gridLink: makeGridLink(),
      isSubsequentGrid: false,
    })).toThrow('Unknown sprite type: unknown');
  });
});

describe('assembleEditPrompt', () => {
  it('returns StructuredPrompt with edit structure', () => {
    const result = assembleEditPrompt({
      feedbackState: { global: 'Fix the arms', groups: {}, cells: {} },
      cellLabels: ['A', 'B', 'C'],
      cellGroups: [],
      cols: 3,
      sourceImage: { data: 'base64src', mimeType: 'image/png' },
    });
    expect(result.meta.spriteType).toBe('edit');
    expect(result.meta.hasFeedback).toBe(true);
    expect(result.parts.some(p => p.type === 'image')).toBe(true);
    const textContent = result.parts.filter(p => p.type === 'text').map(p => (p as any).content).join('\n');
    expect(textContent).toContain('editing an existing sprite sheet');
  });

  it('section breakdown has role, source-image, and edit-instructions', () => {
    const result = assembleEditPrompt({
      feedbackState: { global: '', groups: {}, cells: {} },
      cellLabels: ['A'],
      cellGroups: [],
      cols: 1,
      sourceImage: { data: 'src', mimeType: 'image/png' },
    });
    const names = result.meta.sectionBreakdown.map(s => s.name);
    expect(names).toEqual(['role', 'source-image', 'edit-instructions']);
  });
});
