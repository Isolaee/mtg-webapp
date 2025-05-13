import React, { useState } from "react";
import StackVisualizer from "../components/visualStack";

interface Card {
  name: string;
  image?: string;
  [key: string]: any;
}

const LoadDeckPage: React.FC = () => {
  const [deck, setDeck] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Handle file upload and parse deck
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("deckfile", file);

    try {
      const res = await fetch("http://localhost:5000/api/upload_deck", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        alert("Failed to upload deck file.");
        return;
      }
      const data = await res.json();
      setDeck(data.cards); // Expecting backend to return { cards: [...] }
      setSelectedCard(null);
    } catch {
      alert("Network error.");
    }
  };

  return (
    <div>
      <h1>Load Deck</h1>
      {/* File input */}
      <div style={{ marginBottom: "1em" }}>
        <label
          style={{
            display: "inline-block",
            padding: "0.5em 1em",
            background: "#1976d2",
            color: "#fff",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Load Deck File
          <input
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Deck view */}
      <div style={{ marginBottom: "1em" }}>
        <h2>Deck View</h2>
        <StackVisualizer
          images={deck
            .map((card) => card.image)
            .filter((img): img is string => Boolean(img))}
        />
        <div style={{ marginTop: "1em" }}>
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
      </div>

      {/* Card view */}
      <div>
        <h2>Card View</h2>
        {selectedCard ? (
          <div>
            <h3>{selectedCard.name}</h3>
            {selectedCard.image && (
              <img
                src={selectedCard.image}
                alt={selectedCard.name}
                style={{ maxWidth: 200, display: "block", marginBottom: "1em" }}
              />
            )}
            <pre style={{ background: "#eee", padding: "1em" }}>
              {JSON.stringify(selectedCard, null, 2)}
            </pre>
          </div>
        ) : (
          <div>Select a card to view details.</div>
        )}
      </div>
    </div>
  );
};

export default LoadDeckPage;
