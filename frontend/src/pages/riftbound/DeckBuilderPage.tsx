import React, { useState } from "react";
import {
  fetchRbCards,
  fetchRbCard,
  fetchRbDeckList,
  fetchRbDeck,
  saveRbDeck,
  RbCard,
  RbDeckSummary,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import RbVisualStack, { DeckEntry } from "../../components/riftbound/RbVisualStack";
import RbDeckStats, { validateDeck } from "../../components/riftbound/RbDeckStats";
import { T } from "../../theme";

const FACTIONS = ["", "body", "calm", "chaos", "colorless", "fury", "mind", "order"];
const TYPES = ["", "Unit", "Spell", "Gear", "Rune", "Legend", "Battlefield"];
const RARITIES = ["", "common", "uncommon", "rare", "epic", "showcase"];
const SETS = ["", "OGN", "OGS", "SFD", "UNL"];

const DeckBuilderPage: React.FC = () => {
  const { username } = useAuth();
  const [searchName, setSearchName] = useState("");
  const [faction, setFaction] = useState("");
  const [cardType, setCardType] = useState("");
  const [rarity, setRarity] = useState("");
  const [set, setSet] = useState("");
  const [suggestions, setSuggestions] = useState<RbCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const [deckName, setDeckName] = useState("");
  const [champion, setChampion] = useState<RbCard | null>(null);
  const [mainDeck, setMainDeck] = useState<DeckEntry[]>([]);
  const [runeDeck, setRuneDeck] = useState<DeckEntry[]>([]);
  const [battlefields, setBattlefields] = useState<RbCard[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
      const idSet = new Set<string>();
      if (deck.champion) idSet.add(deck.champion);
      deck.main_deck?.forEach((e) => idSet.add(e.id));
      deck.rune_deck?.forEach((e) => idSet.add(e.id));
      deck.battlefields?.forEach((id) => idSet.add(id));

      const cardResults = await Promise.allSettled([...idSet].map(fetchRbCard));
      const cardMap = new Map<string, RbCard>();
      cardResults.forEach((r) => { if (r.status === "fulfilled") cardMap.set(r.value.id, r.value); });

      setDeckName(deck.name);
      setChampion(deck.champion ? (cardMap.get(deck.champion) ?? null) : null);
      setMainDeck((deck.main_deck ?? []).filter((e) => cardMap.has(e.id)).map((e) => ({ card: cardMap.get(e.id)!, count: e.count })));
      setRuneDeck((deck.rune_deck ?? []).filter((e) => cardMap.has(e.id)).map((e) => ({ card: cardMap.get(e.id)!, count: e.count })));
      setBattlefields((deck.battlefields ?? []).filter((id) => cardMap.has(id)).map((id) => cardMap.get(id)!));
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
      setSuggestions(await fetchRbCards({
        name: searchName || undefined,
        faction: faction || undefined,
        type: cardType || undefined,
        rarity: rarity || undefined,
        set: set || undefined,
      }));
    } finally {
      setSearching(false);
    }
  };

  const addCard = (card: RbCard) => {
    if (card.card_type === "Legend") { setChampion(card); return; }
    if (card.card_type === "Rune") { setRuneDeck((prev) => addOrIncrement(prev, card)); return; }
    if (card.card_type === "Battlefield") {
      setBattlefields((prev) => prev.find((c) => c.id === card.id) ? prev : [...prev, card]);
      return;
    }
    setMainDeck((prev) => addOrIncrement(prev, card));
  };

  const removeCard = (id: string, section: "main" | "rune") => {
    const setter = section === "main" ? setMainDeck : setRuneDeck;
    setter((prev) => {
      const idx = prev.findIndex((e) => e.card.id === id);
      if (idx === -1) return prev;
      if (prev[idx].count > 1) { const u = [...prev]; u[idx] = { ...u[idx], count: u[idx].count - 1 }; return u; }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const saveDeck = async () => {
    if (!deckName.trim()) return;
    try {
      await saveRbDeck({ name: deckName, format: "standard", champion: champion?.id, main_deck: mainDeck.map((e) => ({ id: e.card.id, count: e.count })), rune_deck: runeDeck.map((e) => ({ id: e.card.id, count: e.count })), battlefields: battlefields.map((c) => c.id) });
      setSaveMsg("Deck saved!");
    } catch { setSaveMsg("Save failed."); }
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const mainTotal = mainDeck.reduce((n, e) => n + e.count, 0);
  const runeTotal = runeDeck.reduce((n, e) => n + e.count, 0);
  const { valid: deckValid } = validateDeck(champion, mainDeck, runeDeck, battlefields);

  return (
    <div>
      <h1 style={{ color: T.purple, marginBottom: "1em" }}>Riftbound Deck Builder</h1>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "0.6em", alignItems: "center", marginBottom: "0.75em", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Deck name…"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          style={{ width: 200 }}
        />
        <button
          onClick={saveDeck}
          disabled={!username || !deckName.trim() || !deckValid}
          title={!username ? "Log in to save decks" : undefined}
          style={{
            padding: "0.5em 1.2em",
            background: !username || !deckName.trim() || !deckValid ? `${T.purple}33` : `${T.purple}CC`,
            color: !username || !deckName.trim() || !deckValid ? T.textDim : T.goldLight,
            border: `1px solid ${T.purple}88`,
            borderRadius: 4,
            fontWeight: 700,
            fontSize: "0.85em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: !username || !deckName.trim() || !deckValid ? "default" : "pointer",
          }}
        >
          Save Deck
        </button>
        {saveMsg && (
          <span style={{ fontSize: 13, color: saveMsg === "Deck saved!" ? T.green : "#E74C3C" }}>
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
      </div>

      {/* Load panel */}
      {loadOpen && (
        <div style={{ marginBottom: "1em", padding: "0.8em 1em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
          <select value={selectedDeck} onChange={(e) => setSelectedDeck(e.target.value)} style={{ width: "auto", minWidth: 220 }}>
            <option value="">— select a deck —</option>
            {savedDecks.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.format})</option>)}
          </select>
          <button
            onClick={loadDeck}
            disabled={!selectedDeck || loading}
            style={{ padding: "0.45em 1.1em", background: !selectedDeck || loading ? `${T.purple}33` : `${T.purple}CC`, color: T.goldLight, border: `1px solid ${T.purple}66`, borderRadius: 4, fontWeight: 700, fontSize: "0.85em", cursor: !selectedDeck || loading ? "default" : "pointer" }}
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {savedDecks.length === 0 && !loadError && <span style={{ color: T.textDim, fontSize: 13 }}>No saved decks yet.</span>}
          {loadError && <span style={{ color: "#E74C3C", fontSize: 13 }}>{loadError}</span>}
        </div>
      )}

      {/* Search bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5em", marginBottom: "1em", alignItems: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "0.7em 1em" }}>
        <input type="text" placeholder="Search cards…" value={searchName} onChange={(e) => setSearchName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} style={{ width: 180 }} />
        {[
          { value: faction, set: setFaction, opts: FACTIONS, label: "Factions" },
          { value: cardType, set: setCardType, opts: TYPES, label: "Types" },
          { value: rarity, set: setRarity, opts: RARITIES, label: "Rarities" },
          { value: set, set: setSet, opts: SETS, label: "Sets" },
        ].map(({ value, set: setter, opts, label }) => (
          <select key={label} value={value} onChange={(e) => setter(e.target.value)} style={{ width: "auto" }} aria-label={label}>
            <option value="">All {label}</option>
            {opts.filter(Boolean).map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        ))}
        <button onClick={search} disabled={searching} style={{ padding: "0.45em 1.2em", background: searching ? `${T.purple}44` : `${T.purple}CC`, color: T.goldLight, border: `1px solid ${T.purple}88`, borderRadius: 4, fontWeight: 700, fontSize: "0.85em", cursor: searching ? "default" : "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {searching ? "…" : "Search"}
        </button>
      </div>

      {/* Two-column: suggestions + deck list */}
      <div style={{ display: "flex", gap: "1.2em", alignItems: "flex-start" }}>
        {/* Suggestions */}
        <div style={{ flex: "1 1 300px", minWidth: 260, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "0.8em 1em" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.6em" }}>
            Results {suggestions.length > 0 && `(${suggestions.length})`}
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {suggestions.map((card) => (
              <div key={card.id} style={{ display: "flex", alignItems: "center", gap: "0.5em", padding: "0.35em 0", borderBottom: `1px solid ${T.border}`, position: "relative" }}>
                <span
                  style={{ fontWeight: 500, flex: 1, fontSize: 13, color: T.textBright, cursor: "default", position: "relative" }}
                  onMouseEnter={() => setHovered(card.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {card.name}
                  {hovered === card.id && (card.image_medium ?? card.image) && (
                    <img src={card.image_medium ?? card.image} alt={card.name} style={{ position: "absolute", left: "105%", top: 0, width: 180, zIndex: 50, borderRadius: 6, boxShadow: `0 4px 16px #000099`, border: `1px solid ${T.borderGold}` }} />
                  )}
                </span>
                <TypeBadge type={card.card_type} />
                <button onClick={() => addCard(card)} style={{ padding: "2px 8px", fontSize: 11, background: `${T.purple}33`, color: T.purple, border: `1px solid ${T.purple}55`, borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 }}>
                  {card.card_type === "Legend" ? "Champion" : "+"}
                </button>
              </div>
            ))}
            {suggestions.length === 0 && <div style={{ color: T.textDim, fontSize: 13, fontStyle: "italic", padding: "0.5em 0" }}>Search to find cards.</div>}
          </div>
        </div>

        {/* Deck list */}
        <div style={{ flex: "1 1 260px", minWidth: 220, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "0.8em 1em" }}>
          {champion && (
            <Section label="Champion" color={T.purple}>
              <DeckRow label={champion.name} onRemove={() => setChampion(null)} removeLabel="×" />
            </Section>
          )}
          {mainDeck.length > 0 && (
            <Section label={`Main Deck (${mainTotal})`}>
              {mainDeck.map(({ card, count }) => (
                <DeckRow key={card.id} label={`${card.name} ×${count}`} onRemove={() => removeCard(card.id, "main")} removeLabel="−" />
              ))}
            </Section>
          )}
          {runeDeck.length > 0 && (
            <Section label={`Rune Deck (${runeTotal})`}>
              {runeDeck.map(({ card, count }) => (
                <DeckRow key={card.id} label={`${card.name} ×${count}`} onRemove={() => removeCard(card.id, "rune")} removeLabel="−" />
              ))}
            </Section>
          )}
          {battlefields.length > 0 && (
            <Section label="Battlefields">
              {battlefields.map((card) => (
                <DeckRow key={card.id} label={card.name} onRemove={() => setBattlefields((p) => p.filter((c) => c.id !== card.id))} removeLabel="×" />
              ))}
            </Section>
          )}
          {mainTotal === 0 && !champion && (
            <div style={{ color: T.textDim, fontSize: 13, fontStyle: "italic" }}>Your deck is empty.</div>
          )}
        </div>
      </div>

      <RbDeckStats champion={champion} mainDeck={mainDeck} runeDeck={runeDeck} battlefields={battlefields} />
      <RbVisualStack champion={champion} mainDeck={mainDeck} runeDeck={runeDeck} battlefields={battlefields} />
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function addOrIncrement(prev: DeckEntry[], card: RbCard): DeckEntry[] {
  const idx = prev.findIndex((e) => e.card.id === card.id);
  if (idx !== -1) { const u = [...prev]; u[idx] = { ...u[idx], count: u[idx].count + 1 }; return u; }
  return [...prev, { card, count: 1 }];
}

const Section: React.FC<{ label: string; color?: string; children: React.ReactNode }> = ({ label, color, children }) => (
  <div style={{ marginBottom: "0.9em" }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: color ?? T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3em" }}>{label}</div>
    {children}
  </div>
);

const DeckRow: React.FC<{ label: string; onRemove: () => void; removeLabel: string }> = ({ label, onRemove, removeLabel }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.4em", fontSize: 13, padding: "0.1em 0" }}>
    <span style={{ flex: 1, color: T.text }}>{label}</span>
    <button onClick={onRemove} style={{ padding: "0 6px", fontSize: 14, background: "none", border: "none", cursor: "pointer", color: T.textDim, lineHeight: 1 }}>{removeLabel}</button>
  </div>
);

const TYPE_COLORS: Record<string, string> = {
  Unit: "#2ECC71", Spell: "#3498DB", Gear: "#E67E22",
  Rune: "#9B59B6", Legend: "#7B2FBE", Battlefield: "#7F8C8D",
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
  <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: `${TYPE_COLORS[type] ?? T.textDim}33`, color: TYPE_COLORS[type] ?? T.textDim, border: `1px solid ${TYPE_COLORS[type] ?? T.textDim}55`, fontWeight: 600, whiteSpace: "nowrap" }}>
    {type}
  </span>
);

export default DeckBuilderPage;
