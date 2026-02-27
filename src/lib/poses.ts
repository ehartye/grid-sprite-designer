/**
 * Pose definitions for the 6×6 sprite grid.
 * 36 cells total: walk (12) + idle (4) + battle (18) + status (2)
 */

export interface PoseDef {
  id: string;
  label: string;
  row: number;
  col: number;
  cellIndex: number;
  animGroup: string;
  frameIndex: number;
  direction?: string;
}

export const COLS = 6;
export const ROWS = 6;
export const TOTAL_CELLS = COLS * ROWS;

export const CELL_LABELS: string[] = [
  // Row 0: Walk Down + Walk Up
  'Walk Down 1', 'Walk Down 2', 'Walk Down 3',
  'Walk Up 1', 'Walk Up 2', 'Walk Up 3',
  // Row 1: Walk Left + Walk Right
  'Walk Left 1', 'Walk Left 2', 'Walk Left 3',
  'Walk Right 1', 'Walk Right 2', 'Walk Right 3',
  // Row 2: Idle + Battle Idle start
  'Idle Down', 'Idle Up', 'Idle Left', 'Idle Right',
  'Battle Idle 1', 'Battle Idle 2',
  // Row 3: Battle Idle 3, Attack, Cast start
  'Battle Idle 3',
  'Attack 1', 'Attack 2', 'Attack 3',
  'Cast 1', 'Cast 2',
  // Row 4: Cast 3, Damage, KO start
  'Cast 3',
  'Damage 1', 'Damage 2', 'Damage 3',
  'KO 1', 'KO 2',
  // Row 5: KO 3, Victory, Weak, Critical
  'KO 3',
  'Victory 1', 'Victory 2', 'Victory 3',
  'Weak Pose', 'Critical Pose',
];

export const POSES: PoseDef[] = CELL_LABELS.map((label, idx) => {
  const row = Math.floor(idx / COLS);
  const col = idx % COLS;

  // Determine anim group and frame index from label
  let animGroup = 'misc';
  let frameIndex = 0;
  let direction: string | undefined;

  const match = label.match(/^(.+?)(?:\s+(\d+))?$/);
  if (match) {
    const base = match[1].trim();
    frameIndex = match[2] ? parseInt(match[2]) - 1 : 0;

    if (base.startsWith('Walk Down')) { animGroup = 'walk-down'; direction = 'down'; }
    else if (base.startsWith('Walk Up')) { animGroup = 'walk-up'; direction = 'up'; }
    else if (base.startsWith('Walk Left')) { animGroup = 'walk-left'; direction = 'left'; }
    else if (base.startsWith('Walk Right')) { animGroup = 'walk-right'; direction = 'right'; }
    else if (base === 'Idle Down') { animGroup = 'idle-down'; direction = 'down'; }
    else if (base === 'Idle Up') { animGroup = 'idle-up'; direction = 'up'; }
    else if (base === 'Idle Left') { animGroup = 'idle-left'; direction = 'left'; }
    else if (base === 'Idle Right') { animGroup = 'idle-right'; direction = 'right'; }
    else if (base.startsWith('Battle Idle')) { animGroup = 'battle-idle'; }
    else if (base.startsWith('Attack')) { animGroup = 'attack'; }
    else if (base.startsWith('Cast')) { animGroup = 'cast'; }
    else if (base.startsWith('Damage')) { animGroup = 'damage'; }
    else if (base.startsWith('KO')) { animGroup = 'ko'; }
    else if (base.startsWith('Victory')) { animGroup = 'victory'; }
    else if (base === 'Weak Pose') { animGroup = 'weak'; }
    else if (base === 'Critical Pose') { animGroup = 'critical'; }
  }

  return {
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    row,
    col,
    cellIndex: idx,
    animGroup,
    frameIndex,
    direction,
  };
});

/** Animation definitions mapping group names to cell indices for playback */
export interface AnimationDef {
  name: string;
  frames: number[];   // cell indices
  loop: boolean;
}

export const ANIMATIONS: AnimationDef[] = [
  { name: 'Walk Down',   frames: [0, 1, 2, 1],        loop: true },
  { name: 'Walk Up',     frames: [3, 4, 5, 4],        loop: true },
  { name: 'Walk Left',   frames: [6, 7, 8, 7],        loop: true },
  { name: 'Walk Right',  frames: [9, 10, 11, 10],     loop: true },
  { name: 'Idle Down',   frames: [12],                 loop: true },
  { name: 'Idle Up',     frames: [13],                 loop: true },
  { name: 'Idle Left',   frames: [14],                 loop: true },
  { name: 'Idle Right',  frames: [15],                 loop: true },
  { name: 'Battle Idle', frames: [16, 17, 18, 17],    loop: true },
  { name: 'Attack',      frames: [19, 20, 21],        loop: false },
  { name: 'Cast',        frames: [22, 23, 24],        loop: false },
  { name: 'Damage',      frames: [25, 26, 27],        loop: false },
  { name: 'KO',          frames: [28, 29, 30],        loop: false },
  { name: 'Victory',     frames: [31, 32, 33],        loop: true },
  { name: 'Weak',        frames: [34],                 loop: true },
  { name: 'Critical',    frames: [35],                 loop: true },
];

/** Direction-based walk/idle mapping for arrow-key preview */
export const DIR_WALK: Record<string, string> = {
  ArrowDown: 'Walk Down', ArrowUp: 'Walk Up',
  ArrowLeft: 'Walk Left', ArrowRight: 'Walk Right',
};

export const DIR_IDLE: Record<string, string> = {
  ArrowDown: 'Idle Down', ArrowUp: 'Idle Up',
  ArrowLeft: 'Idle Left', ArrowRight: 'Idle Right',
};
