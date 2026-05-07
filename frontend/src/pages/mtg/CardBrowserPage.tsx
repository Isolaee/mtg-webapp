import React, { useState } from "react";
import { fetchCards, Card } from "../../api";
import { T } from "../../theme";

const TYPES = ["", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Land", "Planeswalker", "Battle"];
const COLORS = [
  { value: "", label: "All Colors" },
  { value: "W", label: "White" },
  { value: "U", label: "Blue" },
  { value: "B", label: "Black" },
  { value: "R", label: "Red" },
  { value: "G", label: "Green" },
  { value: "C", label: "Colorless" },
];

const PREVIEW_W = 200;
const PREVIEW_H = 280;
const OFFSET = 16;

const CardBrowserPage: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [name, setName] = useState("");
  const [cardType, setCardType] = useState("");
  const [color, setColor] = useState("");

  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const search = async () => {
    if (!name.trim() && !cardType && !color) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const results = await fetchCards({
        name: name.trim() || undefined,
        type: cardType || undefined,
        color: color || undefined,
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

  const parseColors = (card: Card): string[] => {
    try {
      const parsed = JSON.parse(card.colors ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const previewLeft = mouse.x + OFFSET + PREVIEW_W < window.innerWidth
    ? mouse.x + OFFSET
    : mouse.x - PREVIEW_W - OFFSET;
  const previewTop = Math.max(10, Math.min(mouse.y - PREVIEW_H / 2, window.innerHeight - PREVIEW_H - 10));

  return (
    <div>
      <h1 style={{ marginBottom: "1em", color: T.blue }}>MTG Cards</h1>

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
          style={{ minWidth: 200, width: "auto" }}
        />
        <select value={cardType} onChange={(e) => setCardType(e.target.value)} aria-label="Type" style={{ width: "auto" }}>
          <option value="">All Types</option>
          {TYPES.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color" style={{ width: "auto" }}>
          {COLORS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          onClick={search}
          disabled={loading || (!name.trim() && !cardType && !color)}
          style={{
            padding: "0.5em 1.4em",
            background: loading || (!name.trim() && !cardType && !color) ? `${T.blue}44` : `${T.blue}CC`,
            color: T.bg,
            border: `1px solid ${T.blue}`,
            borderRadius: 4,
            cursor: loading || (!name.trim() && !cardType && !color) ? "default" : "pointer",
            fontWeight: 700,
            fontSize: "0.85em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {error && <div style={{ color: T.red, marginBottom: "0.75em" }}>{error}</div>}

      {searched && cards.length > 0 && (
        <div style={{ color: T.textDim, fontSize: "0.85em", marginBottom: "0.75em" }}>
          {cards.length} card{cards.length !== 1 ? "s" : ""} found
          {cards.length === 200 && " (showing first 200 — refine your search for more specific results)"}
        </div>
      )}

      {/* Results */}
      <div
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}
        onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPreview(null)}
      >
        {cards.map((card, i) => (
          <div
            key={card.name + i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75em",
              padding: "0.55em 1em",
              borderBottom: i < cards.length - 1 ? `1px solid ${T.border}` : "none",
            }}
            onMouseEnter={() => card.image ? setPreview({ src: card.image, alt: card.name }) : setPreview(null)}
          >
            <span style={{ fontWeight: 600, color: T.textBright, minWidth: 200, flex: "0 0 auto" }}>
              {card.name}
            </span>

            {card.manacost && (
              <span style={{ fontFamily: "monospace", fontSize: "0.78em", color: T.gold, whiteSpace: "nowrap", minWidth: 60 }}>
                {card.manacost}
              </span>
            )}

            <span style={{ display: "flex", gap: "0.2em", minWidth: 60 }}>
              {parseColors(card).map((c) => <ColorPip key={c} color={c} />)}
              {parseColors(card).length === 0 && card.cardType !== "Land" && <ColorPip color="C" />}
            </span>

            {card.cardType && (
              <span style={{ fontSize: "0.78em", padding: "0.15em 0.55em", borderRadius: 3, background: `${T.blue}22`, color: T.blue, border: `1px solid ${T.blue}44`, fontWeight: 600, whiteSpace: "nowrap" }}>
                {card.cardType}
              </span>
            )}

            {card.power != null && card.toughness != null && (
              <span style={{ fontSize: "0.8em", color: T.text, whiteSpace: "nowrap" }}>
                {card.power}/{card.toughness}
              </span>
            )}

            {card.cmc != null && card.cmc > 0 && (
              <span style={{ fontSize: "0.78em", color: T.textDim, whiteSpace: "nowrap" }}>
                CMC {card.cmc}
              </span>
            )}
          </div>
        ))}

        {!loading && searched && cards.length === 0 && (
          <div style={{ padding: "2em", color: T.textDim, fontStyle: "italic", textAlign: "center" }}>
            No cards found. Try a different search.
          </div>
        )}

        {!searched && (
          <div style={{ padding: "2em", color: T.textDim, fontStyle: "italic", textAlign: "center" }}>
            Enter a name, type, or color to search 34,000+ cards.
          </div>
        )}
      </div>

      {/* Fixed card preview — always in viewport */}
      {preview && (
        <img
          src={preview.src}
          alt={preview.alt}
          style={{
            position: "fixed",
            left: previewLeft,
            top: previewTop,
            width: PREVIEW_W,
            height: "auto",
            borderRadius: 10,
            border: `1px solid ${T.borderGold}`,
            boxShadow: "0 8px 32px #00000099",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

const COLOR_META: Record<string, { label: string; color: string }> = {
  W: { label: "W", color: "#F5F0C0" },
  U: { label: "U", color: "#3498DB" },
  B: { label: "B", color: "#9B59B6" },
  R: { label: "R", color: "#E74C3C" },
  G: { label: "G", color: "#2ECC71" },
  C: { label: "C", color: "#95A5A6" },
};

const ColorPip: React.FC<{ color: string }> = ({ color }) => {
  const meta = COLOR_META[color] ?? { label: color, color: T.textDim };
  return (
    <span
      title={meta.label}
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: `${meta.color}55`,
        border: `1.5px solid ${meta.color}`,
        fontSize: "0.6em",
        fontWeight: 700,
        lineHeight: "14px",
        textAlign: "center",
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
};

export default CardBrowserPage;
