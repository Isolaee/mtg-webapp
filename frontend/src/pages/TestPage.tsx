import React, { useState } from "react";
import { Card } from "../api";
import StackVisualizer from "../components/visualStack";
import FindCardForm from "../components/FindCard";

function TestPageFindCard() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const handleAddCards = (cards: Card[]) => {
    setDeck((prev) => [...prev, ...cards]);
  };

  return (
    <div>
      <h1>Test Page: Find and Visualize Cards</h1>
      <FindCardForm onCardsFound={handleAddCards} />
      <div style={{ margin: "2em 0" }}>
        <StackVisualizer
          cards={deck}
          format="EDH"
          commanderName={deck.length > 0 ? deck[0].name : ""}
        />
      </div>
      <div>
        <h2>Deck List</h2>
        {deck.map((card, idx) => (
          <button
            key={idx}
            style={{ margin: "0.25em" }}
            onClick={() => setSelectedCard(card)}
          >
            {card.name}
          </button>
        ))}
      </div>
      {selectedCard && (
        <div>
          <h3>{selectedCard.name}</h3>
          {selectedCard.image && (
            <img
              src={selectedCard.image}
              alt={selectedCard.name}
              style={{ maxWidth: 200, display: "block", marginBottom: "1em" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default TestPageFindCard;
