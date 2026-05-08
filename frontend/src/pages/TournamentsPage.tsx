import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  DeckEntry,
  TournamentEvent,
  TournamentEventWithPlacements,
  TournamentPlacement,
  fetchTournament,
  fetchTournaments,
} from "../api";
import { T, panel } from "../theme";

const MTG_FORMATS = ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "premodern"];
const RB_FORMATS = ["unleashed", "constructed"];

const placementLabel = (p: number | null): string => {
  if (p === null) return "—";
  if (p === 1) return "1st";
  if (p === 2) return "2nd";
  if (p === 3) return "3rd";
  if (p <= 4) return "Top 4";
  if (p <= 8) return "Top 8";
  if (p <= 16) return "Top 16";
  if (p <= 32) return "Top 32";
  return `${p}`;
};

const sourceLabel = (s: string) => (s === "mtgo" ? "MTGO" : "riftdecks");

const formatDate = (d: string | null) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

const parseDeck = (raw: string | null): DeckEntry[] => {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DeckEntry[];
  } catch {
    return [];
  }
};

// ── Sub-components ────────────────────────────────────────────────────────────

const DeckView: React.FC<{ raw: string | null }> = ({ raw }) => {
  const cards = parseDeck(raw);
  const main = cards.filter((c) => c.card_type !== "sideboard");
  const side = cards.filter((c) => c.card_type === "sideboard");

  if (cards.length === 0) return <span style={{ color: T.textDim, fontSize: 12 }}>No decklist</span>;

  return (
    <div style={{ display: "flex", gap: "1.5em", flexWrap: "wrap" }}>
      <CardGroup label="Main deck" cards={main} />
      {side.length > 0 && <CardGroup label="Sideboard" cards={side} />}
    </div>
  );
};

const CardGroup: React.FC<{ label: string; cards: DeckEntry[] }> = ({ label, cards }) => (
  <div style={{ minWidth: 180 }}>
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.textDim,
        marginBottom: "0.4em",
      }}
    >
      {label} ({cards.reduce((s, c) => s + c.qty, 0)})
    </div>
    {cards.map((c, i) => (
      <div
        key={i}
        style={{ fontSize: 13, color: T.text, display: "flex", gap: "0.5em", lineHeight: 1.6 }}
      >
        <span style={{ color: T.textDim, minWidth: "1.4em", textAlign: "right" }}>{c.qty}×</span>
        <span>{c.name}</span>
      </div>
    ))}
  </div>
);

