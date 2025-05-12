import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Example interfaces (customize as needed)
export interface Card {
    id: number;
    name: string;
    // Add other card fields here
}

export interface Deck {
    id: number;
    name: string;
    // Add other deck fields here
}

export const fetchCards = async (filters?: Record<string, any>): Promise<Card[]> => {
    try {
        const response = await axios.get<Card[]>(`${API_BASE_URL}/cards`, { params: filters });
        return response.data;
    } catch (error) {
        console.error('Error fetching cards:', error);
        throw error;
    }
};

export const fetchDecks = async (): Promise<Deck[]> => {
    try {
        const response = await axios.get<Deck[]>(`${API_BASE_URL}/decks`);
        return response.data;
    } catch (error) {
        console.error('Error fetching decks:', error);
        throw error;
    }
};

export const createDeck = async (deckData: Partial<Deck>): Promise<Deck> => {
    try {
        const response = await axios.post<Deck>(`${API_BASE_URL}/decks`, deckData);
        return response.data;
    } catch (error) {
        console.error('Error creating deck:', error);
        throw error;
    }
};