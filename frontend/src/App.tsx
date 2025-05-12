import React, { useEffect, useState } from 'react';
import './App.css';
import { fetchCards, Card } from './api';

interface CardListProps {
    cards: Card[];
}

function CardList({ cards }: CardListProps) {
    return (
        <ul>
            {cards.map(card => (
                <li key={card.id}>{card.name}</li>
            ))}
        </ul>
    );
}

function App() {
    const [cards, setCards] = useState<Card[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // useEffect(() => {
    //     const loadCards = async () => {
    //         setLoading(true);
    //         try {
    //             const data = await fetchCards();
    //             setCards(data);
    //         } catch (err) {
    //             if (err instanceof Error) {
    //                 setError(err.message);
    //             } else {
    //                 setError('An unknown error occurred');
    //             }
    //         } finally {
    //             setLoading(false);
    //         }
    //     };
    //     loadCards();
    // }, []);

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