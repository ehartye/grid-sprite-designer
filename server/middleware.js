import { PRESET_TABLES } from './presetTables.js';

/**
 * Express middleware that validates req.params.type against PRESET_TABLES.
 * On success, attaches the config object to req.presetConfig.
 * On failure, responds with 400.
 */
export function validatePresetType(req, res, next) {
  const config = PRESET_TABLES[req.params.type];
  if (!config) return res.status(400).json({ error: 'Invalid type' });
  req.presetConfig = config;
  next();
}
