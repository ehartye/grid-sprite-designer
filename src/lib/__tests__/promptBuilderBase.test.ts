import { test, expect } from 'vitest';
import { buildGuidanceBlock } from '../promptBuilderBase';
import type { HierarchicalGuidance } from '../../context/AppContext';
import type { CellGroup } from '../../context/AppContext';

const empty: HierarchicalGuidance = { overall: '', groups: {}, cells: {} };

const cellGroups: CellGroup[] = [
  { name: 'Walk Down Animation Frames', cells: [0, 1, 2] },
  { name: 'Walk Up Animation Frames', cells: [3, 4, 5] },
];
const cellLabels = ['Walk Down 1', 'Walk Down 2', 'Walk Down 3', 'Walk Up 1', 'Walk Up 2', 'Walk Up 3'];

test('includes overall guidance from grid source', () => {
  const grid: HierarchicalGuidance = { overall: 'Grid overall.', groups: {}, cells: {} };
  const result = buildGuidanceBlock(grid, empty, empty, cellGroups, cellLabels, 6);
  expect(result).toContain('Grid overall.');
});

test('composes cell guidance from all three sources', () => {
  const grid: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'Default walk.' } };
  const link: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'Link addition.' } };
  const preset: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'Preset detail.' } };
  const result = buildGuidanceBlock(grid, link, preset, cellGroups, cellLabels, 6);
  expect(result).toContain('Default walk.');
  expect(result).toContain('Link addition.');
  expect(result).toContain('Preset detail.');
});

test('cell appears within its group section', () => {
  const grid: HierarchicalGuidance = { overall: '', groups: {}, cells: { 'Walk Down 1': 'stride desc' } };
  const result = buildGuidanceBlock(grid, empty, empty, cellGroups, cellLabels, 6);
  const groupIdx = result.indexOf('Walk Down Animation Frames');
  const cellIdx = result.indexOf('Walk Down 1');
  expect(groupIdx).toBeGreaterThan(-1);
  expect(cellIdx).toBeGreaterThan(groupIdx);
});

test('omits OVERALL GUIDANCE section when all overall sources are empty', () => {
  const result = buildGuidanceBlock(empty, empty, empty, cellGroups, cellLabels, 6);
  expect(result).toContain('Walk Down 1');
  expect(result).not.toContain('OVERALL GUIDANCE');
});

test('group guidance appears before cells in that group', () => {
  const grid: HierarchicalGuidance = {
    overall: '', groups: { 'Walk Down Animation Frames': 'Group note.' }, cells: { 'Walk Down 1': 'Cell note.' }
  };
  const result = buildGuidanceBlock(grid, empty, empty, cellGroups, cellLabels, 6);
  const groupNoteIdx = result.indexOf('Group note.');
  const cellNoteIdx = result.indexOf('Cell note.');
  expect(groupNoteIdx).toBeGreaterThan(-1);
  expect(cellNoteIdx).toBeGreaterThan(groupNoteIdx);
});
