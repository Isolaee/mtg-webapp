import React, { useState } from "react";
import StackVisualizer from "../components/visualStack";
import LoadDeckForm from "../components/LoadDeckForm";
import DeckStats from "../components/DeckStats";
import { T } from "../theme";

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("deckfile", file);
    formData.append("format", format);
    formData.append("deck_name", deckName);
    formData.append("deck_description", deckDescription);
    if (format === "commander") formData.append("commander_name", commanderName);
    try {
      const res = await fetch("http://localhost:8080/api/upload_deck", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); setErrorMsg(err.msg || "Failed to upload."); return; }
      const data = await res.json();
      setDeck(data.cards);
      setSelectedCard(null);
    } catch { setErrorMsg("Network error."); }
  };

  const handleDeckLoaded = (deckData: any) => {
    setDeck(deckData.cards || []);
    setFormat(deckData.format || "commander");
    setCommanderName(deckData.commander_name || "");
    setDeckName(deckData.deck_name || "");
    setDeckDescription(deckData.deck_description || "");
    setSelectedCard(null);
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1em" }}>Load Deck</h1>

      <LoadDeckForm
        format={format} setFormat={setFormat}
        commanderName={commanderName} setCommanderName={setCommanderName}
        deckName={deckName} setDeckName={setDeckName}
        deckDescription={deckDescription} setDeckDescription={setDeckDescription}
        onFileChange={handleFileChange}
        onDeckLoaded={handleDeckLoaded}
      />

      {errorMsg && <div style={{ color: "#E74C3C", marginBottom: "1em", fontSize: 13 }}>{errorMsg}</div>}

      {deck.length > 0 && (
        <>
          <DeckStats cards={deck} />
          <StackVisualizer cards={deck} format={format} commanderName={commanderName} />

          {/* Card list */}
          <div style={{ marginTop: "1.5em" }}>
            <h2 style={{ fontSize: "1.05em", marginBottom: "0.6em" }}>Card List ({deck.length})</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}>
              {deck.map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCard(card)}
                  style={{
                    padding: "0.25em 0.7em",
                    fontSize: 12,
                    background: selectedCard?.name === card.name ? `${T.blue}33` : T.surface,
                    color: selectedCard?.name === card.name ? T.blue : T.text,
                    border: `1px solid ${selectedCard?.name === card.name ? T.blue : T.border}`,
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {card.name}
                </button>
              ))}
            </div>
          </div>

          {/* Card detail */}
          {selectedCard && (
            <div style={{ marginTop: "1.5em", background: T.surface, border: `1px solid ${T.borderGold}44`, borderRadius: 6, padding: "1.2em 1.4em", display: "flex", gap: "1.5em", flexWrap: "wrap" }}>
              {selectedCard.image && (
                <img src={selectedCard.image} alt={selectedCard.name} style={{ width: 160, borderRadius: 8, border: `2px solid ${T.border}` }} />
              )}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: "0.5em" }}>{selectedCard.name}</h3>
                {selectedCard.typeline && <div style={{ color: T.textDim, fontSize: 13, marginBottom: "0.4em" }}>{selectedCard.typeline}</div>}
                {selectedCard.oracleText && <div style={{ color: T.text, fontSize: 13, lineHeight: 1.6, maxWidth: 340 }}>{selectedCard.oracleText}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LoadDeckPage;
