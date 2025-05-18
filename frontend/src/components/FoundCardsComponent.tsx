import React, { useState } from "react";
import { Card } from "../api";

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

  return (
    <div>
      <h2>Suggestions</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {suggestions.map((card) => (
          <li
            key={card.name}
            style={{ position: "relative", marginBottom: "1em" }}
          >
            <span
              style={{
                fontWeight: 500,
                cursor: "pointer",
                position: "relative",
              }}
              onMouseEnter={() => setHovered(card.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {card.name}
              {hovered === card.name && card.image && (
                <img
                  src={card.image}
                  alt={card.name}
                  style={{
                    position: "absolute",
                    left: "120%",
                    top: 0,
                    width: 180,
                    height: "auto",
                    border: "1px solid #333",
                    background: "#fff",
                    zIndex: 10,
                    boxShadow: "0 2px 8px #0005",
                  }}
                />
              )}
            </span>
            <button
              style={{ marginLeft: "1em" }}
              onClick={() => onAddToDeck(card)}
            >
              Add
            </button>
            {format === "commander" && !commanderName && onAddCommander && (
              <button
                style={{ marginLeft: "0.5em" }}
                onClick={() => onAddCommander(card)}
              >
                Add as Commander
              </button>
            )}
          </li>
        ))}
        {suggestions.length === 0 && <li>No suggestions yet.</li>}
      </ul>
    </div>
  );
};

export default FoundCardsContainer;
