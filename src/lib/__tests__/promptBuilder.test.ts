import { describe, it, expect } from 'vitest';
import { buildCharacterParts, type CharacterConfig } from '../promptBuilder';
import { getPixelizeGuidance, EMPTY_GUIDANCE } from '../promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../../context/AppContext';

const baseCharacter: CharacterConfig = {
  name: 'Test Hero',
  description: 'A brave warrior with a sword',
  equipment: 'Iron Sword, Shield',
  colorNotes: 'Blue armor, red cape',
  styleNotes: 'Heroic stance',
};

const cellLabels6x6 = Array.from({ length: 36 }, (_, i) => `Cell ${i}`);
const cellGroups: CellGroup[] = [];

/** Helper: concatenate all text parts from a TypeBuilderResult */
function allText(result: ReturnType<typeof buildCharacterParts>): string {
  return [...result.subject, ...result.instructions]
    .filter(p => p.type === 'text')
    .map(p => (p as any).content)
    .join('\n');
}

describe('buildCharacterParts', () => {
  it('includes the character name in uppercase', () => {
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('TEST HERO');
  });

  it('includes character description and equipment', () => {
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('A brave warrior with a sword');
    expect(text).toContain('Iron Sword, Shield');
  });

  it('includes color notes and style notes', () => {
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('Blue armor, red cape');
    expect(text).toContain('Heroic stance');
  });

  it('includes custom cell labels in the layout', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, labels, 3, 3));
    expect(text).toContain('"A"');
    expect(text).toContain('"C"');
  });

  it('includes overall guidance text when provided', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Custom grid guidance here', groups: {}, cells: {} };
    const text = allText(buildCharacterParts(baseCharacter, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('Custom grid guidance here');
  });

  it('includes preset overall guidance when provided', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Preset guidance text', groups: {}, cells: {} };
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('Preset guidance text');
  });

  it('omits equipment line when empty', () => {
    const char = { ...baseCharacter, equipment: '' };
    const text = allText(buildCharacterParts(char, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).not.toContain('Equipment:');
  });

  it('omits color notes line when empty', () => {
    const char = { ...baseCharacter, colorNotes: '' };
    const text = allText(buildCharacterParts(char, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).not.toContain('Color palette:');
  });

  it('includes magenta chroma key instructions', () => {
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('#FF00FF');
    expect(text).toContain('magenta');
  });

  it('includes the key tenets', () => {
    const text = allText(buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6));
    expect(text).toContain('Visibility of Body');
    expect(text).toContain('Continuity of Devices');
    expect(text).toContain('Continuity of Movement');
  });

  it('returns subject and instructions as separate arrays', () => {
    const result = buildCharacterParts(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.instructions.length).toBeGreaterThan(0);
    expect(result.subject[0].type).toBe('text');
    expect(result.instructions[0].type).toBe('text');
  });
});

describe('getPixelizeGuidance', () => {
  it('returns guidance for each valid target size', () => {
    const sizes = [16, 32, 48, 64, 128];
    const expectedSubstrings: Record<number, string> = {
      16: 'TARGET PIXEL SIZE: 16×16',
      32: 'TARGET PIXEL SIZE: 32×32',
      48: 'TARGET PIXEL SIZE: 48×48',
      64: 'TARGET PIXEL SIZE: 64×64',
      128: 'TARGET PIXEL SIZE: 128×128',
    };
    for (const size of sizes) {
      const guidance = getPixelizeGuidance(size);
      expect(guidance).toContain(expectedSubstrings[size]);
      expect(guidance.length).toBeGreaterThan(0);
    }
  });

  it('returns empty string when size is undefined', () => {
    expect(getPixelizeGuidance(undefined)).toBe('');
  });

  it('returns empty string for unknown sizes', () => {
    expect(getPixelizeGuidance(99)).toBe('');
    expect(getPixelizeGuidance(0)).toBe('');
    expect(getPixelizeGuidance(256)).toBe('');
  });
});
