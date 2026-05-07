import React from "react";
import { T } from "../theme";

interface Card {
  name: string;
  cardType?: string;
  typeline?: string;
}

const PERMANENT_TYPES = ["Creature", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];

function isType(card: Card, type: string) {
  return (
    (card.cardType && card.cardType.toLowerCase().includes(type.toLowerCase())) ||
    (card.typeline && card.typeline.toLowerCase().includes(type.toLowerCase()))
  );
}

const DeckStats: React.FC<{ cards: Card[] }> = ({ cards }) => {
  const cardCount = cards.length;
  if (cardCount === 0) return null;

  const landCount = cards.filter((c) => c.cardType && c.cardType.toLowerCase().includes("land")).length;
  const landPercent = ((landCount / cardCount) * 100).toFixed(1);
  const permanentCount = cards.filter((c) => PERMANENT_TYPES.some((t) => isType(c, t))).length;
  const permanentPercent = ((permanentCount / cardCount) * 100).toFixed(1);

  return (
    <div style={{ display: "flex", gap: "1.5em", flexWrap: "wrap", margin: "1em 0", padding: "0.9em 1.2em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
      <Stat label="Cards" value={String(cardCount)} />
      <Stat label="Lands" value={String(landCount)} />
      <Stat label="Land %" value={`${landPercent}%`} />
      <Stat label="Permanents" value={`${permanentPercent}%`} />
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: "1.1em", color: T.gold, fontFamily: "Cinzel, serif" }}>{value}</div>
  </div>
);

export default DeckStats;
