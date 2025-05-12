import React, { useEffect, useState } from 'react';
import { fetchCards } from '../api';

const CardList = () => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getCards = async () => {
            try {
                const data = await fetchCards();
                setCards(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        getCards();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div>
            <h2>Card List</h2>
            <ul>
                {cards.map((card) => (
                    <li key={card.name}>
                        <h3>{card.name}</h3>
                        <p>Mana Cost: {card.manacost}</p>
                        <p>CMC: {card.cmc}</p>
                        <p>Type: {card.cardType}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default CardList;