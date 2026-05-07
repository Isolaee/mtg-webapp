import React from "react";
import { RbCard } from "../../api";
import { DeckEntry } from "./RbVisualStack";

interface RbDeckStatsProps {
  champion: RbCard | null;
  mainDeck: DeckEntry[];
  runeDeck: DeckEntry[];
  battlefields: RbCard[];
}

const MIN_MAIN = 40;
const EXACT_RUNES = 12;
const MAX_COPIES = 3;
const MAX_BATTLEFIELDS = 3;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  valid: boolean;
}

export function validateDeck(
  champion: RbCard | null,
  mainDeck: DeckEntry[],
  runeDeck: DeckEntry[],
  battlefields: RbCard[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const mainTotal = mainDeck.reduce((n, e) => n + e.count, 0);
  const runeTotal = runeDeck.reduce((n, e) => n + e.count, 0);

  if (!champion) errors.push("No champion selected.");
  if (mainTotal < MIN_MAIN)
    errors.push(`Main deck needs ${MIN_MAIN - mainTotal} more card${MIN_MAIN - mainTotal !== 1 ? "s" : ""} (${mainTotal}/${MIN_MAIN} minimum).`);
  if (runeTotal !== EXACT_RUNES)
    errors.push(`Rune deck must have exactly ${EXACT_RUNES} runes (currently ${runeTotal}).`);

  mainDeck.forEach(({ card, count }) => {
    if (count > MAX_COPIES)
      errors.push(`${card.name}: max ${MAX_COPIES} copies (have ${count}).`);
  });
  runeDeck.forEach(({ card, count }) => {
    if (count > MAX_COPIES)
      errors.push(`${card.name}: max ${MAX_COPIES} copies (have ${count}).`);
  });

  if (battlefields.length > MAX_BATTLEFIELDS)
    warnings.push(`${battlefields.length} battlefields selected (max ${MAX_BATTLEFIELDS}).`);
  if (mainTotal > 60)
    warnings.push(`Main deck is large (${mainTotal} cards) — consider trimming.`);

  return { errors, warnings, valid: errors.length === 0 };
}

const RbDeckStats: React.FC<RbDeckStatsProps> = ({
  champion,
  mainDeck,
  runeDeck,
  battlefields,
}) => {
  const mainTotal = mainDeck.reduce((n, e) => n + e.count, 0);
  const runeTotal = runeDeck.reduce((n, e) => n + e.count, 0);

  const byType = mainDeck.reduce<Record<string, number>>((acc, { card, count }) => {
    acc[card.card_type] = (acc[card.card_type] ?? 0) + count;
    return acc;
  }, {});

  const { errors, warnings } = validateDeck(champion, mainDeck, runeDeck, battlefields);

  if (mainTotal === 0 && !champion) return null;

  return (
    <div style={{ margin: "1em 0" }}>
      {/* Stat pills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75em",
          padding: "0.75em 1em",
          background: "#f5f5f5",
          borderRadius: 8,
          marginBottom: "0.5em",
        }}
      >
        <Stat
          label="Champion"
          value={champion ? champion.name : "None"}
          ok={!!champion}
        />
        <Stat
          label="Main deck"
          value={`${mainTotal} / ${MIN_MAIN}+`}
          ok={mainTotal >= MIN_MAIN}
        />
        {Object.entries(byType).map(([type, count]) => (
          <Stat key={type} label={type} value={String(count)} ok={null} />
        ))}
        <Stat
          label="Runes"
          value={`${runeTotal} / ${EXACT_RUNES}`}
          ok={runeTotal === EXACT_RUNES}
        />
        {battlefields.length > 0 && (
          <Stat
            label="Battlefields"
            value={String(battlefields.length)}
            ok={battlefields.length <= MAX_BATTLEFIELDS}
          />
        )}
      </div>

      {/* Validation messages */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div style={{ fontSize: 13 }}>
          {errors.map((e, i) => (
            <div key={i} style={{ color: "#c0392b", marginBottom: 2 }}>
              ✗ {e}
            </div>
          ))}
          {warnings.map((w, i) => (
            <div key={i} style={{ color: "#e67e22", marginBottom: 2 }}>
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
      {errors.length === 0 && warnings.length === 0 && (
        <div style={{ fontSize: 13, color: "#27ae60" }}>✓ Deck is valid.</div>
      )}
    </div>
  );
};

interface StatProps {
  label: string;
  value: string;
  ok: boolean | null; // null = neutral (no coloring)
}

const Stat: React.FC<StatProps> = ({ label, value, ok }) => (
  <div style={{ textAlign: "center", minWidth: 60 }}>
    <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{label}</div>
    <div
      style={{
        fontWeight: 700,
        fontSize: 15,
        color: ok === null ? "#333" : ok ? "#27ae60" : "#c0392b",
      }}
    >
      {value}
    </div>
  </div>
);

export default RbDeckStats;
