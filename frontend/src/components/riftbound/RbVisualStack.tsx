import React, { useState } from "react";
import { RbCard } from "../../api";

export interface DeckEntry {
  card: RbCard;
  count: number;
}

interface RbVisualStackProps {
  champion: RbCard | null;
  mainDeck: DeckEntry[];
  runeDeck: DeckEntry[];
  battlefields: RbCard[];
}

const MAIN_TYPES = ["Unit", "Spell", "Gear"];

const cardImg = (card: RbCard) => card.image_medium ?? card.image ?? "";

const RbVisualStack: React.FC<RbVisualStackProps> = ({
  champion,
  mainDeck,
  runeDeck,
  battlefields,
}) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const isEmpty =
    !champion && mainDeck.length === 0 && runeDeck.length === 0;
  if (isEmpty) return null;

  // Group main deck by card_type
  const grouped: Record<string, DeckEntry[]> = {};
  MAIN_TYPES.forEach((t) => (grouped[t] = []));

  mainDeck.forEach((entry) => {
    const bucket = MAIN_TYPES.includes(entry.card.card_type)
      ? entry.card.card_type
      : "Unit"; // fallback
    grouped[bucket].push(entry);
  });

  const mainTotal = mainDeck.reduce((n, e) => n + e.count, 0);
  const runeTotal = runeDeck.reduce((n, e) => n + e.count, 0);

  return (
    <div>
      <h2>Visual Stack</h2>

      {/* Champion */}
      {champion && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5em" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#6d2a8c" }}>
              Champion
            </div>
            <img
              src={cardImg(champion)}
              alt={champion.name}
              style={{
                border: "4px solid #6d2a8c",
                borderRadius: 8,
                boxShadow: "0 0 14px #6d2a8c99",
                width: 100,
                height: 140,
                objectFit: "cover",
                background: "#f0e8f8",
                display: "block",
              }}
              title={champion.name}
            />
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>
              {champion.name}
            </div>
            <StatPill card={champion} />
          </div>
        </div>
      )}

      {/* Main deck stacks */}
      {mainTotal > 0 && (
        <>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            Main deck — {mainTotal} cards
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "2em",
              alignItems: "flex-start",
              marginBottom: "2em",
              flexWrap: "wrap",
            }}
          >
            {MAIN_TYPES.map((type) => {
              const entries = grouped[type];
              if (entries.length === 0) return null;
              const total = entries.reduce((n, e) => n + e.count, 0);

              return (
                <div
                  key={type}
                  style={{
                    minWidth: 90,
                    position: "relative",
                    height: 140 + (entries.length - 1) * 30,
                  }}
                >
                  <h4 style={{ textAlign: "center", marginBottom: 8, fontSize: 13 }}>
                    {type} ({total})
                  </h4>
                  <div
                    style={{
                      position: "relative",
                      width: 80,
                      height: 140 + (entries.length - 1) * 30,
                    }}
                  >
                    {entries.map(({ card, count }, idx) => (
                      <CardSlot
                        key={card.id}
                        card={card}
                        count={count}
                        idx={idx}
                        highlighted={highlighted}
                        onHighlight={setHighlighted}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Rune deck */}
      {runeDeck.length > 0 && (
        <div style={{ marginBottom: "2em" }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            Rune deck — {runeTotal} runes
          </div>
          <div style={{ display: "flex", gap: "0.75em", flexWrap: "wrap" }}>
            {runeDeck.map(({ card, count }) => (
              <div key={card.id} style={{ textAlign: "center" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img
                    src={cardImg(card)}
                    alt={card.name}
                    style={{
                      width: 56,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 5,
                      border: "2px solid #aaa",
                      boxShadow: "0 1px 4px #0003",
                      display: "block",
                    }}
                    title={card.name}
                  />
                  {count > 1 && (
                    <CountBadge count={count} />
                  )}
                </div>
                <div style={{ fontSize: 10, marginTop: 2, maxWidth: 56, lineHeight: 1.2 }}>
                  {card.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battlefields */}
      {battlefields.length > 0 && (
        <div style={{ marginBottom: "2em" }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            Battlefields
          </div>
          <div style={{ display: "flex", gap: "0.75em", flexWrap: "wrap" }}>
            {battlefields.map((card) => (
              <div key={card.id} style={{ textAlign: "center" }}>
                <img
                  src={cardImg(card)}
                  alt={card.name}
                  style={{
                    width: 120,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 5,
                    border: "2px solid #aaa",
                    boxShadow: "0 1px 4px #0003",
                    display: "block",
                  }}
                  title={card.name}
                />
                <div style={{ fontSize: 10, marginTop: 2 }}>{card.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface CardSlotProps {
  card: RbCard;
  count: number;
  idx: number;
  highlighted: string | null;
  onHighlight: (id: string | null) => void;
}

const CardSlot: React.FC<CardSlotProps> = ({
  card,
  count,
  idx,
  highlighted,
  onHighlight,
}) => {
  const isHighlighted = highlighted === card.id;
  return (
    <div
      style={{
        position: "absolute",
        top: idx * 30,
        left: isHighlighted ? 20 : 0,
        width: 80,
        zIndex: isHighlighted ? 1000 : idx + 1,
        transition: "left 0.15s",
      }}
    >
      <img
        src={cardImg(card)}
        alt={card.name}
        onClick={() => onHighlight(isHighlighted ? null : card.id)}
        style={{
          width: 80,
          height: 120,
          objectFit: "cover",
          borderRadius: 8,
          border: isHighlighted ? "3px solid #6d2a8c" : "2px solid #444",
          boxShadow: isHighlighted ? "0 0 10px #6d2a8c" : "0 2px 6px #aaa",
          cursor: "pointer",
          display: "block",
          background: "#f0e8f8",
          transition: "border 0.15s, box-shadow 0.15s",
        }}
        title={`${card.name}${count > 1 ? ` ×${count}` : ""}`}
      />
      {count > 1 && <CountBadge count={count} />}
    </div>
  );
};

const CountBadge: React.FC<{ count: number }> = ({ count }) => (
  <span
    style={{
      position: "absolute",
      top: 5,
      right: 5,
      background: "#222",
      color: "#fff",
      borderRadius: "50%",
      width: 16,
      height: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      fontWeight: 700,
      border: "2px solid #fff",
      boxShadow: "0 1px 3px #0008",
      zIndex: 1001,
    }}
  >
    {count}
  </span>
);

const StatPill: React.FC<{ card: RbCard }> = ({ card }) => {
  if (card.energy == null && card.might == null) return null;
  return (
    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
      {card.energy != null && `E:${card.energy}`}
      {card.energy != null && card.might != null && " · "}
      {card.might != null && `M:${card.might}`}
    </div>
  );
};

export default RbVisualStack;
