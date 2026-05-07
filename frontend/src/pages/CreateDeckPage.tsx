import React, { useState } from "react";
import FindCardForm from "../components/FindCard";
import FoundCardsComponent from "../components/FoundCardsComponent";
import StackVisualizer from "../components/visualStack";
import DeckStats from "../components/DeckStats";
import FormatSelection from "../components/FormatSelection";
import { Card } from "../api";
import { T } from "../theme";

interface DeckEntry {
  card: Card;
  count: number;
}

const CreateDeckPage: React.FC = () => {
  const [deck, setDeck] = useState<DeckEntry[]>([]);
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [format, setFormat] = useState("commander");
  const [suggestions, setSuggestions] = useState<Card[]>([]);
  const [commanderName, setCommanderName] = useState("");

  const handleAddToDeck = (card: Card) => {
    setDeck((prev) => {
      const idx = prev.findIndex((e) => e.card.name === card.name);
      if (idx !== -1) { const u = [...prev]; u[idx] = { ...u[idx], count: u[idx].count + 1 }; return u; }
      return [...prev, { card, count: 1 }];
    });
  };

  const handleRemoveCard = (name: string) => {
    setDeck((prev) => {
      const idx = prev.findIndex((e) => e.card.name === name);
      if (idx !== -1) {
        if (prev[idx].count > 1) { const u = [...prev]; u[idx] = { ...u[idx], count: u[idx].count - 1 }; return u; }
        return prev.filter((e) => e.card.name !== name);
      }
      return prev;
    });
  };

  const allCards = deck.flatMap((e) => Array(e.count).fill(e.card));
  const totalCount = deck.reduce((n, e) => n + e.count, 0);

  return (
    <div>
      <h1 style={{ marginBottom: "1em" }}>Create Deck</h1>

      {/* Deck metadata */}
      <div style={{ display: "flex", gap: "0.75em", flexWrap: "wrap", alignItems: "center", marginBottom: "1em" }}>
        <FormatSelection value={format} onChange={setFormat} />
        <input type="text" placeholder="Deck name…" value={deckName} onChange={(e) => setDeckName(e.target.value)} style={{ width: 200 }} />
        <input type="text" placeholder="Description (optional)" value={deckDescription} onChange={(e) => setDeckDescription(e.target.value)} style={{ width: 240 }} />
      </div>

      {/* Card search */}
      <FindCardForm onCardsFound={setSuggestions} />
      <FoundCardsComponent suggestions={suggestions} onAddToDeck={handleAddToDeck} format={format} commanderName={commanderName} onAddCommander={(card) => setCommanderName(card.name)} />

      {/* Deck list */}
      {deck.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "1em 1.2em", marginBottom: "1em" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.6em" }}>
            Deck List ({totalCount} cards)
          </div>
          {deck.map((entry) => (
            <div key={entry.card.name} style={{ display: "flex", alignItems: "center", gap: "0.5em", padding: "0.2em 0", fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
              <span style={{ flex: 1, color: T.textBright }}>{entry.card.name}</span>
              <span style={{ color: T.gold, fontWeight: 700, minWidth: 28, textAlign: "right" }}>×{entry.count}</span>
              <button onClick={() => handleRemoveCard(entry.card.name)} style={{ padding: "1px 7px", background: "none", border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: "pointer", fontSize: 13 }}>−</button>
            </div>
          ))}
        </div>
      )}

      <DeckStats cards={allCards} />
      <StackVisualizer cards={allCards} format={format} commanderName={commanderName} />
    </div>
  );
};

export default CreateDeckPage;
