import React, { useState } from "react";
import { fetchRbCards, RbCard } from "../../api";
import { T } from "../../theme";

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

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") search(); };

  const keywords = (card: RbCard): string[] => {
    try { return card.keywords ? JSON.parse(card.keywords) : []; }
    catch { return []; }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1em", color: T.purple }}>Riftbound Cards</h1>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5em",
          alignItems: "center",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: "0.8em 1em",
          marginBottom: "1.2em",
        }}
      >
        <input
          type="text"
          placeholder="Search by name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ minWidth: 180, width: "auto" }}
        />
        <FilterSelect label="Faction" value={faction} onChange={setFaction} options={FACTIONS} />
        <FilterSelect label="Type" value={cardType} onChange={setCardType} options={TYPES} />
        <FilterSelect label="Rarity" value={rarity} onChange={setRarity} options={RARITIES} />
        <FilterSelect label="Set" value={set} onChange={setSet} options={SETS} />
        <button
          onClick={search}
          disabled={loading}
          style={{
            padding: "0.5em 1.4em",
            background: loading ? `${T.purple}44` : `${T.purple}CC`,
            color: T.goldLight,
            border: `1px solid ${T.purple}`,
            borderRadius: 4,
            cursor: loading ? "default" : "pointer",
            fontWeight: 700,
            fontSize: "0.85em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <div style={{ color: "#E74C3C", marginBottom: "0.75em" }}>{error}</div>}

      {cards.length > 0 && (
        <div style={{ color: T.textDim, fontSize: "0.85em", marginBottom: "0.75em" }}>
          {cards.length} card{cards.length !== 1 ? "s" : ""} found
        </div>
      )}

      {/* Results list */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75em",
              padding: "0.55em 1em",
              borderBottom: i < cards.length - 1 ? `1px solid ${T.border}` : "none",
              position: "relative",
            }}
          >
            {/* Hover preview */}
            <span
              style={{ fontWeight: 600, color: T.textBright, cursor: "default", position: "relative", minWidth: 160 }}
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
                    width: 220,
                    height: "auto",
                    border: `1px solid ${T.borderGold}`,
                    background: T.surface,
                    zIndex: 100,
                    boxShadow: "0 4px 20px #00000099",
                    borderRadius: 6,
                  }}
                />
              )}
            </span>

            <CardBadge text={card.faction} color={factionColor(card.faction)} />
            <CardBadge text={card.card_type} color={T.textDim} />
            <CardBadge text={card.rarity} color={rarityColor(card.rarity)} />
            <span style={{ color: T.textDim, fontSize: "0.8em" }}>{card.set_id}</span>

            {(card.energy != null || card.might != null) && (
              <span style={{ fontSize: "0.8em", color: T.text }}>
                {card.energy != null && `E:${card.energy}`}
                {card.energy != null && card.might != null && " / "}
                {card.might != null && `M:${card.might}`}
              </span>
            )}

            {keywords(card).slice(0, 3).map((kw) => (
              <span
                key={kw}
                style={{
                  fontSize: "0.72em",
                  padding: "0.1em 0.5em",
                  borderRadius: 3,
                  background: `${T.purple}33`,
                  color: T.purple,
                  border: `1px solid ${T.purple}44`,
                  whiteSpace: "nowrap",
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        ))}

        {cards.length === 0 && !loading && (
          <div style={{ padding: "2em", color: T.textDim, fontStyle: "italic", textAlign: "center" }}>
            Use the filters above to search for cards.
          </div>
        )}
      </div>
    </div>
  );
};

interface FilterSelectProps { label: string; value: string; onChange: (v: string) => void; options: string[]; }

const FilterSelect: React.FC<FilterSelectProps> = ({ label, value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ width: "auto" }}>
    <option value="">All {label}s</option>
    {options.filter(Boolean).map((o) => (
      <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
    ))}
  </select>
);

const CardBadge: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <span
    style={{
      fontSize: "0.73em",
      padding: "0.15em 0.55em",
      borderRadius: 3,
      background: `${color}33`,
      color,
      border: `1px solid ${color}55`,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </span>
);

function factionColor(faction: string): string {
  const map: Record<string, string> = {
    fury: "#E74C3C", mind: "#3498DB", body: "#2ECC71",
    calm: "#1ABC9C", chaos: "#9B59B6", order: "#F1C40F", colorless: "#95A5A6",
  };
  return map[faction] ?? T.textDim;
}

function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    common: "#7F8C8D", uncommon: "#2ECC71", rare: "#3498DB",
    epic: "#9B59B6", showcase: "#E67E22",
  };
  return map[rarity] ?? T.textDim;
}

export default CardBrowserPage;
