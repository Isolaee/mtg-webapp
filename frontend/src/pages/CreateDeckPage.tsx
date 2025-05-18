import React, { useState } from "react";
import FindCardForm from "../components/FindCard";
import SuggestionList from "../components/foundCardsContainer";
import StackVisualizer from "../components/visualStack";
import DeckStats from "../components/DeckStats";
import { Card } from "../api";

interface DeckEntry {
  card: Card;
  count: number;
}

const CreateDeckPage: React.FC = () => {
  const [deck, setDeck] = useState<DeckEntry[]>([]);
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [suggestions, setSuggestions] = useState<Card[]>([]);

  const handleAddToDeck = (card: Card) => {
    setDeck((prev) => {
      const idx = prev.findIndex((entry) => entry.card.name === card.name);
      if (idx !== -1) {
        // Card already in deck, increment count
        const updated = [...prev];
        updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
        return updated;
      } else {
        // New card
        return [...prev, { card, count: 1 }];
      }
    });
  };

  const handleRemoveCard = (name: string) => {
    setDeck((prev) => {
      const idx = prev.findIndex((entry) => entry.card.name === name);
      if (idx !== -1) {
        if (prev[idx].count > 1) {
          // Decrement count
          const updated = [...prev];
          updated[idx] = { ...updated[idx], count: updated[idx].count - 1 };
          return updated;
        } else {
          // Remove card
          return prev.filter((entry) => entry.card.name !== name);
        }
      }
      return prev;
    });
  };

  const handleSaveDeck = async () => {
    // Implement save logic here (e.g., call your backend API)
    alert(
      `Saving deck "${deckName}" with ${deck.reduce(
        (sum, entry) => sum + entry.count,
        0,
      )} cards!`,
    );
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
      <FindCardForm onCardsFound={setSuggestions} />
      <SuggestionList suggestions={suggestions} onAddToDeck={handleAddToDeck} />
      <h2>Deck List</h2>
      <ul>
        {deck.map((entry) => (
          <li key={entry.card.name}>
            {entry.card.name} x{entry.count}
            <button
              style={{ marginLeft: "1em" }}
              onClick={() => handleRemoveCard(entry.card.name)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <StackVisualizer
        cards={deck.flatMap((entry) => Array(entry.count).fill(entry.card))}
        format="EDH"
        commanderName=""
      />
      <button
        onClick={handleSaveDeck}
        disabled={!deckName || deck.length === 0}
        style={{ marginTop: "1em" }}
      >
        Save Deck
      </button>
      {/* DeckStats below Save Deck button */}
      <DeckStats
        cards={deck.flatMap((entry) => Array(entry.count).fill(entry.card))}
      />
    </div>
  );
};

export default CreateDeckPage;
