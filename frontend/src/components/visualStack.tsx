import React, { useState } from "react";

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

const MAJOR_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
];

function getMajorType(card: Card): string | null {
  // Only check cardType for major types
  if (card.cardType) {
    const found = MAJOR_TYPES.find((type) =>
      card.cardType!.toLowerCase().includes(type.toLowerCase()),
    );
    return found || null;
  }
  return null;
}

const StackVisualizer: React.FC<StackVisualizerProps> = ({
  cards,
  format,
  commanderName,
}) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Find the commander card (case-insensitive)
  const commanderCard = commanderName
    ? cards.find(
        (card) =>
          card.name.trim().toLowerCase() === commanderName.trim().toLowerCase(),
      )
    : null;

  // Exclude commander from all stacks if commanderName is set
  let filteredCards = cards;
  if (commanderName) {
    filteredCards = cards.filter(
      (card) =>
        card.name.trim().toLowerCase() !== commanderName.trim().toLowerCase(),
    );
  }

  // Group cards by major type
  const grouped: { [type: string]: Card[] } = {};
  MAJOR_TYPES.forEach((type) => {
    grouped[type] = [];
  });
  filteredCards.forEach((card) => {
    const majorType = getMajorType(card);
    if (majorType) {
      grouped[majorType].push(card);
    }
  });

  return filteredCards.length === 0 && !commanderCard ? null : (
    <div>
      <h2>Visual Stack</h2>
      {/* Commander card display */}
      {commanderCard && (
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: "1em" }}
        >
          <div style={{ marginRight: "2em", textAlign: "left" }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>Commander</div>
            <img
              src={commanderCard.image}
              alt={commanderCard.name}
              style={{
                border: "4px solid #ff9800",
                borderRadius: 8,
                boxShadow: "0 0 12px #ff9800",
                width: 100,
                height: 140,
                background: "#fff",
                marginBottom: 4,
              }}
              title={commanderCard.name}
            />
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              {commanderCard.name}
            </div>
          </div>
          {/* The rest of the stack will follow to the right */}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "2em",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        {MAJOR_TYPES.map((type) => {
          // Sort so highlighted card is last (on top)
          const sortedCards = [...grouped[type]];
          if (highlighted) {
            sortedCards.sort((a, b) =>
              a.name === highlighted ? 1 : b.name === highlighted ? -1 : 0,
            );
          }
          return (
            <div
              key={type}
              style={{
                minWidth: 90,
                position: "relative",
                height: 140 + (grouped[type].length - 1) * 30,
              }}
            >
              <h4 style={{ textAlign: "center", marginBottom: 8 }}>
                {type} ({grouped[type].length})
              </h4>
              <div
                style={{
                  position: "relative",
                  width: 80,
                  height: 140 + (grouped[type].length - 1) * 30,
                }}
              >
                {sortedCards.map((card, idx) => {
                  // Find the original index for stacking
                  const origIdx = grouped[type].findIndex((c) => c === card);
                  return (
                    <img
                      key={card.name + origIdx}
                      src={card.image}
                      alt={card.name}
                      onClick={() => setHighlighted(card.name)}
                      style={{
                        position: "absolute",
                        top: origIdx * 30,
                        left: 0,
                        border:
                          highlighted === card.name
                            ? "4px solid #007bff"
                            : "2px solid #333",
                        borderRadius: 8,
                        boxShadow:
                          highlighted === card.name
                            ? "0 0 10px #007bff"
                            : "0 2px 6px #aaa",
                        cursor: "pointer",
                        width: 80,
                        height: 120,
                        background: "#fff",
                        zIndex: highlighted === card.name ? 999 : origIdx,
                        transition: "border 0.2s, box-shadow 0.2s",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                      }}
                      title={card.name}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StackVisualizer;
