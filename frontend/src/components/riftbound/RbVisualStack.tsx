import React, { useState } from "react";
import { RbCard } from "../../api";
import { T } from "../../theme";

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

const RbVisualStack: React.FC<RbVisualStackProps> = ({ champion, mainDeck, runeDeck, battlefields }) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  if (!champion && mainDeck.length === 0 && runeDeck.length === 0) return null;

  const grouped: Record<string, DeckEntry[]> = {};
  MAIN_TYPES.forEach((t) => (grouped[t] = []));
  mainDeck.forEach((entry) => {
    const bucket = MAIN_TYPES.includes(entry.card.card_type) ? entry.card.card_type : "Unit";
    grouped[bucket].push(entry);
  });

  const mainTotal = mainDeck.reduce((n, e) => n + e.count, 0);
  const runeTotal = runeDeck.reduce((n, e) => n + e.count, 0);

  return (
    <div style={{ marginTop: "1.5em" }}>
      <h2 style={{ color: T.purple, fontSize: "1.1em", marginBottom: "1em" }}>Visual Stack</h2>

      {/* Champion */}
      {champion && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5em" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.purple, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Champion</div>
            <img
              src={cardImg(champion)}
              alt={champion.name}
              style={{ border: `3px solid ${T.purple}`, borderRadius: 8, boxShadow: `0 0 16px ${T.purple}88`, width: 100, height: 140, objectFit: "cover", background: T.surface2, display: "block" }}
              title={champion.name}
            />
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, color: T.text }}>{champion.name}</div>
            {(champion.energy != null || champion.might != null) && (
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                {champion.energy != null && `E:${champion.energy}`}
                {champion.energy != null && champion.might != null && " · "}
                {champion.might != null && `M:${champion.might}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main deck stacks */}
      {mainTotal > 0 && (
        <>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Main deck — {mainTotal} cards
          </div>
          <div style={{ display: "flex", gap: "2em", alignItems: "flex-start", marginBottom: "2em", flexWrap: "wrap" }}>
            {MAIN_TYPES.map((type) => {
              const entries = grouped[type];
              if (entries.length === 0) return null;
              const total = entries.reduce((n, e) => n + e.count, 0);
              return (
                <div key={type} style={{ minWidth: 90, position: "relative", height: 140 + (entries.length - 1) * 30 }}>
                  <h4 style={{ textAlign: "center", marginBottom: 8, fontSize: 12, color: T.textDim, fontFamily: "Cinzel, serif" }}>
                    {type} ({total})
                  </h4>
                  <div style={{ position: "relative", width: 80, height: 140 + (entries.length - 1) * 30 }}>
                    {entries.map(({ card, count }, idx) => (
                      <CardSlot key={card.id} card={card} count={count} idx={idx} highlighted={highlighted} onHighlight={setHighlighted} />
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
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Rune deck — {runeTotal} runes
          </div>
          <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
            {runeDeck.map(({ card, count }) => (
              <div key={card.id} style={{ textAlign: "center" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={cardImg(card)} alt={card.name} style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 5, border: `2px solid ${T.purple}55`, boxShadow: "0 1px 4px #00000066", display: "block" }} title={card.name} />
                  {count > 1 && <CountBadge count={count} />}
                </div>
                <div style={{ fontSize: 10, marginTop: 2, maxWidth: 56, lineHeight: 1.2, color: T.textDim }}>{card.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battlefields */}
      {battlefields.length > 0 && (
        <div style={{ marginBottom: "2em" }}>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Battlefields</div>
          <div style={{ display: "flex", gap: "0.75em", flexWrap: "wrap" }}>
            {battlefields.map((card) => (
              <div key={card.id} style={{ textAlign: "center" }}>
                <img src={cardImg(card)} alt={card.name} style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 5, border: `2px solid ${T.border}`, boxShadow: "0 1px 4px #00000066", display: "block" }} title={card.name} />
                <div style={{ fontSize: 10, marginTop: 2, color: T.textDim }}>{card.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CardSlot: React.FC<{ card: RbCard; count: number; idx: number; highlighted: string | null; onHighlight: (id: string | null) => void }> = ({ card, count, idx, highlighted, onHighlight }) => {
  const isHighlighted = highlighted === card.id;
  return (
    <div style={{ position: "absolute", top: idx * 30, left: isHighlighted ? 20 : 0, width: 80, zIndex: isHighlighted ? 1000 : idx + 1, transition: "left 0.15s" }}>
      <img
        src={cardImg(card)}
        alt={card.name}
        onClick={() => onHighlight(isHighlighted ? null : card.id)}
        style={{ width: 80, height: 120, objectFit: "cover", borderRadius: 8, border: isHighlighted ? `3px solid ${T.purple}` : `2px solid ${T.border}`, boxShadow: isHighlighted ? `0 0 12px ${T.purple}` : "0 2px 6px #00000066", cursor: "pointer", display: "block", background: T.surface2, transition: "border 0.15s, box-shadow 0.15s" }}
        title={`${card.name}${count > 1 ? ` ×${count}` : ""}`}
      />
      {count > 1 && <CountBadge count={count} />}
    </div>
  );
};

const CountBadge: React.FC<{ count: number }> = ({ count }) => (
  <span style={{ position: "absolute", top: 5, right: 5, background: T.gold, color: T.bg, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, boxShadow: "0 1px 3px #0008", zIndex: 1001 }}>
    {count}
  </span>
);

export default RbVisualStack;
