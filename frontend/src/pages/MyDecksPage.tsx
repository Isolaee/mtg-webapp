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
import { T } from "../theme";

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
    setMtgDecks((prev) => prev.filter((d) => d.name !== name));
  };

  const handleDeleteRb = async (name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await deleteRbDeck(name);
    setRbDecks((prev) => prev.filter((d) => d.name !== name));
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1.2em" }}>My Decks</h1>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: "1.8em" }}>
        {(["mtg", "riftbound"] as Tab[]).map((t) => {
          const c = t === "mtg" ? T.blue : T.purple;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0.55em 1.4em",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: tab === t ? 700 : 400,
                fontSize: "0.85em",
                fontFamily: "Cinzel, serif",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: tab === t ? c : T.textDim,
                borderBottom: tab === t ? `2px solid ${c}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t === "mtg" ? "Magic: The Gathering" : "Riftbound"}
            </button>
          );
        })}
      </div>

      {loading && <p style={{ color: T.textDim }}>Loading…</p>}
      {error && <p style={{ color: "#E74C3C" }}>{error}</p>}

      {!loading && !error && tab === "mtg" && (
        <DeckGrid
          decks={mtgDecks.map((d) => ({ name: d.name, description: d.description, format: d.format }))}
          color={T.blue}
          emptyMsg="No MTG decks saved yet. Head to the deck builder to get started."
          onDelete={handleDeleteMtg}
          onOpen={() => navigate("/deck-builder")}
        />
      )}

      {!loading && !error && tab === "riftbound" && (
        <DeckGrid
          decks={rbDecks.map((d) => ({ name: d.name, description: d.description, format: d.format }))}
          color={T.purple}
          emptyMsg="No Riftbound decks saved yet. Head to the deck builder to get started."
          onDelete={handleDeleteRb}
          onOpen={() => navigate("/riftbound/deck-builder")}
        />
      )}

      {/* Hint text */}
      {!loading && !error && (
        <p style={{ color: T.textDim, fontSize: 13, marginTop: "2em" }}>
          To load a specific deck into the builder, open the builder and use the Load Deck panel.
        </p>
      )}
    </div>
  );
};

interface DeckRow { name: string; description?: string; format: string; }

const DeckGrid: React.FC<{
  decks: DeckRow[];
  color: string;
  emptyMsg: string;
  onDelete: (name: string) => void;
  onOpen: () => void;
}> = ({ decks, color, emptyMsg, onDelete, onOpen }) => {
  if (decks.length === 0) {
    return <p style={{ color: T.textDim, fontStyle: "italic" }}>{emptyMsg}</p>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1em" }}>
      {decks.map((deck) => (
        <div
          key={deck.name}
          style={{
            background: T.surface,
            border: `1px solid ${color}33`,
            borderLeft: `3px solid ${color}`,
            borderRadius: 6,
            padding: "1em 1.2em",
            display: "flex",
            flexDirection: "column",
            gap: "0.35em",
          }}
        >
          <div style={{ fontWeight: 700, color: T.textBright, fontFamily: "Cinzel, serif", fontSize: "0.95em" }}>
            {deck.name}
          </div>
          <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {deck.format}
          </div>
          {deck.description && (
            <div style={{ fontSize: 13, color: T.text, marginTop: "0.2em" }}>{deck.description}</div>
          )}
          <div style={{ display: "flex", gap: "0.5em", marginTop: "0.6em" }}>
            <button
              onClick={onOpen}
              style={{
                flex: 1,
                padding: "0.35em 0",
                background: `${color}22`,
                color,
                border: `1px solid ${color}55`,
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Open Builder
            </button>
            <button
              onClick={() => onDelete(deck.name)}
              style={{
                padding: "0.35em 0.8em",
                background: "transparent",
                color: "#E74C3C",
                border: "1px solid #E74C3C55",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
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
