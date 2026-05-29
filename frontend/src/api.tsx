import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL ?? "http://localhost:8080/api";

const STORAGE_KEY = "tcg_token";

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── MTG ──────────────────────────────────────────────────────────────────────

export interface Card {
  name: string;
  manacost?: string;
  cmc?: number;
  colors?: string;
  colorIdentity?: string;
  power?: string;
  toughness?: string;
  oracleText?: string;
  loyalty?: string;
  supertype?: string;
  cardType?: string;
  typeline?: string;
  artist?: string;
  legalities?: string;
  image?: string;
}

export interface CardFilters {
  name?: string;
  type?: string;
  color?: string;
}

export const fetchCards = async (
  filters?: CardFilters | Record<string, string>,
): Promise<Card[]> => {
  const response = await axios.get<Card[]>(`${API_BASE_URL}/cards`, {
    params: filters,
  });
  return response.data;
};

export interface MtgDeckSummary {
  name: string;
  description?: string;
  format: string;
}

export interface MtgDeckFull {
  name: string;
  format: string;
  description?: string;
  commander?: Card;
  cards: Card[];
}

export interface MtgDeckSavePayload {
  name: string;
  format: string;
  description?: string;
  commander?: Card;
  cards: Card[];
}

export interface UserProfile {
  username: string;
  created_at?: string;
  mtg_deck_count: number;
  rb_deck_count: number;
  is_premium?: boolean;
}

export const fetchProfile = async (): Promise<UserProfile> => {
  const response = await axios.get<UserProfile>(`${API_BASE_URL}/profile`, {
    headers: authHeaders(),
  });
  return response.data;
};

export const activatePremium = async (purchaseToken: string): Promise<void> => {
  await axios.post(
    `${API_BASE_URL}/premium/activate`,
    { purchase_token: purchaseToken },
    { headers: authHeaders() },
  );
};

export const changePassword = async (
  old_password: string,
  new_password: string,
): Promise<void> => {
  await axios.post(
    `${API_BASE_URL}/change-password`,
    { old_password, new_password },
    { headers: authHeaders() },
  );
};

export const fetchMtgDeckList = async (): Promise<MtgDeckSummary[]> => {
  const response = await axios.get<{ decks: MtgDeckSummary[] }>(
    `${API_BASE_URL}/decks`,
    { headers: authHeaders() },
  );
  return response.data.decks;
};

export const fetchMtgDeck = async (name: string): Promise<MtgDeckFull> => {
  const response = await axios.get<MtgDeckFull>(
    `${API_BASE_URL}/decks/${encodeURIComponent(name)}`,
    { headers: authHeaders() },
  );
  return response.data;
};

export const saveMtgDeck = async (payload: MtgDeckSavePayload): Promise<void> => {
  await axios.post(`${API_BASE_URL}/decks`, payload, {
    headers: authHeaders(),
  });
};

export const deleteMtgDeck = async (name: string): Promise<void> => {
  await axios.delete(
    `${API_BASE_URL}/decks/${encodeURIComponent(name)}`,
    { headers: authHeaders() },
  );
};

// ── Riftbound ────────────────────────────────────────────────────────────────

export interface RbCard {
  id: string;
  name: string;
  set_id: string;
  collector_number?: number;
  rarity: string;
  faction: string;
  card_type: string;
  orientation?: string;
  energy?: number;
  might?: number;
  power?: number;
  image?: string;
  image_small?: string;
  image_medium?: string;
  image_large?: string;
  art_image?: string;
  art_artist?: string;
  description?: string;
  flavor_text?: string;
  keywords?: string;
  tags?: string;
  is_banned: number;
  prev_card_id?: string;
  next_card_id?: string;
}

export interface RbCardFilters {
  name?: string;
  faction?: string;
  rarity?: string;
  type?: string;
  set?: string;
}

export const fetchRbCards = async (
  filters?: RbCardFilters,
): Promise<RbCard[]> => {
  const response = await axios.get<RbCard[]>(`${API_BASE_URL}/rb/cards`, {
    params: filters,
  });
  return response.data;
};

export const fetchRbCard = async (id: string): Promise<RbCard> => {
  const response = await axios.get<RbCard>(`${API_BASE_URL}/rb/cards/${id}`);
  return response.data;
};

export interface RbDeckSummary {
  id: number;
  name: string;
  format: string;
  description?: string;
}

export interface RbDeckFull {
  id: number;
  name: string;
  format: string;
  champion?: string;
  main_deck?: { id: string; count: number }[];
  rune_deck?: { id: string; count: number }[];
  battlefields?: string[];
  description?: string;
  created_at?: string;
}

