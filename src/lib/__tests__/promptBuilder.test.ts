import { describe, it, expect } from 'vitest';
import { buildGridFillPrompt, buildGridFillPromptWithReference, type CharacterConfig } from '../promptBuilder';

const baseCharacter: CharacterConfig = {
  name: 'Test Hero',
  description: 'A brave warrior with a sword',
  equipment: 'Iron Sword, Shield',
  colorNotes: 'Blue armor, red cape',
  styleNotes: 'Heroic stance',
  rowGuidance: 'Row 0 is walking poses',
};

describe('buildGridFillPrompt', () => {
  it('includes the character name in uppercase', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('TEST HERO');
  });

  it('includes character description and equipment', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('A brave warrior with a sword');
    expect(prompt).toContain('Iron Sword, Shield');
  });

  it('includes color notes and style notes', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('Blue armor, red cape');
    expect(prompt).toContain('Heroic stance');
  });

  it('defaults to 6x6 grid (36 cells)', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('36 cells');
  });

  it('uses custom cell labels to determine grid size', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const prompt = buildGridFillPrompt(baseCharacter, undefined, undefined, labels);
    expect(prompt).toContain('9 cells');
  });

  it('uses gridGenericGuidance when provided', () => {
    const prompt = buildGridFillPrompt(baseCharacter, 'Custom grid guidance here');
    expect(prompt).toContain('Custom grid guidance here');
  });

  it('falls back to built-in guidance when no gridGenericGuidance', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('ROW 0');
    expect(prompt).toContain('Walk Down');
  });

  it('uses guidanceOverride over character.rowGuidance', () => {
    const prompt = buildGridFillPrompt(baseCharacter, undefined, 'Override guidance');
    expect(prompt).toContain('Override guidance');
  });

  it('falls back to character.rowGuidance when no guidanceOverride', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('Row 0 is walking poses');
  });

  it('omits equipment line when empty', () => {
    const char = { ...baseCharacter, equipment: '' };
    const prompt = buildGridFillPrompt(char);
    expect(prompt).not.toContain('Equipment:');
  });

  it('omits color notes line when empty', () => {
    const char = { ...baseCharacter, colorNotes: '' };
    const prompt = buildGridFillPrompt(char);
    expect(prompt).not.toContain('Color palette:');
  });

  it('includes magenta chroma key instructions', () => {
    const prompt = buildGridFillPrompt(baseCharacter);
    expect(prompt).toContain('#FF00FF');
    expect(prompt).toContain('magenta');
  });
});

describe('buildGridFillPromptWithReference', () => {
  it('prepends reference image instructions', () => {
    const prompt = buildGridFillPromptWithReference(
      baseCharacter, 'generic', 'override', ['A', 'B', 'C', 'D'],
    );
    expect(prompt).toContain('IMAGE 1');
    expect(prompt).toContain('IMAGE 2');
    expect(prompt).toContain('visual reference');
  });

  it('includes the base prompt content after the prefix', () => {
    const prompt = buildGridFillPromptWithReference(
      baseCharacter, 'generic', 'override', ['A', 'B', 'C'],
    );
    expect(prompt).toContain('TEST HERO');
    expect(prompt).toContain('A brave warrior with a sword');
  });

  it('uses custom cell labels for grid dimensions', () => {
    const labels = ['A', 'B', 'C'];
    const prompt = buildGridFillPromptWithReference(baseCharacter, '', '', labels);
    expect(prompt).toContain('3 cells');
  });
});
