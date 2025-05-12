import React, { useEffect, useState } from 'react';
import './App.css';
import CardList from './components/CardList';
import { fetchCards } from './api';

function App() {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadCards = async () => {
            try {
                const data = await fetchCards();
                setCards(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadCards();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className="App">
            <h1>Magic: The Gathering Cards</h1>
            <CardList cards={cards} />
        </div>
    );
}

export default App;