export interface RbDeckSavePayload {
  name: string;
  format?: string;
  champion?: string;
  main_deck?: { id: string; count: number }[];
  rune_deck?: { id: string; count: number }[];
  battlefields?: string[];
  description?: string;
}

export const fetchRbDeckList = async (): Promise<RbDeckSummary[]> => {
  const response = await axios.get<{ decks: RbDeckSummary[] }>(
    `${API_BASE_URL}/rb/decks`,
    { headers: authHeaders() },
  );
  return response.data.decks;
};

export const fetchRbDeck = async (name: string): Promise<RbDeckFull> => {
  const response = await axios.get<RbDeckFull>(
    `${API_BASE_URL}/rb/decks/${encodeURIComponent(name)}`,
    { headers: authHeaders() },
  );
  return response.data;
};

export const saveRbDeck = async (
  payload: RbDeckSavePayload,
): Promise<void> => {
  await axios.post(`${API_BASE_URL}/rb/decks`, payload, {
    headers: authHeaders(),
  });
};

export const deleteRbDeck = async (name: string): Promise<void> => {
  await axios.delete(
    `${API_BASE_URL}/rb/decks/${encodeURIComponent(name)}`,
    { headers: authHeaders() },
  );
};

// ── Collection ───────────────────────────────────────────────────────────────

export interface CollectionEntry {
  id: number;
  user_id: string;
  game: "mtg" | "riftbound";
  card_id: string;
  is_foil: number;
  quantity: number;
  added_at?: string;
}

export interface ScanMatch {
  game: "mtg" | "riftbound";
  card_id: string;
  card_name: string;
  image?: string;
  distance: number;
}

export const fetchCollection = async (
  game?: "mtg" | "riftbound",
): Promise<CollectionEntry[]> => {
  const response = await axios.get<{ collection: CollectionEntry[] }>(
    `${API_BASE_URL}/collection`,
    { headers: authHeaders(), params: game ? { game } : undefined },
  );
  return response.data.collection;
};

export const addToCollection = async (entry: {
  game: "mtg" | "riftbound";
  card_id: string;
  is_foil?: boolean;
}): Promise<number> => {
  const response = await axios.post<{ id: number }>(
    `${API_BASE_URL}/collection`,
    entry,
    { headers: authHeaders() },
  );
  return response.data.id;
};

export const updateCollectionEntry = async (
  id: number,
  patch: { quantity?: number; is_foil?: boolean },
): Promise<void> => {
  await axios.put(`${API_BASE_URL}/collection/${id}`, patch, {
    headers: authHeaders(),
  });
};

