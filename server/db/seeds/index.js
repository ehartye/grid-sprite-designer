import { seedGridPresets } from './gridPresets.js';
import { seedCharacterPresets } from './characterPresets.js';
import { seedBuildingPresets } from './buildingPresets.js';
import { seedTerrainPresets } from './terrainPresets.js';
import { seedBackgroundPresets } from './backgroundPresets.js';
import { seedIsometricGridPresets } from './isometricGridPresets.js';
import { seedAnimationSeries } from './animationSeries.js';

export function runAllSeeds(db) {
  seedGridPresets(db);
  seedCharacterPresets(db);
  seedBuildingPresets(db);
  seedTerrainPresets(db);
  seedBackgroundPresets(db);
  seedIsometricGridPresets(db);
  seedAnimationSeries(db);
}
