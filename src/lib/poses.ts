/**
 * Pose / animation definitions for the canonical RPG Full 6×6 sprite grid.
 *
 * Source of truth is `grid_presets.cell_labels` / `cell_groups` in the DB —
 * consumers should always prefer the dynamic values threaded through app
 * state (`activeGridConfig.cellLabels` / `cellGroups`, or the current run's
 * selected grid link). The constants here are a last-resort fallback for
 * callers that don't have access to the dynamic values, and are kept in
 * sync with the current canonical RPG Full grid's cell ordering.
 */

export const COLS = 6;
export const ROWS = 6;
export const TOTAL_CELLS = COLS * ROWS;

/**
 * Canonical RPG Full 6×6 cell labels, indexed by cellIndex (0-35).
 * Keep in sync with the `RPG Full` entry in `grid_presets`.
 */
export const CELL_LABELS: string[] = [
  // Row 0 — Walk South cycle
  'Walk South 1', 'Walk South 2', 'Walk South 3',
  // (continued) Walk North cycle
  'Walk North 1', 'Walk North 2', 'Walk North 3',
  // Row 1 — Walk West cycle
  'Walk West 1', 'Walk West 2', 'Walk West 3',
  // (continued) Walk East cycle
  'Walk East 1', 'Walk East 2', 'Walk East 3',
  // Row 2 — Directional idles + status conditions
  'Idle South', 'Idle North', 'Idle West', 'Idle East',
  'Critical', 'Weak',
  // Row 3 — Attack & Special sequences
  'Attack 1', 'Attack 2', 'Attack 3',
  'Special 1', 'Special 2', 'Special 3',
  // Row 4 — Damage & KO sequences
  'Damage 1', 'Damage 2', 'Damage 3',
  'KO 1', 'KO 2', 'KO 3',
  // Row 5 — Battle Idle & Victory sequences
  'Battle Idle 1', 'Battle Idle 2', 'Battle Idle 3',
  'Victory 1', 'Victory 2', 'Victory 3',
];

/** One renderable animation — a named sequence of cell indices. */
export interface AnimationDef {
  name: string;
  frames: number[];
  loop: boolean;
}

/**
 * Canonical default animations matching the RPG Full 6×6 cell order above.
 * Used only when no grid `cellGroups` are available. Walk cycles use a
 * 1-2-3-2 ping-pong; damage/KO/attack play once and hold the last frame.
 */
export const ANIMATIONS: AnimationDef[] = [
  { name: 'Walk South',  frames: [0, 1, 2, 1],     loop: true  },
  { name: 'Walk North',  frames: [3, 4, 5, 4],     loop: true  },
  { name: 'Walk West',   frames: [6, 7, 8, 7],     loop: true  },
  { name: 'Walk East',   frames: [9, 10, 11, 10],  loop: true  },
  { name: 'Idle South',  frames: [12],             loop: true  },
  { name: 'Idle North',  frames: [13],             loop: true  },
  { name: 'Idle West',   frames: [14],             loop: true  },
  { name: 'Idle East',   frames: [15],             loop: true  },
  { name: 'Critical',    frames: [16],             loop: true  },
  { name: 'Weak',        frames: [17],             loop: true  },
  { name: 'Attack',      frames: [18, 19, 20],     loop: false },
  { name: 'Special',     frames: [21, 22, 23],     loop: false },
  { name: 'Damage',      frames: [24, 25, 26],     loop: false },
  { name: 'KO',          frames: [27, 28, 29],     loop: false },
  { name: 'Battle Idle', frames: [30, 31, 32, 31], loop: true  },
  { name: 'Victory',     frames: [33, 34, 35],     loop: true  },
];

/**
 * Transform DB `cell_groups` into a UI-ready animation list.
 *
 * Grids group cells two ways, distinguished by the group name suffix:
 *  - "... Animation Frames" → a playback sequence (walk cycle, attack
 *    wind-up/strike/follow-through, etc.). Kept bundled as one entry.
 *  - "... Poses" → a bundle of independent static poses (the four
 *    directional idles, or the Weak/Critical condition pair). Expanded
 *    into one single-frame animation per cell, named from `cellLabels`
 *    so each directional idle can be selected individually.
 *
 * If `cellGroups` is empty/undefined, returns an empty list — callers
 * should fall back to `ANIMATIONS` in that case.
 */
export function expandAnimations(
  cellGroups: ReadonlyArray<{ name: string; cells: number[] }> | undefined,
  cellLabels: ReadonlyArray<string> | undefined,
): AnimationDef[] {
  if (!cellGroups?.length) return [];
  const labels = cellLabels ?? [];
  const out: AnimationDef[] = [];
  for (const g of cellGroups) {
    const isPoseBundle = /\bPoses?$/.test(g.name);
    if (isPoseBundle && g.cells.length > 1) {
      for (const cellIdx of g.cells) {
        out.push({
          name: labels[cellIdx] ?? `Cell ${cellIdx}`,
          frames: [cellIdx],
          loop: true,
        });
      }
    } else {
      out.push({ name: g.name, frames: g.cells, loop: true });
    }
  }
  return out;
}

/**
 * Arrow-key → compass-direction mapping used by hold-to-walk / release-to-idle
 * keyboard controls.
 */
const DIRECTION_BY_KEY: Readonly<Record<string, string>> = {
  ArrowDown:  'South',
  ArrowUp:    'North',
  ArrowLeft:  'West',
  ArrowRight: 'East',
};

/**
 * Find the index of the animation in `animations` matching a given arrow-key
 * press and mode. Uses substring matching to tolerate both short canonical
 * names (e.g. `"Walk South"`) and verbose grid-preset names
 * (e.g. `"Walk South Animation Frames"`). Returns `-1` if no match.
 */
export function findDirectionalAnim(
  animations: ReadonlyArray<AnimationDef>,
  key: string,
  mode: 'walk' | 'idle',
): number {
  const direction = DIRECTION_BY_KEY[key];
  if (!direction) return -1;
  const verb = mode === 'walk' ? 'Walk' : 'Idle';
  return animations.findIndex(
    (a) => a.name.includes(verb) && a.name.includes(direction),
  );
}
