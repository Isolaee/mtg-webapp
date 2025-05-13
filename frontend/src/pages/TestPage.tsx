import React, { useState } from "react";
import { fetchCards, Card } from "../api";
import StackVisualizer from "../components/visualStack";

function TestPageFindCard() {
  const [name, setName] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  // Extract only the image URLs (filter out undefined)
  const imageUrls = cards
    .map((card) => card.image)
    .filter((img): img is string => Boolean(img));

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
      </div>
      {/* Visual stack of images */}
      <StackVisualizer images={imageUrls} />
    </div>
  );
}

export default TestPageFindCard;
