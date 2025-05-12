import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const fetchCards = async (filters) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/cards`, { params: filters });
        return response.data;
    } catch (error) {
        console.error('Error fetching cards:', error);
        throw error;
    }
};

export const fetchDecks = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/decks`);
        return response.data;
    } catch (error) {
        console.error('Error fetching decks:', error);
        throw error;
    }
};

export const createDeck = async (deckData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/decks`, deckData);
        return response.data;
    } catch (error) {
        console.error('Error creating deck:', error);
        throw error;
    }
};