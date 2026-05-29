// Anonymous-voter identity + local "already voted" memory for minigames.
// The server dedups votes by voter_key; this lets the UI reveal results on revisit.

const VOTER_KEY = "tcg_voter_key";
const VOTED_KEY = "tcg_voted_minigames";

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

type VotedMap = Record<number, number>;

function readVotedMap(): VotedMap {
  try {
    return JSON.parse(localStorage.getItem(VOTED_KEY) ?? "{}") as VotedMap;
  } catch {
    return {};
  }
}

/** The option id the user previously chose for a minigame, or null. */
export function getVotedOption(minigameId: number): number | null {
  const v = readVotedMap()[minigameId];
  return typeof v === "number" ? v : null;
}

/** Remember which option the user chose so the reveal persists across reloads. */
export function rememberVote(minigameId: number, optionId: number): void {
  const map = readVotedMap();
  map[minigameId] = optionId;
  localStorage.setItem(VOTED_KEY, JSON.stringify(map));
}
