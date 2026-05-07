import React, { useState, useEffect } from "react";
import FindCardForm from "../../components/FindCard";
import FoundCardsComponent from "../../components/FoundCardsComponent";
import StackVisualizer from "../../components/visualStack";
import DeckStats from "../../components/DeckStats";
import FormatSelection from "../../components/FormatSelection";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  MtgDeckSummary,
  fetchMtgDeckList,
  fetchMtgDeck,
  saveMtgDeck,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

const API_BASE_URL = process.env.REACT_APP_API_URL ?? "http://localhost:8080/api";

interface DeckEntry {
  card: Card;
  count: number;
}

const DeckBuilderPage: React.FC = () => {
  const { username } = useAuth();
  const [searchParams] = useSearchParams();
  const [deck, setDeck] = useState<DeckEntry[]>([]);
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [format, setFormat] = useState("commander");
  const [commander, setCommander] = useState<Card | null>(null);
  const [suggestions, setSuggestions] = useState<Card[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [savedDecks, setSavedDecks] = useState<MtgDeckSummary[]>([]);
  const [selectedDeck, setSelectedDeck] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const preload = searchParams.get("load");
    if (!preload) return;
    setLoading(true);
    fetchMtgDeck(preload)
      .then((d) => {
        setDeckName(d.name);
        setDeckDescription(d.description ?? "");
        setFormat(d.format);
        setCommander(d.commander ?? null);
        const entryMap = new Map<string, DeckEntry>();
        for (const card of d.cards) {
          const existing = entryMap.get(card.name);
          entryMap.set(card.name, { card, count: (existing?.count ?? 0) + 1 });
        }
        setDeck([...entryMap.values()]);
      })
      .catch(() => setLoadError("Failed to load deck."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openLoadPanel = async () => {
    setLoadOpen(true);
    setLoadError(null);
    try {
      setSavedDecks(await fetchMtgDeckList());
    } catch {
      setLoadError("Could not fetch saved decks.");
    }
  };

  const loadDeck = async () => {
    if (!selectedDeck) return;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await fetchMtgDeck(selectedDeck);
      setDeckName(d.name);
      setDeckDescription(d.description ?? "");
      setFormat(d.format);
      setCommander(d.commander ?? null);
      // cards array has duplicates — group into entries with counts
      const entryMap = new Map<string, DeckEntry>();
      for (const card of d.cards) {
        const existing = entryMap.get(card.name);
        if (existing) {
          entryMap.set(card.name, { card, count: existing.count + 1 });
        } else {
          entryMap.set(card.name, { card, count: 1 });
        }
      }
      setDeck([...entryMap.values()]);
      setLoadOpen(false);
      setSelectedDeck("");
    } catch {
      setLoadError("Failed to load deck.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("deckfile", file);
    formData.append("format", format);
    formData.append("deck_name", deckName);
    if (format === "commander" && commander) {
      formData.append("commander_name", commander.name);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/upload_deck`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.name && !deckName) setDeckName(data.name);
      if (data.commander) setCommander(data.commander);
      const entryMap = new Map<string, DeckEntry>();
      for (const card of data.cards ?? []) {
        const existing = entryMap.get(card.name);
        if (existing) {
          entryMap.set(card.name, { card, count: existing.count + 1 });
        } else {
          entryMap.set(card.name, { card, count: 1 });
        }
      }
      setDeck([...entryMap.values()]);
    } catch {}
    // reset file input so the same file can be re-imported
    e.target.value = "";
  };

  const handleAddCard = (card: Card) => {
    setDeck((prev) => {
      const idx = prev.findIndex((e) => e.card.name === card.name);
      if (idx !== -1) {
        const u = [...prev];
        u[idx] = { ...u[idx], count: u[idx].count + 1 };
        return u;
      }
      return [...prev, { card, count: 1 }];
    });
  };

  const handleRemoveCard = (name: string) => {
    setDeck((prev) => {
      const idx = prev.findIndex((e) => e.card.name === name);
      if (idx === -1) return prev;
      if (prev[idx].count > 1) {
        const u = [...prev];
        u[idx] = { ...u[idx], count: u[idx].count - 1 };
        return u;
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSetCommander = (card: Card) => {
    setCommander(card);
  };

  const handleSave = async () => {
    if (!deckName.trim()) return;
    try {
      await saveMtgDeck({
        name: deckName,
        format,
        description: deckDescription || undefined,
        commander: commander ?? undefined,
        cards: deck.flatMap((e) => Array(e.count).fill(e.card)),
      });
      setSaveMsg("Deck saved!");
    } catch {
      setSaveMsg("Save failed.");
    }
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const allCards = deck.flatMap((e) => Array(e.count).fill(e.card));
  const totalCount = deck.reduce((n, e) => n + e.count, 0);

  return (
    <div>
      <h1 style={{ marginBottom: "0.8em" }}>MTG Deck Builder</h1>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "0.6em", alignItems: "center", marginBottom: "0.75em", flexWrap: "wrap" }}>
        <FormatSelection value={format} onChange={setFormat} />
        <input
          type="text"
          placeholder="Deck name…"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          style={{ width: 180 }}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={deckDescription}
          onChange={(e) => setDeckDescription(e.target.value)}
          style={{ width: 200 }}
        />
        <button
          onClick={handleSave}
          disabled={!username || !deckName.trim()}
          title={!username ? "Log in to save decks" : undefined}
          style={{
            padding: "0.5em 1.2em",
            background: !username || !deckName.trim() ? `${T.blue}33` : `${T.blue}CC`,
            color: !username || !deckName.trim() ? T.textDim : T.bg,
            border: `1px solid ${T.blue}88`,
            borderRadius: 4,
            fontWeight: 700,
            fontSize: "0.85em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: !username || !deckName.trim() ? "default" : "pointer",
          }}
        >
          Save Deck
        </button>
        {saveMsg && (
          <span style={{ fontSize: 13, color: saveMsg === "Deck saved!" ? T.green : T.red }}>
            {saveMsg}
          </span>
        )}
        {!username && (
          <span style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>
            Log in to save or load decks
          </span>
        )}
        <button
          onClick={loadOpen ? () => setLoadOpen(false) : openLoadPanel}
          disabled={!username}
          title={!username ? "Log in to load saved decks" : undefined}
          style={{
            padding: "0.5em 1.2em",
            background: "transparent",
            color: username ? T.gold : T.textDim,
            border: `1px solid ${username ? T.gold : T.border}55`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: username ? "pointer" : "default",
          }}
        >
          {loadOpen ? "Cancel" : "Load Deck"}
        </button>
        <label
          style={{
            padding: "0.5em 1.1em",
            background: "transparent",
            color: T.textDim,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: "pointer",
          }}
        >
          Import File
          <input type="file" accept=".txt" onChange={handleFileImport} style={{ display: "none" }} />
        </label>
      </div>

      {/* Load panel */}
      {loadOpen && (
        <div style={{ marginBottom: "1em", padding: "0.8em 1em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
            style={{ width: "auto", minWidth: 220 }}
          >
            <option value="">— select a deck —</option>
            {savedDecks.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.format})
              </option>
            ))}
          </select>
          <button
            onClick={loadDeck}
            disabled={!selectedDeck || loading}
            style={{
              padding: "0.45em 1.1em",
              background: !selectedDeck || loading ? `${T.blue}33` : `${T.blue}CC`,
              color: T.bg,
              border: `1px solid ${T.blue}66`,
              borderRadius: 4,
              fontWeight: 700,
              fontSize: "0.85em",
              cursor: !selectedDeck || loading ? "default" : "pointer",
            }}
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {savedDecks.length === 0 && !loadError && (
            <span style={{ color: T.textDim, fontSize: 13 }}>No saved decks yet.</span>
          )}
          {loadError && <span style={{ color: T.red, fontSize: 13 }}>{loadError}</span>}
        </div>
      )}

      {/* Commander field */}
      {format === "commander" && (
        <div style={{ marginBottom: "0.75em", fontSize: 13, color: T.textDim }}>
          Commander:{" "}
          {commander ? (
            <span style={{ color: T.gold, fontWeight: 600 }}>
              {commander.name}{" "}
              <button
                onClick={() => setCommander(null)}
                style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 13, padding: "0 4px" }}
              >
                ×
              </button>
            </span>
          ) : (
            <span style={{ fontStyle: "italic" }}>none — search a card and click Commander</span>
          )}
        </div>
      )}

      {/* Card search */}
      <FindCardForm onCardsFound={setSuggestions} />
      <FoundCardsComponent
        suggestions={suggestions}
        onAddToDeck={handleAddCard}
        format={format}
        commanderName={commander?.name}
        onAddCommander={handleSetCommander}
      />

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
              <button
                onClick={() => handleRemoveCard(entry.card.name)}
                style={{ padding: "1px 7px", background: "none", border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: "pointer", fontSize: 13 }}
              >
                −
              </button>
            </div>
          ))}
        </div>
      )}

      <DeckStats cards={allCards} />
      <StackVisualizer cards={allCards} format={format} commanderName={commander?.name ?? ""} />
    </div>
  );
};

export default DeckBuilderPage;
