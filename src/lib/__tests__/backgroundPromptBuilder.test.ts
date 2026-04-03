import { describe, it, expect } from 'vitest';
import { buildBackgroundPrompt, type BackgroundConfig } from '../backgroundPromptBuilder';
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

describe('buildBackgroundPrompt - parallax mode', () => {
  it('includes background name in uppercase', () => {
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('SUNSET MOUNTAINS');
  });

  it('mentions parallax scrolling', () => {
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('parallax scrolling background');
  });

  it('includes parallax-specific design rules', () => {
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('PARALLAX LAYER DESIGN');
    expect(prompt).toContain('tile HORIZONTALLY');
  });

  it('labels header with "layer"', () => {
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('labeling the layer');
  });

  it('includes grid dimensions', () => {
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('1\u00d74');
    expect(prompt).toContain('4 cells');
  });
});

describe('buildBackgroundPrompt - scene mode', () => {
  it('mentions scene variant', () => {
    const prompt = buildBackgroundPrompt(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2);
    expect(prompt).toContain('scene variant of VILLAGE SQUARE');
  });

  it('includes scene-specific design rules', () => {
    const prompt = buildBackgroundPrompt(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2);
    expect(prompt).toContain('SCENE VARIATION DESIGN');
    expect(prompt).toContain('Same composition');
  });

  it('labels header with "scene"', () => {
    const prompt = buildBackgroundPrompt(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2);
    expect(prompt).toContain('labeling the scene');
  });

  it('lists cell labels', () => {
    const prompt = buildBackgroundPrompt(baseScene, EMPTY_GUIDANCE, EMPTY_GUIDANCE, EMPTY_GUIDANCE, cellGroups, sceneLabels, 2, 2);
    expect(prompt).toContain('"Day"');
    expect(prompt).toContain('"Dusk"');
  });
});

describe('buildBackgroundPrompt - guidance', () => {
  it('includes presetGuidance overall as fallback guidance', () => {
    const presetGuidance: HierarchicalGuidance = { overall: 'Sky at top, ground at bottom', groups: {}, cells: {} };
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, EMPTY_GUIDANCE, presetGuidance, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('Sky at top, ground at bottom');
  });

  it('includes linkGuidance overall when provided', () => {
    const linkGuidance: HierarchicalGuidance = { overall: 'Custom override', groups: {}, cells: {} };
    const prompt = buildBackgroundPrompt(baseParallax, EMPTY_GUIDANCE, linkGuidance, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('Custom override');
  });

  it('combines gridGuidance and linkGuidance in output', () => {
    const gridGuidance: HierarchicalGuidance = { overall: 'Generic notes', groups: {}, cells: {} };
    const linkGuidance: HierarchicalGuidance = { overall: 'Specific notes', groups: {}, cells: {} };
    const prompt = buildBackgroundPrompt(baseParallax, gridGuidance, linkGuidance, EMPTY_GUIDANCE, cellGroups, parallaxLabels, 1, 4);
    expect(prompt).toContain('Generic notes');
    expect(prompt).toContain('Specific notes');
  });
});
