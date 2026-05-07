import React, { useState } from "react";
import { fetchRbCards, RbCard } from "../../api";

const FACTIONS = ["", "body", "calm", "chaos", "colorless", "fury", "mind", "order"];
const TYPES = ["", "Unit", "Spell", "Gear", "Rune", "Legend", "Battlefield"];
const RARITIES = ["", "common", "uncommon", "rare", "epic", "showcase"];
const SETS = ["", "OGN", "OGS", "SFD", "UNL"];

const CardBrowserPage: React.FC = () => {
  const [cards, setCards] = useState<RbCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [faction, setFaction] = useState("");
  const [cardType, setCardType] = useState("");
  const [rarity, setRarity] = useState("");
  const [set, setSet] = useState("");

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchRbCards({
        name: name || undefined,
        faction: faction || undefined,
        type: cardType || undefined,
        rarity: rarity || undefined,
        set: set || undefined,
      });
      setCards(results);
    } catch {
      setError("Failed to fetch cards.");
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  const keywords = (card: RbCard): string[] => {
    try {
      return card.keywords ? JSON.parse(card.keywords) : [];
    } catch {
      return [];
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "0.75em" }}>Riftbound Cards</h1>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5em",
          marginBottom: "1em",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search by name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ padding: "0.4em 0.6em", border: "1px solid #ccc", borderRadius: 4, minWidth: 180 }}
        />
        <FilterSelect label="Faction" value={faction} onChange={setFaction} options={FACTIONS} />
        <FilterSelect label="Type" value={cardType} onChange={setCardType} options={TYPES} />
        <FilterSelect label="Rarity" value={rarity} onChange={setRarity} options={RARITIES} />
        <FilterSelect label="Set" value={set} onChange={setSet} options={SETS} />
        <button
          onClick={search}
          disabled={loading}
          style={{
            padding: "0.4em 1.2em",
            background: "#6d2a8c",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "default" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginBottom: "0.75em" }}>{error}</div>}

      {/* Results */}
      {cards.length > 0 && (
        <div style={{ marginBottom: "0.5em", color: "#555", fontSize: "0.9em" }}>
          {cards.length} card{cards.length !== 1 ? "s" : ""} found
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {cards.map((card) => (
          <li
            key={card.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75em",
              padding: "0.4em 0",
              borderBottom: "1px solid #eee",
              position: "relative",
            }}
          >
            {/* Hover preview */}
            <span
              style={{ fontWeight: 500, cursor: "default", position: "relative" }}
              onMouseEnter={() => setHovered(card.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {card.name}
              {hovered === card.id && (card.image_medium || card.image) && (
                <img
                  src={card.image_medium ?? card.image}
                  alt={card.name}
                  style={{
                    position: "absolute",
                    left: "110%",
                    top: 0,
                    width: 200,
                    height: "auto",
                    border: "1px solid #333",
                    background: "#fff",
                    zIndex: 10,
                    boxShadow: "0 2px 8px #0005",
                    borderRadius: 6,
                  }}
                />
              )}
            </span>

            <CardBadge text={card.faction} color={factionColor(card.faction)} />
            <CardBadge text={card.card_type} color="#555" />
            <CardBadge text={card.rarity} color={rarityColor(card.rarity)} />
            <span style={{ color: "#888", fontSize: "0.82em" }}>{card.set_id}</span>

            {/* Stats */}
            {(card.energy != null || card.might != null) && (
              <span style={{ fontSize: "0.82em", color: "#444" }}>
                {card.energy != null && `E:${card.energy}`}
                {card.energy != null && card.might != null && " / "}
                {card.might != null && `M:${card.might}`}
              </span>
            )}

            {/* Keywords */}
            {keywords(card).map((kw) => (
              <span
                key={kw}
                style={{
                  fontSize: "0.75em",
                  padding: "0.1em 0.4em",
                  borderRadius: 3,
                  background: "#e8e8e8",
                  color: "#333",
                }}
              >
                {kw}
              </span>
            ))}
          </li>
        ))}
        {cards.length === 0 && !loading && (
          <li style={{ color: "#888", fontStyle: "italic" }}>
            Use the filters above to search for cards.
          </li>
        )}
      </ul>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}

const FilterSelect: React.FC<FilterSelectProps> = ({ label, value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{ padding: "0.4em 0.5em", border: "1px solid #ccc", borderRadius: 4 }}
    aria-label={label}
  >
    <option value="">All {label}s</option>
    {options.filter(Boolean).map((o) => (
      <option key={o} value={o}>
        {o.charAt(0).toUpperCase() + o.slice(1)}
      </option>
    ))}
  </select>
);

const CardBadge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span
    style={{
      fontSize: "0.78em",
      padding: "0.1em 0.5em",
      borderRadius: 3,
      background: color,
      color: "#fff",
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </span>
);

function factionColor(faction: string): string {
  const map: Record<string, string> = {
    fury: "#c0392b",
    mind: "#2980b9",
    body: "#27ae60",
    calm: "#16a085",
    chaos: "#8e44ad",
    order: "#d4ac0d",
    colorless: "#7f8c8d",
  };
  return map[faction] ?? "#555";
}

function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    common: "#7f8c8d",
    uncommon: "#2ecc71",
    rare: "#2980b9",
    epic: "#9b59b6",
    showcase: "#e67e22",
  };
  return map[rarity] ?? "#555";
}

export default CardBrowserPage;
