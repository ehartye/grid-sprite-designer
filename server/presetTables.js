// Content preset table configuration — single data-driven implementation
// Each column entry: { field, column, default?, json? }
export const PRESET_TABLES = {
  character: {
    table: 'character_presets', linkTable: 'character_grid_links', fk: 'character_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'equipment', column: 'equipment', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
  building: {
    table: 'building_presets', linkTable: 'building_grid_links', fk: 'building_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'details', column: 'details', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'gridSize', column: 'grid_size', default: '3x3' },
      { field: 'cellLabels', column: 'cell_labels', default: [], json: true },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
  terrain: {
    table: 'terrain_presets', linkTable: 'terrain_grid_links', fk: 'terrain_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'gridSize', column: 'grid_size', default: '4x4' },
      { field: 'tileLabels', column: 'tile_labels', default: [], json: true },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
  background: {
    table: 'background_presets', linkTable: 'background_grid_links', fk: 'background_preset_id',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'genre', column: 'genre', default: '' },
      { field: 'description', column: 'description', default: '' },
      { field: 'colorNotes', column: 'color_notes', default: '' },
      { field: 'gridSize', column: 'grid_size', default: '1x4' },
      { field: 'bgMode', column: 'bg_mode', default: 'parallax' },
      { field: 'layerLabels', column: 'layer_labels', default: [], json: true },
      { field: 'overallGuidance', column: 'overall_guidance', default: '' },
      { field: 'groupGuidance', column: 'group_guidance', default: '{}', json: true },
      { field: 'cellGuidance', column: 'cell_guidance', default: '{}', json: true },
    ],
  },
};
