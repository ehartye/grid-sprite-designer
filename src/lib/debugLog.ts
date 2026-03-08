/**
 * Debug logging utility gated behind import.meta.env.DEV.
 * No-op in production builds to keep the console clean.
 */
export function debugLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
