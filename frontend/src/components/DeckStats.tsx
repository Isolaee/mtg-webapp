// DeckStats.tsx
import React from "react";

interface Card {
  name: string;
  cardType?: string;
  typeline?: string;
}

interface DeckStatsProps {
  cards: Card[];
}

const PERMANENT_TYPES = [
  "Creature",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
];

function isType(card: Card, type: string) {
  return (
    (card.cardType &&
      card.cardType.toLowerCase().includes(type.toLowerCase())) ||
    (card.typeline && card.typeline.toLowerCase().includes(type.toLowerCase()))
  );
}

const DeckStats: React.FC<DeckStatsProps> = ({ cards }) => {
  const cardCount = cards.length;
  const landCount = cards.filter(
    (c) => c.cardType && c.cardType.toLowerCase().includes("land"),
  ).length;
  const landPercent = cardCount
    ? ((landCount / cardCount) * 100).toFixed(1)
    : "0";
  const permanentCount = cards.filter((c) =>
    PERMANENT_TYPES.some((type) => isType(c, type)),
  ).length;
  const permanentPercent = cardCount
    ? ((permanentCount / cardCount) * 100).toFixed(1)
    : "0";

  return (
    <div
      style={{
        display: "flex",
        gap: "2em",
        margin: "1em 0",
        padding: "1em",
        background: "#f5f5f5",
        borderRadius: 8,
        justifyContent: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: "bold" }}>Land count</div>
        <div>{landCount}</div>
      </div>
      <div>
        <div style={{ fontWeight: "bold" }}>Land %</div>
        <div>{landPercent}%</div>
      </div>
      <div>
        <div style={{ fontWeight: "bold" }}>Permanent %</div>
        <div>{permanentPercent}%</div>
      </div>
      <div>
        <div style={{ fontWeight: "bold" }}>Card count</div>
        <div>{cardCount}</div>
      </div>
    </div>
  );
};

export default DeckStats;
