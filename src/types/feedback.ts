export interface CellFeedback {
  signedOff: boolean;
  feedback: string;
}

export interface GroupFeedback {
  feedback: string;
}

export interface FeedbackState {
  global: string;
  groups: Record<string, GroupFeedback>;   // keyed by group name
  cells: Record<number, CellFeedback>;     // keyed by cell index
}

/** Check if feedback state has any actual content */
export function hasFeedback(state: FeedbackState): boolean {
  if (state.global.trim()) return true;
  for (const g of Object.values(state.groups)) {
    if (g.feedback.trim()) return true;
  }
  for (const c of Object.values(state.cells)) {
    if (c.feedback.trim() || c.signedOff) return true;
  }
  return false;
}

/** Count cells that are NOT signed off */
export function unsignedOffCount(state: FeedbackState, totalCells: number): number {
  let count = 0;
  for (let i = 0; i < totalCells; i++) {
    if (!state.cells[i]?.signedOff) count++;
  }
  return count;
}

export function createEmptyFeedback(): FeedbackState {
  return { global: '', groups: {}, cells: {} };
}
