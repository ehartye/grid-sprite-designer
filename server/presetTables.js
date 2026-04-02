// Content preset table configuration — single data-driven implementation
// Each column entry: [bodyField, dbColumn, default, json?]
export const PRESET_TABLES = {
  character: {
    table: 'character_presets', linkTable: 'character_grid_links', fk: 'character_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['equipment', 'equipment', ''], ['colorNotes', 'color_notes', ''],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
  building: {
    table: 'building_presets', linkTable: 'building_grid_links', fk: 'building_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['details', 'details', ''], ['colorNotes', 'color_notes', ''],
      ['gridSize', 'grid_size', '3x3'], ['cellLabels', 'cell_labels', [], true],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
  terrain: {
    table: 'terrain_presets', linkTable: 'terrain_grid_links', fk: 'terrain_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['colorNotes', 'color_notes', ''], ['gridSize', 'grid_size', '4x4'],
      ['tileLabels', 'tile_labels', [], true],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
  background: {
    table: 'background_presets', linkTable: 'background_grid_links', fk: 'background_preset_id',
    columns: [
      ['name', 'name'], ['genre', 'genre', ''], ['description', 'description', ''],
      ['colorNotes', 'color_notes', ''], ['gridSize', 'grid_size', '1x4'],
      ['bgMode', 'bg_mode', 'parallax'], ['layerLabels', 'layer_labels', [], true],
      ['overallGuidance', 'overall_guidance', ''],
      ['groupGuidance', 'group_guidance', '{}', true],
      ['cellGuidance', 'cell_guidance', '{}', true],
    ],
  },
};
