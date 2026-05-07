import axios from "axios";

const API_BASE_URL = "http://localhost:8080/api";

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
  typeline?: string;
  artist?: string;
  power?: string;
  toughness?: string;
  oracleText?: string;
  image?: string;
}

export const fetchCards = async (
  filters?: Record<string, string>,
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
}

export const fetchProfile = async (): Promise<UserProfile> => {
  const response = await axios.get<UserProfile>(`${API_BASE_URL}/profile`, {
    headers: authHeaders(),
  });
  return response.data;
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
