import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, MtgDeckFull, fetchPublicDeck } from "../../api";
import DeckStats from "../../components/DeckStats";
import StackVisualizer from "../../components/visualStack";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";

// Call-to-action row so visitors landing on a shared deck (often logged out) have a
// way forward instead of a read-only dead end.
const DeckCallToAction: React.FC = () => {
  const { username } = useAuth();
  const ctas: { to: string; label: string; color: string }[] = [
    { to: "/deck-builder", label: "Build Your Own Deck", color: T.blue },
    { to: "/cards", label: "Browse Cards", color: T.gold },
  ];
  if (!username) ctas.push({ to: "/login", label: "Log In", color: T.purple });
  return (
    <div
      style={{
        display: "flex",
        gap: "0.7em",
        flexWrap: "wrap",
        marginTop: "1.5em",
        paddingTop: "1.5em",
        borderTop: `1px solid ${T.border}`,
      }}
    >
      {ctas.map(({ to, label, color }, i) => (
        <Link
          key={to}
          to={to}
          style={{
            padding: "0.55em 1.2em",
            background: i === 0 ? `${color}CC` : "transparent",
            color: i === 0 ? T.bg : color,
            border: `1px solid ${color}${i === 0 ? "" : "66"}`,
            borderRadius: 4,
            fontWeight: 700,
            fontSize: "0.85em",
            textDecoration: "none",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
};

interface DeckEntry {
  card: Card;
  count: number;
}

// Group a flat (duplicated) card array into counted entries, preserving order.
function groupEntries(cards: Card[]): DeckEntry[] {
  const map = new Map<string, DeckEntry>();
  for (const card of cards) {
    const existing = map.get(card.name);
    map.set(card.name, { card, count: (existing?.count ?? 0) + 1 });
  }
  return [...map.values()];
}

const Section: React.FC<{ label: string; entries: DeckEntry[] }> = ({
  label,
  entries,
}) => {
  if (entries.length === 0) return null;
  const total = entries.reduce((n, e) => n + e.count, 0);
  return (
    <div style={{ marginBottom: "0.8em" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: T.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.4em",
        }}
      >
        {label} ({total} {total === 1 ? "card" : "cards"})
      </div>
      {entries.map((entry) => (
        <div
          key={entry.card.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5em",
            padding: "0.2em 0",
            fontSize: 13,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <span style={{ flex: 1, color: T.textBright }}>{entry.card.name}</span>
          <span style={{ color: T.gold, fontWeight: 700, minWidth: 28, textAlign: "right" }}>
            ×{entry.count}
          </span>
        </div>
      ))}
    </div>
  );
};

const PublicDeckPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [deck, setDeck] = useState<MtgDeckFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchPublicDeck(slug)
      .then((d) => setDeck(d))
      .catch(() =>
        setError("This deck is private or does not exist."),
      )
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: "2em", color: T.textDim }}>Loading deck…</div>
    );
  }

  if (error || !deck) {
    return (
      <div>
        <PageHeader title="Shared Deck" accent={T.blue} />
        <div style={{ padding: "1em", color: T.red }}>
          {error ?? "Deck not found."}
        </div>
        <DeckCallToAction />
      </div>
    );
  }

  const main = groupEntries(deck.cards ?? []);
  const sideboard = groupEntries(deck.sideboard ?? []);
  const maybeboard = groupEntries(deck.maybeboard ?? []);
  const sideTotal = sideboard.reduce((n, e) => n + e.count, 0);

  return (
    <div>
      <PageHeader title={deck.name} accent={T.blue} />
      <div style={{ marginBottom: "0.75em", fontSize: 13, color: T.textDim }}>
        <span style={{ color: T.gold, fontWeight: 600 }}>{deck.format}</span>
        {deck.owner && <> · by {deck.owner}</>}
        {deck.description && <> · {deck.description}</>}
        <span
          style={{
            marginLeft: "0.6em",
            padding: "1px 8px",
            border: `1px solid ${T.green}66`,
            borderRadius: 10,
            color: T.green,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          Public · read-only
        </span>
      </div>

      {deck.commander && (
        <div style={{ marginBottom: "0.75em", fontSize: 13, color: T.textDim }}>
          Commander:{" "}
          <span style={{ color: T.gold, fontWeight: 600 }}>
            {deck.commander.name}
          </span>
        </div>
      )}

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          padding: "1em 1.2em",
          marginBottom: "1em",
        }}
      >
        <Section label="Main Deck" entries={main} />
        <Section label="Sideboard" entries={sideboard} />
        <Section label="Maybeboard" entries={maybeboard} />
      </div>

      <DeckStats
        cards={deck.cards ?? []}
        sideboardCount={sideTotal > 0 ? sideTotal : undefined}
        format={deck.format}
      />
      <StackVisualizer
        cards={deck.cards ?? []}
        format={deck.format}
        commanderName={deck.commander?.name ?? ""}
      />
      <DeckCallToAction />
    </div>
  );
};

export default PublicDeckPage;
