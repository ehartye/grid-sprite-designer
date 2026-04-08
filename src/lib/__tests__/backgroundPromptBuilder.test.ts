import { describe, it, expect } from 'vitest';
import { buildBackgroundParts, type BackgroundConfig } from '../backgroundPromptBuilder';
import { EMPTY_GUIDANCE } from '../promptBuilderBase';
import type { HierarchicalGuidance, CellGroup } from '../../context/AppContext';

const baseParallax: BackgroundConfig = {
  name: 'Sunset Mountains',
  description: 'Layered mountain landscape at sunset',
  colorNotes: 'Warm oranges, purples, deep blues',
  styleNotes: '',
  bgMode: 'parallax',
};

const baseScene: BackgroundConfig = {
  name: 'Village Square',
  description: 'A bustling medieval village square',
  colorNotes: 'Warm earth tones',
  styleNotes: '',
  bgMode: 'scene',
};

const parallaxLabels = ['Sky', 'Mountains', 'Trees', 'Ground'];
const sceneLabels = ['Day', 'Night', 'Dawn', 'Dusk'];
const cellGroups: CellGroup[] = [];

/** Helper: concatenate all text parts from a TypeBuilderResult */
function allText(result: ReturnType<typeof buildBackgroundParts>): string {
  return [...result.subject, ...result.instructions]
    .filter(p => p.type === 'text')
    .map(p => (p as any).content)
    .join('\n');
}

describe('buildBackgroundParts - parallax mode', () => {
  it('includes background name in uppercase', () => {
    const text = allText(buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('SUNSET MOUNTAINS');
  });

  it('mentions parallax scrolling', () => {
    const text = allText(buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('parallax scrolling background');
  });

  it('includes parallax-specific design rules', () => {
    const text = allText(buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('PARALLAX LAYER DESIGN');
    expect(text).toContain('tile HORIZONTALLY');
  });

  it('includes total cell count', () => {
    const text = allText(buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('4');
  });
});

describe('buildBackgroundParts - scene mode', () => {
  it('mentions scene variant', () => {
    const text = allText(buildBackgroundParts(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2));
    expect(text).toContain('scene variant of VILLAGE SQUARE');
  });

  it('includes scene-specific design rules', () => {
    const text = allText(buildBackgroundParts(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2));
    expect(text).toContain('SCENE VARIATION DESIGN');
    expect(text).toContain('Same composition');
  });

  it('lists cell labels', () => {
    const text = allText(buildBackgroundParts(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2));
    expect(text).toContain('"Day"');
    expect(text).toContain('"Dusk"');
  });
});

describe('buildBackgroundParts - guidance', () => {
  it('includes presetGuidance overall as fallback guidance', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Sky at top, ground at bottom', groups: {}, cells: {} };
    const text = allText(buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('Sky at top, ground at bottom');
  });

  it('includes linkGuidance overall when provided', () => {
    const linkGuidance: HierarchicalGuidance = { overall: 'Custom override', groups: {}, cells: {} };
    const text = allText(buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, linkGuidance, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('Custom override');
  });

  it('combines gridGuidance and linkGuidance in output', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Generic notes', groups: {}, cells: {} };
    const linkGuidance: HierarchicalGuidance = { overall: 'Specific notes', groups: {}, cells: {} };
    const text = allText(buildBackgroundParts(baseParallax, gridGuidance, linkGuidance, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4));
    expect(text).toContain('Generic notes');
    expect(text).toContain('Specific notes');
  });

  it('returns subject and instructions as separate arrays', () => {
    const result = buildBackgroundParts(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.instructions.length).toBeGreaterThan(0);
  });
});
