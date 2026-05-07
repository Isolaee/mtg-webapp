import axios from "axios";

const API_BASE_URL = "http://localhost:8080/api";

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

export interface Deck {
  id: number;
  name: string;
}

export const fetchCards = async (
  filters?: Record<string, string>,
): Promise<Card[]> => {
  const response = await axios.get<Card[]>(`${API_BASE_URL}/cards`, {
    params: filters,
  });
  return response.data;
};

export const fetchDecks = async (): Promise<Deck[]> => {
  const response = await axios.get<Deck[]>(`${API_BASE_URL}/decks`);
  return response.data;
};

export const createDeck = async (deckData: Partial<Deck>): Promise<Deck> => {
  const response = await axios.post<Deck>(`${API_BASE_URL}/decks`, deckData);
  return response.data;
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
