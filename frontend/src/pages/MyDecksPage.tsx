import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MtgDeckSummary,
  RbDeckSummary,
  fetchMtgDeckList,
  fetchRbDeckList,
  deleteMtgDeck,
  deleteRbDeck,
} from "../api";

type Tab = "mtg" | "riftbound";

const MyDecksPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("mtg");

  const [mtgDecks, setMtgDecks] = useState<MtgDeckSummary[]>([]);
  const [rbDecks, setRbDecks] = useState<RbDeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [mtg, rb] = await Promise.all([fetchMtgDeckList(), fetchRbDeckList()]);
        setMtgDecks(mtg);
        setRbDecks(rb);
      } catch {
        setError("Could not load decks.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDeleteMtg = async (name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteMtgDeck(name);
    setMtgDecks((prev) => prev.filter((d) => d.deck_name !== name));
  };

  const handleDeleteRb = async (name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteRbDeck(name);
    setRbDecks((prev) => prev.filter((d) => d.name !== name));
  };

  return (
    <div>
      <h1 style={{ marginBottom: "0.5em" }}>My Decks</h1>

      {/* Tab row */}
      <div style={{ display: "flex", gap: 0, marginBottom: "1.5em", borderBottom: "2px solid #ddd" }}>
        {(["mtg", "riftbound"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5em 1.4em",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: tab === t ? 700 : 400,
              fontSize: "0.95em",
              color: tab === t ? (t === "mtg" ? "#1a5276" : "#6d2a8c") : "#888",
              borderBottom: tab === t
                ? `3px solid ${t === "mtg" ? "#1a5276" : "#6d2a8c"}`
                : "3px solid transparent",
              marginBottom: -2,
            }}
          >
            {t === "mtg" ? "Magic: The Gathering" : "Riftbound"}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "#888" }}>Loading…</p>}
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}

      {!loading && !error && tab === "mtg" && (
        <DeckGrid
          decks={mtgDecks.map((d) => ({
            name: d.deck_name,
            description: d.deck_description,
            format: d.format,
          }))}
          color="#1a5276"
          emptyMsg="No MTG decks saved yet."
          builderPath="/create-deck"
          onDelete={(name) => handleDeleteMtg(name)}
          onLoad={() => navigate("/create-deck")}
        />
      )}

      {!loading && !error && tab === "riftbound" && (
        <DeckGrid
          decks={rbDecks.map((d) => ({
            name: d.name,
            description: d.description,
            format: d.format,
          }))}
          color="#6d2a8c"
          emptyMsg="No Riftbound decks saved yet."
          builderPath="/riftbound/deck-builder"
          onDelete={(name) => handleDeleteRb(name)}
          onLoad={() => navigate("/riftbound/deck-builder")}
        />
      )}
    </div>
  );
};

interface DeckRow {
  name: string;
  description?: string;
  format: string;
}

interface DeckGridProps {
  decks: DeckRow[];
  color: string;
  emptyMsg: string;
  builderPath: string;
  onDelete: (name: string) => void;
  onLoad: (name: string) => void;
}

const DeckGrid: React.FC<DeckGridProps> = ({ decks, color, emptyMsg, onDelete, onLoad }) => {
  if (decks.length === 0) {
    return <p style={{ color: "#aaa" }}>{emptyMsg}</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "1em",
      }}
    >
      {decks.map((deck) => (
        <div
          key={deck.name}
          style={{
            border: `1px solid ${color}33`,
            borderRadius: 8,
            padding: "1em 1.1em",
            background: "#fafafa",
            display: "flex",
            flexDirection: "column",
            gap: "0.4em",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1em", color: "#222" }}>
            {deck.name}
          </div>
          <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {deck.format}
          </div>
          {deck.description && (
            <div style={{ fontSize: 13, color: "#555", marginTop: "0.2em" }}>
              {deck.description}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5em", marginTop: "0.6em" }}>
            <button
              onClick={() => onLoad(deck.name)}
              style={{
                flex: 1,
                padding: "0.35em 0",
                background: color,
                color: "#fff",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Open Builder
            </button>
            <button
              onClick={() => onDelete(deck.name)}
              style={{
                padding: "0.35em 0.8em",
                background: "#fff",
                color: "#c0392b",
                border: "1px solid #c0392b",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyDecksPage;
