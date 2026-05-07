import React, { useState } from "react";
import {
  fetchRbCards,
  fetchRbCard,
  fetchRbDeckList,
  fetchRbDeck,
  RbCard,
  RbDeckSummary,
} from "../../api";
import RbVisualStack, { DeckEntry } from "../../components/riftbound/RbVisualStack";
import RbDeckStats, { validateDeck } from "../../components/riftbound/RbDeckStats";

const FACTIONS = ["", "body", "calm", "chaos", "colorless", "fury", "mind", "order"];
const TYPES = ["", "Unit", "Spell", "Gear", "Rune", "Legend", "Battlefield"];
const RARITIES = ["", "common", "uncommon", "rare", "epic", "showcase"];
const SETS = ["", "OGN", "OGS", "SFD", "UNL"];

const API_BASE = "http://localhost:8080/api";

const DeckBuilderPage: React.FC = () => {
  // Search
  const [searchName, setSearchName] = useState("");
  const [faction, setFaction] = useState("");
  const [cardType, setCardType] = useState("");
  const [rarity, setRarity] = useState("");
  const [set, setSet] = useState("");
  const [suggestions, setSuggestions] = useState<RbCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  // Deck state
  const [deckName, setDeckName] = useState("");
  const [champion, setChampion] = useState<RbCard | null>(null);
  const [mainDeck, setMainDeck] = useState<DeckEntry[]>([]);
  const [runeDeck, setRuneDeck] = useState<DeckEntry[]>([]);
  const [battlefields, setBattlefields] = useState<RbCard[]>([]);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Load deck state
  const [savedDecks, setSavedDecks] = useState<RbDeckSummary[]>([]);
  const [selectedDeck, setSelectedDeck] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openLoadPanel = async () => {
    setLoadOpen(true);
    setLoadError(null);
    try {
      setSavedDecks(await fetchRbDeckList());
    } catch {
      setLoadError("Could not fetch saved decks.");
    }
  };

  const loadDeck = async () => {
    if (!selectedDeck) return;
    setLoading(true);
    setLoadError(null);
    try {
      const deck = await fetchRbDeck(selectedDeck);

      // Collect all unique card IDs so we can fetch them in one pass
      const idSet = new Set<string>();
      if (deck.champion) idSet.add(deck.champion);
      deck.main_deck?.forEach((e) => idSet.add(e.id));
      deck.rune_deck?.forEach((e) => idSet.add(e.id));
      deck.battlefields?.forEach((id) => idSet.add(id));

      // Fetch all cards in parallel, skip any that 404
      const cardResults = await Promise.allSettled(
        [...idSet].map((id) => fetchRbCard(id)),
      );
      const cardMap = new Map<string, RbCard>();
      cardResults.forEach((r) => {
        if (r.status === "fulfilled") cardMap.set(r.value.id, r.value);
      });

      // Reconstruct deck state
      setDeckName(deck.name);
      setChampion(deck.champion ? (cardMap.get(deck.champion) ?? null) : null);
      setMainDeck(
        (deck.main_deck ?? [])
          .filter((e) => cardMap.has(e.id))
          .map((e) => ({ card: cardMap.get(e.id)!, count: e.count })),
      );
      setRuneDeck(
        (deck.rune_deck ?? [])
          .filter((e) => cardMap.has(e.id))
          .map((e) => ({ card: cardMap.get(e.id)!, count: e.count })),
      );
      setBattlefields(
        (deck.battlefields ?? [])
          .filter((id) => cardMap.has(id))
          .map((id) => cardMap.get(id)!),
      );
      setLoadOpen(false);
      setSelectedDeck("");
    } catch {
      setLoadError("Failed to load deck.");
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    setSearching(true);
    try {
      const results = await fetchRbCards({
        name: searchName || undefined,
        faction: faction || undefined,
        type: cardType || undefined,
        rarity: rarity || undefined,
        set: set || undefined,
      });
      setSuggestions(results);
    } finally {
      setSearching(false);
    }
  };

  const addCard = (card: RbCard) => {
    if (card.card_type === "Legend") {
      setChampion(card);
      return;
    }
    if (card.card_type === "Rune") {
      setRuneDeck((prev) => addOrIncrement(prev, card));
      return;
    }
    if (card.card_type === "Battlefield") {
      setBattlefields((prev) =>
        prev.find((c) => c.id === card.id) ? prev : [...prev, card],
      );
      return;
    }
    setMainDeck((prev) => addOrIncrement(prev, card));
  };

  const removeCard = (id: string, section: "main" | "rune") => {
    const setter = section === "main" ? setMainDeck : setRuneDeck;
    setter((prev) => {
      const idx = prev.findIndex((e) => e.card.id === id);
      if (idx === -1) return prev;
      if (prev[idx].count > 1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], count: updated[idx].count - 1 };
        return updated;
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const saveDeck = async () => {
    if (!deckName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/rb/decks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deckName,
          format: "standard",
          champion: champion?.id ?? null,
          main_deck: mainDeck.map((e) => ({ id: e.card.id, count: e.count })),
          rune_deck: runeDeck.map((e) => ({ id: e.card.id, count: e.count })),
          battlefields: battlefields.map((c) => c.id),
        }),
      });
      const data = await res.json();
      setSaveMsg(res.ok ? "Deck saved!" : data.error ?? "Save failed.");
    } catch {
      setSaveMsg("Network error.");
    }
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const mainTotal = mainDeck.reduce((n, e) => n + e.count, 0);
  const runeTotal = runeDeck.reduce((n, e) => n + e.count, 0);
  const { valid: deckValid } = validateDeck(champion, mainDeck, runeDeck, battlefields);

  return (
    <div>
      <h1>Riftbound Deck Builder</h1>

      {/* Deck name */}
      <div style={{ marginBottom: "1em" }}>
        <input
          type="text"
          placeholder="Deck name"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          style={{ padding: "0.4em 0.6em", border: "1px solid #ccc", borderRadius: 4, marginRight: "0.5em" }}
        />
        <button
          onClick={saveDeck}
          disabled={!deckName.trim() || !deckValid}
          style={{
            padding: "0.4em 1em",
            background: "#6d2a8c",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Save Deck
        </button>
        {saveMsg && (
          <span style={{ marginLeft: "0.75em", color: saveMsg === "Deck saved!" ? "green" : "red" }}>
            {saveMsg}
          </span>
        )}
        <button
          onClick={loadOpen ? () => setLoadOpen(false) : openLoadPanel}
          style={{
            marginLeft: "0.75em",
            padding: "0.4em 1em",
            background: "#eee",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {loadOpen ? "Cancel" : "Load Deck"}
        </button>
      </div>

      {/* Load deck panel */}
      {loadOpen && (
        <div
          style={{
            marginBottom: "1em",
            padding: "0.75em 1em",
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "#fafafa",
            display: "flex",
            gap: "0.5em",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
            style={{ padding: "0.4em 0.5em", border: "1px solid #ccc", borderRadius: 4, minWidth: 200 }}
          >
            <option value="">— select a deck —</option>
            {savedDecks.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name} ({d.format})
              </option>
            ))}
          </select>
          <button
            onClick={loadDeck}
            disabled={!selectedDeck || loading}
            style={{
              padding: "0.4em 1em",
              background: "#6d2a8c",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: selectedDeck && !loading ? "pointer" : "default",
              fontWeight: 600,
            }}
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {savedDecks.length === 0 && !loadError && (
            <span style={{ color: "#aaa", fontSize: 13 }}>No saved decks yet.</span>
          )}
          {loadError && <span style={{ color: "red", fontSize: 13 }}>{loadError}</span>}
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5em", marginBottom: "0.75em", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search cards"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{ padding: "0.4em 0.6em", border: "1px solid #ccc", borderRadius: 4, minWidth: 160 }}
        />
        <select value={faction} onChange={(e) => setFaction(e.target.value)} style={selectStyle}>
          <option value="">All Factions</option>
          {FACTIONS.filter(Boolean).map((f) => <option key={f} value={f}>{cap(f)}</option>)}
        </select>
        <select value={cardType} onChange={(e) => setCardType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} style={selectStyle}>
          <option value="">All Rarities</option>
          {RARITIES.filter(Boolean).map((r) => <option key={r} value={r}>{cap(r)}</option>)}
        </select>
        <select value={set} onChange={(e) => setSet(e.target.value)} style={selectStyle}>
          <option value="">All Sets</option>
          {SETS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={search} disabled={searching} style={searchBtnStyle}>
          {searching ? "…" : "Search"}
        </button>
      </div>

      {/* Two-column layout: suggestions left, deck list right */}
      <div style={{ display: "flex", gap: "2em", alignItems: "flex-start" }}>
        {/* Suggestions */}
        <div style={{ flex: "1 1 300px", minWidth: 260 }}>
          <h3 style={{ fontSize: 14, margin: "0 0 0.5em" }}>
            Results {suggestions.length > 0 && `(${suggestions.length})`}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 480, overflowY: "auto" }}>
            {suggestions.map((card) => (
              <li
                key={card.id}
                style={{ display: "flex", alignItems: "center", gap: "0.5em", padding: "0.3em 0", borderBottom: "1px solid #f0f0f0", position: "relative" }}
              >
                <span
                  style={{ fontWeight: 500, cursor: "default", flex: 1, fontSize: 13, position: "relative" }}
                  onMouseEnter={() => setHovered(card.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {card.name}
                  {hovered === card.id && (card.image_medium ?? card.image) && (
                    <img
                      src={card.image_medium ?? card.image}
                      alt={card.name}
                      style={{
                        position: "absolute",
                        left: "105%",
                        top: 0,
                        width: 180,
                        zIndex: 50,
                        borderRadius: 6,
                        boxShadow: "0 2px 10px #0005",
                        border: "1px solid #ccc",
                      }}
                    />
                  )}
                </span>
                <TypeBadge type={card.card_type} />
                <button onClick={() => addCard(card)} style={addBtnStyle}>
                  {card.card_type === "Legend" ? "Set Champion" : "Add"}
                </button>
              </li>
            ))}
            {suggestions.length === 0 && (
              <li style={{ color: "#aaa", fontSize: 13, fontStyle: "italic" }}>Search to find cards.</li>
            )}
          </ul>
        </div>

        {/* Deck list */}
        <div style={{ flex: "1 1 260px", minWidth: 220 }}>
          {/* Champion */}
          {champion && (
            <div style={{ marginBottom: "0.75em" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6d2a8c", marginBottom: 2 }}>Champion</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
                <span style={{ fontSize: 13 }}>{champion.name}</span>
                <button onClick={() => setChampion(null)} style={removeBtnStyle}>×</button>
              </div>
            </div>
          )}

          {/* Main deck */}
          {mainDeck.length > 0 && (
            <div style={{ marginBottom: "0.75em" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Main Deck ({mainTotal})</div>
              {mainDeck.map(({ card, count }) => (
                <div key={card.id} style={{ display: "flex", alignItems: "center", gap: "0.4em", fontSize: 13, padding: "0.1em 0" }}>
                  <span style={{ flex: 1 }}>{card.name} ×{count}</span>
                  <button onClick={() => removeCard(card.id, "main")} style={removeBtnStyle}>−</button>
                </div>
              ))}
            </div>
          )}

          {/* Rune deck */}
          {runeDeck.length > 0 && (
            <div style={{ marginBottom: "0.75em" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Rune Deck ({runeTotal})</div>
              {runeDeck.map(({ card, count }) => (
                <div key={card.id} style={{ display: "flex", alignItems: "center", gap: "0.4em", fontSize: 13, padding: "0.1em 0" }}>
                  <span style={{ flex: 1 }}>{card.name} ×{count}</span>
                  <button onClick={() => removeCard(card.id, "rune")} style={removeBtnStyle}>−</button>
                </div>
              ))}
            </div>
          )}

          {/* Battlefields */}
          {battlefields.length > 0 && (
            <div style={{ marginBottom: "0.75em" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Battlefields</div>
              {battlefields.map((card) => (
                <div key={card.id} style={{ display: "flex", alignItems: "center", gap: "0.4em", fontSize: 13, padding: "0.1em 0" }}>
                  <span style={{ flex: 1 }}>{card.name}</span>
                  <button onClick={() => setBattlefields((p) => p.filter((c) => c.id !== card.id))} style={removeBtnStyle}>×</button>
                </div>
              ))}
            </div>
          )}

          {mainTotal === 0 && !champion && (
            <div style={{ color: "#aaa", fontSize: 13, fontStyle: "italic" }}>Your deck is empty.</div>
          )}
        </div>
      </div>

      {/* Stats + validation */}
      <RbDeckStats
        champion={champion}
        mainDeck={mainDeck}
        runeDeck={runeDeck}
        battlefields={battlefields}
      />

      {/* Visual stack */}
      <RbVisualStack
        champion={champion}
        mainDeck={mainDeck}
        runeDeck={runeDeck}
        battlefields={battlefields}
      />
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function addOrIncrement(prev: DeckEntry[], card: RbCard): DeckEntry[] {
  const idx = prev.findIndex((e) => e.card.id === card.id);
  if (idx !== -1) {
    const updated = [...prev];
    updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
    return updated;
  }
  return [...prev, { card, count: 1 }];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TYPE_COLORS: Record<string, string> = {
  Unit: "#27ae60",
  Spell: "#2980b9",
  Gear: "#e67e22",
  Rune: "#8e44ad",
  Legend: "#6d2a8c",
  Battlefield: "#7f8c8d",
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
  <span style={{
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 3,
    background: TYPE_COLORS[type] ?? "#555",
    color: "#fff",
    fontWeight: 600,
    whiteSpace: "nowrap",
  }}>
    {type}
  </span>
);

const selectStyle: React.CSSProperties = {
  padding: "0.4em 0.5em",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: 13,
};

const searchBtnStyle: React.CSSProperties = {
  padding: "0.4em 1em",
  background: "#6d2a8c",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontWeight: 600,
};

const addBtnStyle: React.CSSProperties = {
  padding: "1px 8px",
  fontSize: 12,
  background: "#eee",
  border: "1px solid #ccc",
  borderRadius: 3,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const removeBtnStyle: React.CSSProperties = {
  padding: "0 6px",
  fontSize: 14,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#999",
  lineHeight: 1,
};

export default DeckBuilderPage;
