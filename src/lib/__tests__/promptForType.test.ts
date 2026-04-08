import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '../promptForType';

// Minimal GridLink-like object for testing
function makeGridLink(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    gridPresetId: 1,
    gridGuidance: { overall: 'Generic guidance text', groups: {}, cells: {} },
    linkGuidance: { overall: '', groups: {}, cells: {} },
    sortOrder: 0,
    gridName: 'Test Grid',
    gridSize: '3x3',
    cols: 3,
    rows: 3,
    cellLabels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
    cellGroups: [],
    aspectRatio: '1:1',
    tileShape: 'square' as const,
    ...overrides,
  };
}

/** Helper: extract all text content from a StructuredPrompt */
function allText(prompt: ReturnType<typeof assemblePrompt>): string {
  return prompt.parts
    .filter(p => p.type === 'text')
    .map(p => (p as any).content)
    .join('\n');
}

describe('assemblePrompt', () => {
  it('assembles character prompt with name in uppercase', () => {
    const preset = { name: 'Knight', description: 'A noble knight', equipment: 'Sword', colorNotes: '', overallGuidance: '' };
    const result = assemblePrompt({ spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: false });
    expect(allText(result)).toContain('KNIGHT');
    expect(allText(result)).toContain('A noble knight');
  });

  it('includes reference section for subsequent character grids', () => {
    const preset = { name: 'Knight', description: 'A noble knight', equipment: '', colorNotes: '', overallGuidance: '' };
    const ref = { data: 'base64data', mimeType: 'image/png' };
    const result = assemblePrompt({ spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: true, referenceImage: ref });
    expect(result.meta.hasReference).toBe(true);
    const hasImagePart = result.parts.some(p => p.type === 'image');
    expect(hasImagePart).toBe(true);
  });

  it('assembles building prompt', () => {
    const preset = { name: 'Castle', description: 'A grand castle', details: 'Towers', colorNotes: '', overallGuidance: '' };
    const result = assemblePrompt({ spriteType: 'building', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: false });
    expect(allText(result)).toContain('CASTLE');
    expect(allText(result)).toContain('A grand castle');
  });

  it('assembles terrain prompt', () => {
    const preset = { name: 'Desert', description: 'Sandy desert', colorNotes: 'Warm yellows', overallGuidance: '' };
    const result = assemblePrompt({ spriteType: 'terrain', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: false });
    expect(allText(result)).toContain('DESERT');
    expect(allText(result)).toContain('Sandy desert');
  });

  it('assembles background prompt in parallax mode', () => {
    const preset = { name: 'Forest', description: 'Dense forest', colorNotes: '', overallGuidance: '', bgMode: 'parallax' as const };
    const link = makeGridLink({ bgMode: 'parallax' });
    const result = assemblePrompt({ spriteType: 'background', contentPreset: preset, gridLink: link, isSubsequentGrid: false });
    expect(allText(result)).toContain('FOREST');
    expect(allText(result)).toContain('parallax');
  });

  it('assembles background prompt in scene mode', () => {
    const preset = { name: 'Village', description: 'A village', colorNotes: '', overallGuidance: '', bgMode: 'scene' as const };
    const link = makeGridLink({ bgMode: 'scene' });
    const result = assemblePrompt({ spriteType: 'background', contentPreset: preset, gridLink: link, isSubsequentGrid: false });
    expect(allText(result)).toContain('VILLAGE');
    expect(allText(result)).toContain('SCENE VARIATION');
  });

  it('throws for unknown sprite type', () => {
    const preset = { name: 'X', description: 'X' };
    expect(() => assemblePrompt({ spriteType: 'unknown' as any, contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: false }))
      .toThrow('Unknown sprite type: unknown');
  });

  it('includes reference image for subsequent terrain grids', () => {
    const preset = { name: 'Snow', description: 'Snowy terrain', colorNotes: '', overallGuidance: '' };
    const ref = { data: 'base64data', mimeType: 'image/png' };
    const result = assemblePrompt({ spriteType: 'terrain', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: true, referenceImage: ref });
    expect(result.meta.hasReference).toBe(true);
  });

  it('populates meta.spriteType correctly', () => {
    const preset = { name: 'Knight', description: 'A knight', equipment: '', colorNotes: '', overallGuidance: '' };
    const result = assemblePrompt({ spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: false });
    expect(result.meta.spriteType).toBe('character');
  });

  it('includes sectionBreakdown in meta', () => {
    const preset = { name: 'Knight', description: 'A knight', equipment: '', colorNotes: '', overallGuidance: '' };
    const result = assemblePrompt({ spriteType: 'character', contentPreset: preset, gridLink: makeGridLink(), isSubsequentGrid: false });
    const sectionNames = result.meta.sectionBreakdown.map(s => s.name);
    expect(sectionNames).toContain('role');
    expect(sectionNames).toContain('subject');
    expect(sectionNames).toContain('instructions');
    expect(sectionNames).toContain('canvas');
  });
});
