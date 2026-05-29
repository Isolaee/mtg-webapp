import React from "react";
import { T } from "../theme";

interface Card {
  name: string;
  cmc?: number;
  colors?: string;
  manacost?: string;
  cardType?: string;
  typeline?: string;
}

const PERMANENT_TYPES = ["Creature", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];
const MAJOR_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];
const COLORS: { key: string; label: string; color: string }[] = [
  { key: "W", label: "White", color: "#F5E6C8" },
  { key: "U", label: "Blue", color: "#4DA6E0" },
  { key: "B", label: "Black", color: "#9B8AA6" },
  { key: "R", label: "Red", color: "#E0593C" },
  { key: "G", label: "Green", color: "#4CAE6A" },
];

function isType(card: Card, type: string) {
  return (
    (card.cardType && card.cardType.toLowerCase().includes(type.toLowerCase())) ||
    (card.typeline && card.typeline.toLowerCase().includes(type.toLowerCase()))
  );
}

function isLand(card: Card) {
  return !!(card.cardType && card.cardType.toLowerCase().includes("land"));
}

const DeckStats: React.FC<{ cards: Card[]; sideboardCount?: number }> = ({ cards, sideboardCount }) => {
  const cardCount = cards.length;
  if (cardCount === 0) return null;

  const landCount = cards.filter(isLand).length;
  const landPercent = ((landCount / cardCount) * 100).toFixed(1);
  const permanentCount = cards.filter((c) => PERMANENT_TYPES.some((t) => isType(c, t))).length;
  const permanentPercent = ((permanentCount / cardCount) * 100).toFixed(1);

  // Average mana value over non-land cards.
  const nonLands = cards.filter((c) => !isLand(c));
  const avgCmc =
    nonLands.length > 0
      ? (nonLands.reduce((s, c) => s + (c.cmc ?? 0), 0) / nonLands.length).toFixed(2)
      : "0";

  // ── Mana curve (non-lands, bucketed 0..6 and 7+) ──
  const curve = new Array(8).fill(0) as number[];
  nonLands.forEach((c) => {
    const idx = Math.min(7, Math.max(0, Math.floor(c.cmc ?? 0)));
    curve[idx] += 1;
  });
  const curveMax = Math.max(1, ...curve);

  // ── Color breakdown (a card counts toward each color it contains) ──
  const colorCounts = COLORS.map(({ key, label, color }) => ({
    label,
    color,
    count: cards.filter((c) => (c.colors ?? "").toUpperCase().includes(key)).length,
  }));
  const colorlessCount = cards.filter((c) => !/[WUBRG]/i.test(c.colors ?? "")).length;
  const colorMax = Math.max(1, ...colorCounts.map((c) => c.count), colorlessCount);

  // ── Type breakdown ──
  const typeCounts = MAJOR_TYPES.map((type) => ({
    type,
    count: cards.filter((c) => isType(c, type)).length,
  })).filter((t) => t.count > 0);

  const sideboardWarn =
    sideboardCount !== undefined && sideboardCount > 15
      ? `Sideboard has ${sideboardCount} cards (max 15).`
      : null;

  return (
    <div style={{ margin: "1em 0", padding: "0.9em 1.2em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
      {/* Summary row */}
      <div style={{ display: "flex", gap: "1.5em", flexWrap: "wrap" }}>
        <Stat label="Cards" value={String(cardCount)} />
        <Stat label="Lands" value={String(landCount)} />
        <Stat label="Land %" value={`${landPercent}%`} />
        <Stat label="Permanents" value={`${permanentPercent}%`} />
        <Stat label="Avg MV" value={avgCmc} />
        {sideboardCount !== undefined && <Stat label="Sideboard" value={String(sideboardCount)} />}
      </div>

      {sideboardWarn && (
        <div style={{ marginTop: "0.6em", fontSize: 12, color: T.red }}>{sideboardWarn}</div>
      )}

      <div style={{ display: "flex", gap: "2em", flexWrap: "wrap", marginTop: "1.2em" }}>
        {/* Mana curve */}
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <SectionLabel>Mana Curve</SectionLabel>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
            {curve.map((n, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 10, color: T.textDim }}>{n || ""}</span>
                <div
                  title={`${n} card${n === 1 ? "" : "s"} at MV ${i === 7 ? "7+" : i}`}
                  style={{ width: "100%", height: `${(n / curveMax) * 80}px`, background: `${T.blue}CC`, borderRadius: "3px 3px 0 0", minHeight: n > 0 ? 2 : 0, transition: "height 0.2s" }}
                />
                <span style={{ fontSize: 10, color: T.textDim }}>{i === 7 ? "7+" : i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Color breakdown */}
        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <SectionLabel>Color Breakdown</SectionLabel>
          {[...colorCounts, { label: "Colorless", color: T.textDim, count: colorlessCount }].map(
            ({ label, color, count }) => (
              <Bar key={label} label={label} count={count} max={colorMax} color={color} />
            ),
          )}
        </div>

        {/* Type breakdown */}
        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
          <SectionLabel>Type Breakdown</SectionLabel>
          {typeCounts.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>No typed cards.</div>
          ) : (
            typeCounts.map(({ type, count }) => (
              <Bar key={type} label={type} count={count} max={Math.max(1, ...typeCounts.map((t) => t.count))} color={`${T.gold}CC`} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: "1.1em", color: T.gold, fontFamily: "Cinzel, serif" }}>{value}</div>
  </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.6em" }}>
    {children}
  </div>
);

const Bar: React.FC<{ label: string; count: number; max: number; color: string }> = ({ label, count, max, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12 }}>
    <span style={{ width: 70, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    <div style={{ flex: 1, background: `${T.border}55`, borderRadius: 3, height: 12, overflow: "hidden" }}>
      <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: color, transition: "width 0.2s" }} />
    </div>
    <span style={{ width: 22, textAlign: "right", color: T.textDim }}>{count}</span>
  </div>
);

export default DeckStats;
