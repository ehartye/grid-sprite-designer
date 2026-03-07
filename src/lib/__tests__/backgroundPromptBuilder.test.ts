import { describe, it, expect } from 'vitest';
import { buildBackgroundPrompt, type BackgroundConfig } from '../backgroundPromptBuilder';
import type { GridConfig } from '../gridConfig';

const baseParallax: BackgroundConfig = {
  name: 'Sunset Mountains',
  description: 'Layered mountain landscape at sunset',
  colorNotes: 'Warm oranges, purples, deep blues',
  styleNotes: '',
  layerGuidance: 'Sky at top, ground at bottom',
  bgMode: 'parallax',
};

const baseScene: BackgroundConfig = {
  name: 'Village Square',
  description: 'A bustling medieval village square',
  colorNotes: 'Warm earth tones',
  styleNotes: '',
  layerGuidance: 'Same composition, different lighting',
  bgMode: 'scene',
};

const parallaxGrid: GridConfig = {
  id: 'bg-parallax-1x4',
  label: 'Parallax 1x4',
  cols: 1,
  rows: 4,
  totalCells: 4,
  cellLabels: ['Sky', 'Mountains', 'Trees', 'Ground'],
  templates: {
    '2K': { cellW: 2044, cellH: 509, headerH: 18, border: 2, fontSize: 11 },
    '4K': { cellW: 4088, cellH: 1018, headerH: 30, border: 4, fontSize: 18 },
  },
};

const sceneGrid: GridConfig = {
  id: 'bg-scene-2x2',
  label: 'Scene 2x2',
  cols: 2,
  rows: 2,
  totalCells: 4,
  cellLabels: ['Day', 'Night', 'Dawn', 'Dusk'],
  templates: {
    '2K': { cellW: 1021, cellH: 1021, headerH: 28, border: 2, fontSize: 18 },
    '4K': { cellW: 2042, cellH: 2042, headerH: 44, border: 4, fontSize: 28 },
  },
};

describe('buildBackgroundPrompt - parallax mode', () => {
  it('includes background name in uppercase', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid);
    expect(prompt).toContain('SUNSET MOUNTAINS');
  });

  it('mentions parallax scrolling', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid);
    expect(prompt).toContain('parallax scrolling background');
  });

  it('includes parallax-specific design rules', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid);
    expect(prompt).toContain('PARALLAX LAYER DESIGN');
    expect(prompt).toContain('tile HORIZONTALLY');
  });

  it('labels cells as "layer"', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid);
    expect(prompt).toContain('layer matching this label');
  });

  it('includes grid dimensions', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid);
    expect(prompt).toContain('1\u00d74');
    expect(prompt).toContain('4 cells');
  });
});

describe('buildBackgroundPrompt - scene mode', () => {
  it('mentions scene variant', () => {
    const prompt = buildBackgroundPrompt(baseScene, sceneGrid);
    expect(prompt).toContain('scene variant of VILLAGE SQUARE');
  });

  it('includes scene-specific design rules', () => {
    const prompt = buildBackgroundPrompt(baseScene, sceneGrid);
    expect(prompt).toContain('SCENE VARIATION DESIGN');
    expect(prompt).toContain('Same composition');
  });

  it('labels cells as "scene"', () => {
    const prompt = buildBackgroundPrompt(baseScene, sceneGrid);
    expect(prompt).toContain('scene matching this label');
  });

  it('lists cell labels', () => {
    const prompt = buildBackgroundPrompt(baseScene, sceneGrid);
    expect(prompt).toContain('"Day"');
    expect(prompt).toContain('"Dusk"');
  });
});

describe('buildBackgroundPrompt - guidance', () => {
  it('falls back to bg.layerGuidance when no override', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid);
    expect(prompt).toContain('Sky at top, ground at bottom');
  });

  it('uses guidanceOverride over bg.layerGuidance', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid, undefined, 'Custom override');
    expect(prompt).toContain('Custom override');
  });

  it('combines gridGenericGuidance with override', () => {
    const prompt = buildBackgroundPrompt(baseParallax, parallaxGrid, 'Generic notes', 'Specific notes');
    expect(prompt).toContain('Generic notes');
    expect(prompt).toContain('Specific notes');
  });
});
