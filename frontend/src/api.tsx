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
