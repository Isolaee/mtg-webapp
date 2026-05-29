import React, { useState } from "react";
import { T } from "../theme";

interface Card {
  name: string;
  image?: string;
  typeline?: string;
  cardType?: string;
  isCommander?: boolean;
}

interface StackVisualizerProps {
  cards: Card[];
  format?: string;
  commanderName?: string;
}

const MAJOR_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"];

function getMajorType(card: Card): string | null {
  if (card.cardType) {
    const found = MAJOR_TYPES.find((type) => card.cardType!.toLowerCase().includes(type.toLowerCase()));
    return found || null;
  }
  return null;
}

const StackVisualizer: React.FC<StackVisualizerProps> = ({ cards, format, commanderName }) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [view, setView] = useState<"stack" | "grid">("stack");

  const showCommander = format === "commander" && commanderName;
  const commanderCard = showCommander
    ? cards.find((card) => card.name.trim().toLowerCase() === commanderName!.trim().toLowerCase())
    : null;

  const filteredCards = showCommander
    ? cards.filter((card) => card.name.trim().toLowerCase() !== commanderName!.trim().toLowerCase())
    : cards;

  const grouped: { [type: string]: Card[] } = {};
  MAJOR_TYPES.forEach((type) => { grouped[type] = []; });
  filteredCards.forEach((card) => {
    const majorType = getMajorType(card);
    if (majorType) grouped[majorType].push(card);
  });

  if (filteredCards.length === 0 && !commanderCard) return null;

  return (
    <div style={{ marginTop: "1.5em" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.8em", marginBottom: "1em" }}>
        <h2 style={{ color: T.gold, fontSize: "1.1em", margin: 0 }}>
          {view === "stack" ? "Visual Stack" : "Visual Grid"}
        </h2>
        <div style={{ display: "flex", gap: 4 }}>
          {(["stack", "grid"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "0.25em 0.8em",
                background: view === v ? `${T.gold}CC` : "transparent",
                color: view === v ? T.bg : T.textBright,
                border: `1px solid ${view === v ? T.gold : T.border}`,
                borderRadius: 4,
                fontWeight: 600,
                fontSize: "0.75em",
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Commander */}
      {showCommander && commanderCard && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5em" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Commander</div>
            <img
              src={commanderCard.image}
              alt={commanderCard.name}
              style={{ border: `3px solid ${T.gold}`, borderRadius: 8, boxShadow: `0 0 16px ${T.gold}88`, width: 100, height: 140, background: T.surface2, marginBottom: 4 }}
              title={commanderCard.name}
            />
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{commanderCard.name}</div>
          </div>
        </div>
      )}

      {view === "stack" ? (
        <div style={{ display: "flex", flexDirection: "row", gap: "2em", alignItems: "flex-start", justifyContent: "center", marginBottom: "3em", flexWrap: "wrap" }}>
          {MAJOR_TYPES.map((type) => {
            const uniqueCards = countUnique(grouped[type]);
            if (uniqueCards.length === 0) return null;

            return (
              <div key={type} style={{ minWidth: 90, position: "relative", height: 140 + (uniqueCards.length - 1) * 30 }}>
                <h4 style={{ textAlign: "center", marginBottom: 8, fontSize: 12, color: T.textDim, fontFamily: "Cinzel, serif" }}>
                  {type} ({grouped[type].length})
                </h4>
                <div style={{ position: "relative", width: 80, height: 140 + (uniqueCards.length - 1) * 30 }}>
                  {uniqueCards.map(({ card, count }, idx) => (
                    <div
                      key={card.name}
                      style={{ position: "absolute", top: idx * 30, left: highlighted === card.name ? 20 : 0, width: 80, zIndex: highlighted === card.name ? 1000 : 1, transition: "left 0.2s" }}
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        onClick={() => setHighlighted(highlighted === card.name ? null : card.name)}
                        style={{ border: highlighted === card.name ? `3px solid ${T.blue}` : `2px solid ${T.border}`, borderRadius: 8, boxShadow: highlighted === card.name ? `0 0 12px ${T.blue}` : "0 2px 6px #00000066", cursor: "pointer", width: 80, height: 120, background: T.surface2, transition: "border 0.2s, box-shadow 0.2s", display: "block" }}
                        title={card.name}
                      />
                      {count > 1 && (
                        <span style={{ position: "absolute", top: 5, right: 5, background: T.gold, color: T.bg, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, boxShadow: "0 1px 4px #0008", zIndex: 1001 }}>
                          {count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ marginBottom: "3em" }}>
          {MAJOR_TYPES.map((type) => {
            const uniqueCards = countUnique(grouped[type]);
            if (uniqueCards.length === 0) return null;
            return (
              <div key={type} style={{ marginBottom: "1.2em" }}>
                <h4 style={{ marginBottom: 8, fontSize: 12, color: T.textDim, fontFamily: "Cinzel, serif" }}>
                  {type} ({grouped[type].length})
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {uniqueCards.map(({ card, count }) => (
                    <div key={card.name} style={{ position: "relative", width: 80 }}>
                      <img
                        src={card.image}
                        alt={card.name}
                        style={{ width: 80, height: 120, borderRadius: 8, border: `2px solid ${T.border}`, boxShadow: "0 2px 6px #00000066", background: T.surface2, display: "block" }}
                        title={card.name}
                      />
                      {count > 1 && (
                        <span style={{ position: "absolute", top: 5, right: 5, background: T.gold, color: T.bg, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, boxShadow: "0 1px 4px #0008" }}>
                          {count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Collapse duplicate cards into { card, count }, preserving first-seen order.
function countUnique(cards: Card[]): { card: Card; count: number }[] {
  const map: { [name: string]: { card: Card; count: number } } = {};
  const order: string[] = [];
  cards.forEach((card) => {
    if (map[card.name]) map[card.name].count += 1;
    else {
      map[card.name] = { card, count: 1 };
      order.push(card.name);
    }
  });
  return order.map((name) => map[name]);
}

export default StackVisualizer;