export const removeFromCollection = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/collection/${id}`, {
    headers: authHeaders(),
  });
};

// ── Tournaments ──────────────────────────────────────────────────────────────

export interface TournamentEvent {
  id: number;
  source: string;
  external_id: string;
  name: string;
  game: string;
  format: string | null;
  event_date: string | null;
  scraped_at: string;
}

export interface DeckEntry {
  name: string;
  qty: number;
  card_type: string;
}

export interface TournamentPlacement {
  id: number;
  event_id: number;
  placement: number | null;
  player: string | null;
  record: string | null;
  decklist: string | null; // JSON string of DeckEntry[]
}

export interface TournamentEventWithPlacements extends TournamentEvent {
  placements: TournamentPlacement[];
}

export const fetchTournaments = async (
  game: string,
  format?: string,
  limit = 50,
): Promise<TournamentEvent[]> => {
  const response = await axios.get<TournamentEvent[]>(`${API_BASE_URL}/tournaments`, {
    params: { game, format: format || undefined, limit },
  });
  return response.data;
};

export const fetchTournament = async (
  id: number,
): Promise<TournamentEventWithPlacements> => {
  const response = await axios.get<TournamentEventWithPlacements>(
    `${API_BASE_URL}/tournaments/${id}`,
  );
  return response.data;
};

// ── Deck Analysis ────────────────────────────────────────────────────────────

export interface SimilarResult {
  placementId: number;
  player: string | null;
  placement: number | null;
  eventName: string;
  format: string | null;
  overallScore: number;
  classicScore: number;
  semanticScore: number;
  jaccard: number;
  cosine: number;
  colorScore: number;
  cmcScore: number;
}

export interface SimilarResponse {
  deckName: string;
  format: string;
  results: SimilarResult[];
}

export interface CompareResponse {
  overallScore: number;
  classicScore: number;
  semanticScore: number;
  jaccard: number;
  cosine: number;
  colorScore: number;
  cmcScore: number;
  sharedCards: string[];
  uniqueToA: string[];
  uniqueToB: string[];
}

export type DeckRef =
  | { type: "user"; name: string }
  | { type: "tournament"; placementId: number };

export const fetchSimilarDecks = async (
  deckName: string,
  format?: string,
  limit = 20,
  game = "mtg",
): Promise<SimilarResponse> => {
  const response = await axios.get<SimilarResponse>(
    `${API_BASE_URL}/analysis/similar`,
    {
      params: { deck_name: deckName, format: format || undefined, limit, game },
      headers: authHeaders(),
    },
  );
  return response.data;
};

export const compareDecks = async (
  deckA: DeckRef,
  deckB: DeckRef,
): Promise<CompareResponse> => {
  const response = await axios.post<CompareResponse>(
    `${API_BASE_URL}/analysis/compare`,
    { deckA, deckB },
    { headers: authHeaders() },
  );
  return response.data;
};

export const precomputeTags = async (): Promise<void> => {
  await axios.get(`${API_BASE_URL}/analysis/precompute`, {
    headers: authHeaders(),
  });
};

// ── Upgrade Proposals ────────────────────────────────────────────────────────

export type SwapKind = "strict" | "sidegrade";

export interface UpgradeSwap {
  cut: string;
  add: string;
  kind: SwapKind;
  reason: string;
  edhrecInclusionPct?: number;
}

export interface UpgradeHolistic {
  topStrict: UpgradeSwap[];
  topSidegrade: UpgradeSwap[];
}

export interface ColorSourceAdvice {
  color: string;
  currentSources: number;
  neededSources: number;
  maxPipDemand: number;
}

export interface ManaReport {
  format: string;
  recommendedTotalLands: number;
  currentTotalLands: number;
  avgMv: number;
  rampCount: number;
  perColor: ColorSourceAdvice[];
  suggestedCuts: string[];
  suggestedAdds: string[];
}

export interface UpgradesResponse {
  format: string;
  swaps: UpgradeSwap[];
  holistic: UpgradeHolistic;
  landAdvice: ManaReport;
}

export const fetchUpgrades = async (
  deckName: string,
  format?: string,
): Promise<UpgradesResponse> => {
  const response = await axios.post<UpgradesResponse>(
    `${API_BASE_URL}/upgrades`,
    { deckName, format },
    { headers: authHeaders() },
  );
  return response.data;
};

export const scanCard = async (imageBase64: string): Promise<ScanMatch[]> => {
  const byteString = atob(imageBase64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const form = new FormData();
  form.append("image", blob, "scan.jpg");
  const response = await axios.post<{ matches: ScanMatch[] }>(
    `${API_BASE_URL}/collection/scan`,
    form,
    { headers: { ...authHeaders(), "Content-Type": "multipart/form-data" } },
  );
  return response.data.matches;
};

// ── Card Duel ("which card is stronger?") ────────────────────────────────────

export interface DuelCard {
  card_id: string;
  name: string;
  image: string | null;
  elo: number;
}

export interface DuelPair {
  game: string;
  format: string;
  cards: DuelCard[];
}

export interface DuelRatingChange {
  old: number;
  new: number;
}

export interface DuelResult {
  winner_card_id: string;
  loser_card_id: string;
  winner: DuelRatingChange;
  loser: DuelRatingChange;
  higher_card_id: string;
}

export interface DuelLeaderboardEntry {
  rank: number;
  name: string;
  image: string | null;
  elo: number;
  games_played: number;
  wins: number;
}

export const fetchDuelPair = async (game: string, format: string): Promise<DuelPair> => {
  const response = await axios.get<DuelPair>(`${API_BASE_URL}/minigames/duel/pair`, {
    params: { game, format },
  });
  return response.data;
};

export const voteDuel = async (
  game: string,
  format: string,
  winnerCardId: string,
  loserCardId: string,
  voterKey: string,
): Promise<DuelResult> => {
  const response = await axios.post<DuelResult>(
    `${API_BASE_URL}/minigames/duel/vote`,
    { game, format, winner_card_id: winnerCardId, loser_card_id: loserCardId, voter_key: voterKey },
    { headers: authHeaders() },
  );
  return response.data;
};

export const fetchDuelLeaderboard = async (
  game: string,
  format: string,
  limit = 10,
): Promise<DuelLeaderboardEntry[]> => {
  const response = await axios.get<DuelLeaderboardEntry[]>(
    `${API_BASE_URL}/minigames/duel/leaderboard`,
    { params: { game, format, limit } },
  );
  return response.data;
};
