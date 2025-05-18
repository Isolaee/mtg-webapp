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
          // Group cards by name and count them
          const cardCountMap: {
            [name: string]: { card: Card; count: number };
          } = {};
          grouped[type].forEach((card) => {
            if (cardCountMap[card.name]) {
              cardCountMap[card.name].count += 1;
            } else {
              cardCountMap[card.name] = { card, count: 1 };
            }
          });
          const uniqueCards = Object.values(cardCountMap);

          return (
            <div
              key={type}
              style={{
                minWidth: 90,
                position: "relative",
                height: 140 + (uniqueCards.length - 1) * 30,
              }}
            >
              <h4 style={{ textAlign: "center", marginBottom: 8 }}>
                {type} ({grouped[type].length})
              </h4>
              <div
                style={{
                  position: "relative",
                  width: 80,
                  height: 140 + (uniqueCards.length - 1) * 30,
                }}
              >
                {uniqueCards.map(({ card, count }, idx) => (
                  <div
                    key={card.name}
                    style={{
                      position: "absolute",
                      top: idx * 30,
                      left: highlighted === card.name ? 20 : 0, // Shift right if highlighted
                      width: 80,
                      zIndex: highlighted === card.name ? 1000 : 1,
                      transition: "left 0.2s",
                    }}
                  >
                    <img
                      src={card.image}
                      alt={card.name}
                      onClick={() => setHighlighted(card.name)}
                      style={{
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
                        transition: "border 0.2s, box-shadow 0.2s",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto",
                      }}
                      title={card.name}
                    />
                    {count > 1 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 10,
                          color: "#fff",
                          background: "#222",
                          borderRadius: "50%",
                          width: 16,
                          height: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          fontSize: 12,
                          border: "2px solid #fff",
                          boxShadow: "0 1px 4px #0008",
                          zIndex: 1001,
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
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
    </div>
  );
};

export default StackVisualizer;