const PlacementRow: React.FC<{ p: TournamentPlacement; accentColor: string }> = ({
  p,
  accentColor,
}) => {
  const [open, setOpen] = useState(false);
  const cards = parseDeck(p.decklist);

  // Riftdecks placements store a deck_url entry — show deck name as link, no expand.
  const deckLink = cards.find((c) => c.card_type === "deck_url");
  const deckUrl = p.record?.startsWith("http") ? p.record : null;
  const deckName = deckLink?.name ?? null;
  const legend = (deckLink as any)?.legend ?? null;

  // MTGO placements have real card lists.
  const hasRealDeck = !deckLink && cards.length > 0;

  return (
    <>
      <tr
        onClick={() => hasRealDeck && setOpen((o) => !o)}
        style={{
          cursor: hasRealDeck ? "pointer" : "default",
          background: open ? `${accentColor}11` : "transparent",
          transition: "background 0.15s",
        }}
      >
        <td
          style={{
            padding: "0.5em 0.8em",
            color: accentColor,
            fontWeight: 700,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {placementLabel(p.placement)}
        </td>
        <td style={{ padding: "0.5em 0.8em", color: T.textBright, fontSize: 13 }}>
          {p.player ?? "—"}
        </td>
        <td style={{ padding: "0.5em 0.8em", color: T.textDim, fontSize: 12 }}>
          {deckUrl ? (
            <a
              href={deckUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: accentColor, textDecoration: "none", fontWeight: 600 }}
            >
              {deckName || "View deck"}{legend ? ` · ${legend}` : ""}
            </a>
          ) : (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.record ?? "—"}</span>
          )}
        </td>
        <td
          style={{
            padding: "0.5em 0.8em",
            color: hasRealDeck ? accentColor : T.textDim,
            fontSize: 11,
            letterSpacing: "0.04em",
          }}
        >
          {hasRealDeck ? (open ? "▲ hide" : "▼ show") : ""}
        </td>
      </tr>
      {open && (
        <tr>
          <td
            colSpan={4}
            style={{
              padding: "0.8em 1.2em 1em",
              background: `${accentColor}0A`,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <DeckView raw={p.decklist} />
          </td>
        </tr>
      )}
    </>
  );
};

const EventCard: React.FC<{
  event: TournamentEvent;
  accentColor: string;
}> = ({ event, accentColor }) => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TournamentEventWithPlacements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (detail) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchTournament(event.id);
      setDetail(d);
    } catch {
      setError("Failed to load placements.");
    } finally {
      setLoading(false);
    }
  }, [open, detail, event.id]);

  return (
    <div
      style={{
        ...panel,
        padding: 0,
        overflow: "hidden",
        marginBottom: "0.6em",
        border: open ? `1px solid ${accentColor}55` : `1px solid ${T.border}`,
        transition: "border-color 0.15s",
      }}
    >
      {/* Header row */}
      <div
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1em",
          padding: "0.75em 1.1em",
          cursor: "pointer",
          background: open ? `${accentColor}0D` : "transparent",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.textBright,
            flex: 1,
            minWidth: 140,
          }}
        >
          {event.name}
        </span>

        <div style={{ display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
          {event.format && (
            <Chip color={accentColor}>{event.format}</Chip>
          )}
          <Chip color={T.textDim}>{sourceLabel(event.source)}</Chip>
          {event.event_date && (
            <span style={{ fontSize: 12, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>
              {formatDate(event.event_date)}
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: 11,
            color: accentColor,
            letterSpacing: "0.04em",
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {open ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded placements */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {loading && (
            <div style={{ padding: "1em 1.2em", color: T.textDim, fontSize: 13 }}>
              Loading…
            </div>
          )}
          {error && (
            <div style={{ padding: "1em 1.2em", color: T.red, fontSize: 13 }}>{error}</div>
          )}
          {detail && detail.placements.length === 0 && (
            <div style={{ padding: "1em 1.2em", color: T.textDim, fontSize: 13 }}>
              No placements recorded.
            </div>
          )}
          {detail && detail.placements.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["Place", "Player", "Record", "Deck"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.4em 0.8em",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          color: T.textDim,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.placements.map((p) => (
                    <PlacementRow key={p.id} p={p} accentColor={accentColor} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Chip: React.FC<{ color: string; children: React.ReactNode }> = ({
  color,
  children,
}) => (
  <span
    style={{
      fontSize: 11,
      padding: "0.15em 0.55em",
      borderRadius: 3,
      border: `1px solid ${color}55`,
      color,
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const TournamentsPage: React.FC = () => {
  const { pathname } = useLocation();
  const isRiftbound = pathname.startsWith("/riftbound");
  const game = isRiftbound ? "riftbound" : "mtg";
  const accentColor = isRiftbound ? T.purple : T.blue;
  const formats = isRiftbound ? RB_FORMATS : MTG_FORMATS;

  const [format, setFormat] = useState("");
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (fmt: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTournaments(game, fmt || undefined);
        setEvents(data);
      } catch {
        setError("Failed to load tournaments.");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [game],
  );

  useEffect(() => {
    setFormat("");
    setEvents([]);
    load("");
  }, [game, load]);

  const handleFormat = (fmt: string) => {
    setFormat(fmt);
    load(fmt);
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: "Cinzel, serif",
          color: T.gold,
          fontSize: "1.15em",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "1em",
        }}
      >
        Tournament Results
      </h2>

      {/* Format filter */}
      <div style={{ display: "flex", gap: "0.4em", flexWrap: "wrap", marginBottom: "1.2em" }}>
        <FormatBtn
          active={format === ""}
          color={accentColor}
          onClick={() => handleFormat("")}
        >
          All
        </FormatBtn>
        {formats.map((f) => (
          <FormatBtn
            key={f}
            active={format === f}
            color={accentColor}
            onClick={() => handleFormat(f)}
          >
            {f}
          </FormatBtn>
        ))}
      </div>

      {loading && (
        <div style={{ color: T.textDim, fontSize: 13, padding: "2em 0" }}>Loading…</div>
      )}
      {error && <div style={{ color: T.red, fontSize: 13, marginBottom: "1em" }}>{error}</div>}

      {!loading && events.length === 0 && !error && (
        <div style={{ color: T.textDim, fontSize: 13, padding: "2em 0" }}>
          No tournament results yet. The scraper runs every 6 hours after backend startup.
        </div>
      )}

      {events.map((ev) => (
        <EventCard key={ev.id} event={ev} accentColor={accentColor} />
      ))}
    </div>
  );
};

const FormatBtn: React.FC<{
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, color, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: "0.3em 0.9em",
      fontSize: 12,
      fontWeight: active ? 700 : 400,
      border: active ? `1px solid ${color}` : `1px solid ${T.border}`,
      borderRadius: 3,
      background: active ? `${color}22` : "transparent",
      color: active ? color : T.textDim,
      cursor: "pointer",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      transition: "all 0.15s",
    }}
  >
    {children}
  </button>
);

export default TournamentsPage;
