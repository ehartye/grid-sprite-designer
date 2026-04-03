/**
 * Strip camera-relative directional language that is redundant with
 * grid-level compass guidance (e.g. "faces the camera", "facing away",
 * "in profile", "side-view", "back-view").
 */
function stripRedundantDirections(text) {
  let r = text;
  // Order matters: longer/more specific patterns first
  r = r.replace(/,?\s*facing away from the camera\b/gi, '');
  r = r.replace(/\bFacing away from the camera,?\s*/gi, '');
  r = r.replace(/,?\s*faces? away from the camera\b/gi, '');
  r = r.replace(/,?\s*facing the (camera|viewer)\b/gi, '');
  r = r.replace(/\bFacing the (camera|viewer),?\s*/gi, '');
  r = r.replace(/,?\s*faces? the (camera|viewer)\b/gi, '');
  r = r.replace(/,?\s*toward the (camera|viewer)\b/gi, '');
  r = r.replace(/,?\s*facing away\b/gi, '');
  r = r.replace(/\bFacing away,?\s*/gi, '');
  r = r.replace(/,?\s*faces? away\b/gi, '');
  r = r.replace(/\bfaces? AWAY,?\s*/gi, '');
  r = r.replace(/,?\s*facing (left|right|forward)\b/gi, '');
  r = r.replace(/\bFacing (left|right|forward),?\s*/gi, '');
  r = r.replace(/,?\s*faces? (left|right|forward)\b/gi, '');
  r = r.replace(/\bin side[- ]?view\b/gi, '');
  r = r.replace(/\bside[- ]?view\b/gi, '');
  r = r.replace(/\bprofile facing (left|right)\b/gi, '');
  r = r.replace(/\bin profile,?\s*/gi, '');
  r = r.replace(/\bin profile\b/gi, '');
  r = r.replace(/\bback[- ]?view\b/gi, '');
  r = r.replace(/\bfront[- ]?view\b/gi, '');
  r = r.replace(/\bvisible from behind\b/gi, 'visible');
  r = r.replace(/\bseen from behind\b/gi, 'seen');
  r = r.replace(/,?\s*from behind\b(?!\s*—)/gi, '');
  r = r.replace(/,?\s*showing (their|the|his|her|its) back\b/gi, '');
  r = r.replace(/\bviewed from the back\b/gi, '');
  r = r.replace(/,?\s*from the back\b/gi, '');
  // Clean up artifacts
  r = r.replace(/\s+\./g, '.');
  r = r.replace(/\s{2,}/g, ' ');
  r = r.replace(/,\s*,/g, ',');
  r = r.replace(/^\s*,\s*/, '');
  r = r.replace(/,\s*\./g, '.');
  return r.trim();
}

/**
 * Parse a guidance blob in the `Header "Label" (r,c): text...` format into
 * { overall, groups, cells } structure.
 *
 * - Lines matching `  Header "LABEL" (r,c): ...` → cells["LABEL"]
 * - Continuation lines (4+ space indent) belong to the previous cell
 * - All other lines → overall (preamble text, ROW headers, etc.)
 */
/**
 * @param {string} blob
 * @param {Record<string,string>} [renameMap] - old label → new label aliases
 */
export function decomposeGuidanceBlob(blob, renameMap = {}) {
  if (!blob?.trim()) return { overall: '', groups: {}, cells: {} };

  const lines = blob.split('\n');
  const cells = {};
  const nonCellLines = [];

  let currentLabel = null;
  let currentLines = [];

  const cellHeaderRegex = /^ {1,8}Header\s+"([^"]+)"\s+\(\d+,\d+\)\s*:\s*(.*)/;

  function flushCell() {
    if (currentLabel !== null) {
      let text = currentLines.join('\n').trim();
      if (text) {
        text = stripRedundantDirections(text);
        cells[renameMap[currentLabel] ?? currentLabel] = text;
      }
      currentLabel = null;
      currentLines = [];
    }
  }

  for (const line of lines) {
    const match = line.match(cellHeaderRegex);
    if (match) {
      flushCell();
      currentLabel = match[1];
      const rest = match[2].trim();
      if (rest) currentLines.push(rest);
    } else if (currentLabel !== null && /^ {4}/.test(line)) {
      const trimmed = line.trim();
      if (trimmed) currentLines.push(trimmed);
    } else {
      flushCell();
      nonCellLines.push(line);
    }
  }
  flushCell();

  return {
    overall: nonCellLines.join('\n').trim(),
    groups: {},
    cells,
  };
}

/** Label rename map for RPG Full character grid (old seed names → current grid labels) */
export const RPG_FULL_RENAME = {
  'Walk Down 1': 'Walk South 1',
  'Walk Down 2': 'Walk South 2',
  'Walk Down 3': 'Walk South 3',
  'Walk Up 1': 'Walk North 1',
  'Walk Up 2': 'Walk North 2',
  'Walk Up 3': 'Walk North 3',
  'Walk Left 1': 'Walk West 1',
  'Walk Left 2': 'Walk West 2',
  'Walk Left 3': 'Walk West 3',
  'Walk Right 1': 'Walk East 1',
  'Walk Right 2': 'Walk East 2',
  'Walk Right 3': 'Walk East 3',
  'Idle Down': 'Idle South',
  'Idle Up': 'Idle North',
  'Idle Left': 'Idle West',
  'Idle Right': 'Idle East',
  'Cast 1': 'Special 1',
  'Cast 2': 'Special 2',
  'Cast 3': 'Special 3',
  'Weak Pose': 'Weak',
  'Critical Pose': 'Critical',
};
