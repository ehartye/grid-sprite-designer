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
      const text = currentLines.join('\n').trim();
      if (text) cells[renameMap[currentLabel] ?? currentLabel] = text;
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
  'Cast 1': 'Special 1',
  'Cast 2': 'Special 2',
  'Cast 3': 'Special 3',
  'Weak Pose': 'Weak',
  'Critical Pose': 'Critical',
};
