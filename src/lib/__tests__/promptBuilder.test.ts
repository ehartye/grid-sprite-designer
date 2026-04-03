import { describe, it, expect } from 'vitest';
import { buildGridFillPrompt, buildGridFillPromptWithReference, type CharacterConfig } from '../promptBuilder';
import { getPixelizeGuidance } from '../promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../../context/AppContext';

const EMPTY_GUIDANCE: HierarchicalGuidance = { overall: '', groups: {}, cells: {} };

const baseCharacter: CharacterConfig = {
  name: 'Test Hero',
  description: 'A brave warrior with a sword',
  equipment: 'Iron Sword, Shield',
  colorNotes: 'Blue armor, red cape',
  styleNotes: 'Heroic stance',
};

const cellLabels6x6 = Array.from({ length: 36 }, (_, i) => `Cell ${i}`);
const cellGroups: CellGroup[] = [];

describe('buildGridFillPrompt', () => {
  it('includes the character name in uppercase', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('TEST HERO');
  });

  it('includes character description and equipment', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('A brave warrior with a sword');
    expect(prompt).toContain('Iron Sword, Shield');
  });

  it('includes color notes and style notes', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('Blue armor, red cape');
    expect(prompt).toContain('Heroic stance');
  });

  it('includes the greeting opening', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('Greetings, expert sprite designer');
  });

  it('includes custom cell labels in the layout', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, labels, 3, 3);
    expect(prompt).toContain('"A"');
    expect(prompt).toContain('"C"');
  });

  it('includes overall guidance text when provided', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Custom grid guidance here', groups: {}, cells: {} };
    const prompt = buildGridFillPrompt(baseCharacter, gridGuidance, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('Custom grid guidance here');
  });

  it('includes preset overall guidance when provided', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Preset guidance text', groups: {}, cells: {} };
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('Preset guidance text');
  });

  it('omits equipment line when empty', () => {
    const char = { ...baseCharacter, equipment: '' };
    const prompt = buildGridFillPrompt(char, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).not.toContain('Equipment:');
  });

  it('omits color notes line when empty', () => {
    const char = { ...baseCharacter, colorNotes: '' };
    const prompt = buildGridFillPrompt(char, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).not.toContain('Color palette:');
  });

  it('includes magenta chroma key instructions', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('#FF00FF');
    expect(prompt).toContain('magenta');
  });

  it('includes the three tenets', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('Visibility of Body');
    expect(prompt).toContain('Continuity of Devices');
    expect(prompt).toContain('Continuity of Movement');
  });

  it('includes ## The Subject and ## The Layout headers', () => {
    const prompt = buildGridFillPrompt(baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, cellLabels6x6, 6, 6);
    expect(prompt).toContain('## The Subject');
    expect(prompt).toContain('## The Layout');
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

describe('buildGridFillPromptWithReference', () => {
  it('prepends reference image instructions', () => {
    const labels = ['A', 'B', 'C', 'D'];
    const prompt = buildGridFillPromptWithReference(
      baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, labels, 2, 2,
    );
    expect(prompt).toContain('IMAGE 1');
    expect(prompt).toContain('IMAGE 2');
    expect(prompt).toContain('You are given two images');
  });

  it('includes the base prompt content after the prefix', () => {
    const labels = ['A', 'B', 'C'];
    const prompt = buildGridFillPromptWithReference(
      baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, labels, 3, 1,
    );
    expect(prompt).toContain('TEST HERO');
    expect(prompt).toContain('A brave warrior with a sword');
  });

  it('replaces attachment text with IMAGE 2 reference', () => {
    const labels = ['A', 'B', 'C'];
    const prompt = buildGridFillPromptWithReference(
      baseCharacter, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, labels, 3, 1,
    );
    expect(prompt).toContain('IMAGE 2 is your chroma-keyed');
    expect(prompt).not.toContain('template is attached');
  });
});
