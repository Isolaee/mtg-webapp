import React, { useState } from "react";
import StackVisualizer from "../components/visualStack";
import LoadDeckForm from "../components/LoadDeckForm";
import DeckStats from "../components/DeckStats";

interface Card {
  name: string;
  image?: string;
  [key: string]: any;
}

const LoadDeckPage: React.FC = () => {
  const [deck, setDeck] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [format, setFormat] = useState("commander");
  const [commanderName, setCommanderName] = useState("");
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle file upload and parse deck
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null); // Clear previous error
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("deckfile", file);
    formData.append("format", format);
    formData.append("deck_name", deckName);
    formData.append("deck_description", deckDescription);
    if (format === "commander") {
      formData.append("commander_name", commanderName);
    }

    try {
      const res = await fetch("http://localhost:5000/api/upload_deck", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(
          err["msg, upload deck"] || err.msg || "Failed to upload deck file.",
        );
        return;
      }
      const data = await res.json();
      setDeck(data.cards); // Expecting backend to return { cards: [...] }
      setSelectedCard(null);
    } catch {
      setErrorMsg("Network error.");
    }
  };

  return (
    <div>
      <h1>Load Deck</h1>
      <LoadDeckForm
        format={format}
        setFormat={setFormat}
        commanderName={commanderName}
        setCommanderName={setCommanderName}
        deckName={deckName}
        setDeckName={setDeckName}
        deckDescription={deckDescription}
        setDeckDescription={setDeckDescription}
        onFileChange={handleFileChange}
      />
      {/* Deck view */}
      <div style={{ marginBottom: "1em" }}>
        <h2>Deck View</h2>
        <StackVisualizer
          cards={deck}
          format={format}
          commanderName={commanderName}
        />
        {/* DeckStats right below visual stack */}
        <DeckStats cards={deck} />
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
      {/* Error message */}
      {errorMsg && <div style={{ color: "red" }}>{errorMsg}</div>}
    </div>
  );
};

export default LoadDeckPage;
