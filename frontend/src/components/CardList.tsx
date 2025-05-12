import React, { useEffect, useState } from 'react';
import { fetchCards, Card } from '../api';

const CardList: React.FC = () => {
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // useEffect(() => {
    //     const getCards = async () => {
    //         try {
    //             const data = await fetchCards();
    //             setCards(data);
    //         } catch (err) {
    //             if (err instanceof Error) {
    //                 setError(err.message);
    //             } else {
    //                 setError('Unknown error');
    //             }
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     getCards();
    // }, []);

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
                    <li key={card.id}>
                        <h3>{card.name}</h3>
                        {/* Adjust these fields to match your Card interface */}
                        {/* <p>Mana Cost: {card.manacost}</p>
                        <p>CMC: {card.cmc}</p>
                        <p>Type: {card.cardType}</p> */}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default CardList;