import React, { useState } from "react";
import { Card } from "../api";
import { T } from "../theme";

interface FoundCardsProps {
  suggestions: Card[];
  onAddToDeck: (card: Card) => void;
  format?: string;
  commanderName?: string;
  onAddCommander?: (card: Card) => void;
}

const FoundCardsContainer: React.FC<FoundCardsProps> = ({
  suggestions,
  onAddToDeck,
  format,
  commanderName,
  onAddCommander,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.2em" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5em" }}>
        Results ({suggestions.length})
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, maxHeight: 360, overflowY: "auto" }}>
        {suggestions.map((card) => (
          <div
            key={card.name}
            style={{ display: "flex", alignItems: "center", gap: "0.6em", padding: "0.4em 0.8em", borderBottom: `1px solid ${T.border}`, position: "relative" }}
          >
            <span
              style={{ fontWeight: 500, flex: 1, fontSize: 13, color: T.textBright, cursor: "default", position: "relative" }}
              onMouseEnter={() => setHovered(card.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {card.name}
              {hovered === card.name && card.image && (
                <img
                  src={card.image}
                  alt={card.name}
                  style={{ position: "absolute", left: "110%", top: 0, width: 180, zIndex: 50, borderRadius: 6, border: `1px solid ${T.borderGold}`, boxShadow: "0 4px 16px #000099" }}
                />
              )}
            </span>
            <button
              onClick={() => onAddToDeck(card)}
              style={{ padding: "2px 10px", fontSize: 12, background: `${T.blue}33`, color: T.blue, border: `1px solid ${T.blue}55`, borderRadius: 3, cursor: "pointer", fontWeight: 600 }}
            >
              Add
            </button>
            {format === "commander" && !commanderName && onAddCommander && (
              <button
                onClick={() => onAddCommander(card)}
                style={{ padding: "2px 8px", fontSize: 12, background: `${T.gold}22`, color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Commander
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FoundCardsContainer;
