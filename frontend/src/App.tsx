import React, { useState } from "react";
import "./App.css";
import { fetchCards, Card } from "./api";

function App() {
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fieldsToShow = [
    "name",
    "manacost",
    "cmc",
    "typeline",
    "artist",
    "power",
    "toughness",
    "oracleText",
  ];

  const handleShowCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCards({ name });
      setCards(data);
    } catch (err) {
      setError("Error fetching cards");
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Magic: The Gathering Web App</h1>
      <input
        type="text"
        placeholder="Enter a name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ border: "1px solid black", padding: "0.5em" }}
      />
      <button
        onClick={handleShowCard}
        style={{
          marginLeft: "0.5em",
          border: "1px solid black",
          padding: "0.5em",
        }}
        disabled={loading}
      >
        {loading ? "Loading..." : "Show Card"}
      </button>
      <div
        style={{
          marginTop: "1em",
          minHeight: "2em",
          border: "1px solid black",
          padding: "0.5em",
        }}
      >
        {error && <span style={{ color: "red" }}>{error}</span>}
        {!error && cards.length === 0 && !loading && <span>No card found</span>}
        {cards.map((card, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: "1em",
              borderBottom: "1px solid #ccc",
              paddingBottom: "1em",
            }}
          >
            {fieldsToShow.map(
              (key) =>
                card[key as keyof Card] !== undefined && (
                  <div key={key}>
                    <strong>{key}:</strong> {String(card[key as keyof Card])}
                  </div>
                ),
            )}
            {/* Show image if present */}
            {card.image && (
              <div style={{ marginTop: "0.5em" }}>
                <img
                  src={card.image}
                  alt={card.name}
                  style={{ maxWidth: "200px", border: "1px solid #888" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
