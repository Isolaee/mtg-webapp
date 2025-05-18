import React, { useState } from "react";
import FindCardForm from "../components/FindCard";
import { Card } from "../api";

const CreateDeckPage: React.FC = () => {
  const [deck, setDeck] = useState<Card[]>([]);
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");

  const handleAddCards = (cards: Card[]) => {
    setDeck((prev) => [...prev, ...cards]);
  };

  const handleRemoveCard = (index: number) => {
    setDeck((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDeck = async () => {
    // Implement save logic here (e.g., call your backend API)
    alert(`Saving deck "${deckName}" with ${deck.length} cards!`);
  };

  return (
    <div>
      <h1>Create Deck</h1>
      <div style={{ marginBottom: "1em" }}>
        <input
          type="text"
          placeholder="Deck Name"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          style={{ marginRight: "1em" }}
        />
        <input
          type="text"
          placeholder="Deck Description"
          value={deckDescription}
          onChange={(e) => setDeckDescription(e.target.value)}
        />
      </div>
      <FindCardForm onCardsFound={handleAddCards} />
      <h2>Deck List</h2>
      <ul>
        {deck.map((card, idx) => (
          <li key={idx}>
            {card.name}
            <button
              style={{ marginLeft: "1em" }}
              onClick={() => handleRemoveCard(idx)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={handleSaveDeck}
        disabled={!deckName || deck.length === 0}
        style={{ marginTop: "1em" }}
      >
        Save Deck
      </button>
    </div>
  );
};

export default CreateDeckPage;
