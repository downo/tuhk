/**
 * Save revisions: every upload carries rev = (rev of the save this window last read or wrote) + 1.
 * The server refuses any other rev, so an old tab or device can never roll the base back.
 * The same rule is enforced by `save_put` (cloud) and `save_write` (self-hosted PHP).
 */
let serverRev = 0;

export const SAVE_CONFLICT = "save_conflict";
export const rememberServerRev = (state: { rev?: number } | null) => { serverRev = state?.rev ?? 0; };
export const nextRev = () => serverRev + 1;
export const confirmRev = (rev: number) => { serverRev = rev; };
export const isConflict = (msg: string | undefined) => !!msg && msg.includes(SAVE_CONFLICT);

/** Mirrors the server rule; exported for tests. */
export function acceptsWrite(storedRev: number | undefined, incomingRev: number | undefined): boolean {
  const have = storedRev ?? 0;
  return have <= 0 || (incomingRev ?? 0) === have + 1;
}

/** Total building levels; a write with fewer than the stored save triggers a backup. */
export const buildingTotal = (s: { structures?: Record<string, number> } | null) =>
  Object.values(s?.structures ?? {}).reduce((a, b) => a + Math.max(0, b || 0), 0);
