// Anonymous-voter identity for minigame votes (e.g. the card duel).
// The server dedups votes by voter_key; this gives each browser a stable id.

const VOTER_KEY = "tcg_voter_key";

/** Stable per-browser id used to dedupe anonymous votes. */
export function getVoterKey(): string {
  let v = localStorage.getItem(VOTER_KEY);
  if (!v) {
    v =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VOTER_KEY, v);
  }
  return v;
}
