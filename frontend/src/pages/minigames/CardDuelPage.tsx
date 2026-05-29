import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchDuelLeaderboard,
  fetchDuelPair,
  voteDuel,
  type DuelCard,
  type DuelLeaderboardEntry,
  type DuelPair,
  type DuelResult,
} from "../../api";
import { getVoterKey } from "../../utils/voterKey";
import { T } from "../../theme";

const MTG_FORMATS = [
  "commander", "standard", "modern", "pioneer", "legacy",
  "vintage", "pauper", "brawl", "historic", "alchemy",
];

type Game = "mtg" | "riftbound";

const CardDuelPage: React.FC = () => {
  const [game, setGame] = useState<Game>("mtg");
  const [format, setFormat] = useState("commander");
  const [pair, setPair] = useState<DuelPair | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);
  const [voting, setVoting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DuelLeaderboardEntry[] | null>(null);
  const [showBoard, setShowBoard] = useState(false);

  const accent = game === "riftbound" ? T.purple : T.blue;

  // Delay before auto-loading the next pair so the reveal is visible.
  const REVEAL_MS = 1600;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPair = useCallback(async (g: Game, f: string) => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setPair(await fetchDuelPair(g, f));
    } catch (e: any) {
      setPair(null);
      setError(
        e?.response?.status === 404
          ? "Not enough eligible cards for this game/format."
          : "Failed to load a matchup.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPair(game, format);
  }, [game, format, loadPair]);

  // Clear any pending auto-advance when leaving the page.
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const switchGame = (g: Game) => {
    if (g === game) return;
    setShowBoard(false);
    setGame(g);
    setFormat(g === "riftbound" ? "all" : "commander");
  };

  const handleVote = async (clicked: DuelCard) => {
    if (!pair || voting || result) return;
    const other = pair.cards.find((c) => c.card_id !== clicked.card_id);
    if (!other) return;
    setVoting(true);
    setError(null);
    try {
      const res = await voteDuel(game, format, clicked.card_id, other.card_id, getVoterKey());
      setResult(res);
      // Show the winner briefly, then auto-load the next pair.
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => loadPair(game, format), REVEAL_MS);
    } catch (e: any) {
      setError(
        e?.response?.status === 429
          ? "Slow down — too many votes, try again shortly."
          : "Vote failed, please try again.",
      );
    } finally {
      setVoting(false);
    }
  };

  const openLeaderboard = async () => {
    setShowBoard(true);
    setLeaderboard(null);
    try {
      setLeaderboard(await fetchDuelLeaderboard(game, format, 10));
    } catch {
      setLeaderboard([]);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "0.3em", color: accent }}>Which Card Is Stronger?</h1>
      <p style={{ color: T.textDim, marginTop: 0, marginBottom: "1.5em" }}>
        Pick the card you think is stronger. Every vote nudges its community ELO rating.
      </p>

      {/* Selectors */}
      <div style={{ display: "flex", gap: "1em", alignItems: "center", flexWrap: "wrap", marginBottom: "1.5em" }}>
        <div style={{ display: "flex", gap: "0.4em" }}>
          {(["mtg", "riftbound"] as Game[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => switchGame(g)}
              style={{
                padding: "0.45em 1.1em",
                background: g === game ? `${(g === "riftbound" ? T.purple : T.blue)}22` : "transparent",
                color: g === game ? (g === "riftbound" ? T.purple : T.blue) : T.textDim,
                border: `1px solid ${g === game ? (g === "riftbound" ? T.purple : T.blue) : T.border}`,
                borderRadius: 4,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontSize: "0.8em",
              }}
            >
              {g === "mtg" ? "Magic" : "Riftbound"}
            </button>
          ))}
        </div>

        {game === "mtg" ? (
          <select
            value={format}
            onChange={(e) => { setShowBoard(false); setFormat(e.target.value); }}
            style={{ padding: "0.45em 0.7em", background: T.surface2, color: T.textBright, border: `1px solid ${T.border}`, borderRadius: 4 }}
          >
            {MTG_FORMATS.map((f) => (
              <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
        ) : (
          <span style={{ color: T.textDim, fontSize: "0.85em" }}>All cards</span>
        )}

        <button
          type="button"
          onClick={openLeaderboard}
          style={{
            marginLeft: "auto",
            padding: "0.45em 1.1em",
            background: "transparent",
            color: T.gold,
            border: `1px solid ${T.gold}66`,
            borderRadius: 4,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          View Top 10
        </button>
      </div>

      {error && <p style={{ color: T.red }}>{error}</p>}
      {loading && <p style={{ color: T.textDim }}>Dealing a matchup…</p>}

      {/* The two cards */}
      {pair && !loading && (
        <div style={{ display: "flex", gap: "1.5em", flexWrap: "wrap", justifyContent: "center" }}>
          {pair.cards.map((card) => (
            <DuelCardView
              key={card.card_id}
              card={card}
              accent={accent}
              result={result}
              disabled={voting || result !== null}
              onPick={() => handleVote(card)}
            />
          ))}
        </div>
      )}

      {/* Reveal — auto-advances to the next pair shortly */}
      {result && (
        <div style={{ textAlign: "center", marginTop: "1.5em" }}>
          <span style={{ color: T.textDim, fontSize: "0.9em" }}>Loading next matchup…</span>
        </div>
      )}

      {showBoard && (
        <LeaderboardPanel
          accent={accent}
          entries={leaderboard}
          onClose={() => setShowBoard(false)}
        />
      )}
    </div>
  );
};

interface DuelCardViewProps {
  card: DuelCard;
  accent: string;
  result: DuelResult | null;
  disabled: boolean;
  onPick: () => void;
}

const DuelCardView: React.FC<DuelCardViewProps> = ({ card, accent, result, disabled, onPick }) => {
  const revealed = result !== null;
  const isHigher = revealed && result!.higher_card_id === card.card_id;
  // After voting, find this card's rating change (it was either winner or loser).
  let change: { old: number; new: number } | null = null;
  if (revealed) {
    if (result!.winner_card_id === card.card_id) change = result!.winner;
    else if (result!.loser_card_id === card.card_id) change = result!.loser;
  }
  const delta = change ? change.new - change.old : 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      style={{
        width: 240,
        background: T.surface,
        border: `2px solid ${isHigher ? T.green : revealed ? T.border : `${accent}55`}`,
        borderRadius: 10,
        padding: "0.9em",
        cursor: disabled ? "default" : "pointer",
        textAlign: "center",
        transition: "border-color 0.15s, transform 0.1s",
      }}
    >
      {card.image ? (
        <img
          src={card.image}
          alt={card.name}
          style={{ width: "100%", borderRadius: 8, display: "block", marginBottom: "0.6em" }}
        />
      ) : (
        <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim }}>
          {card.name}
        </div>
      )}
      <div style={{ fontWeight: 700, color: T.textBright, fontSize: "0.95em" }}>{card.name}</div>

      {revealed && change ? (
        <div style={{ marginTop: "0.4em", fontSize: "0.85em" }}>
          <span style={{ color: T.textDim }}>{Math.round(change.old)} → </span>
          <span style={{ color: isHigher ? T.green : T.textBright, fontWeight: 700 }}>{Math.round(change.new)}</span>
          <span style={{ color: delta >= 0 ? T.green : T.red, marginLeft: "0.4em", fontWeight: 700 }}>
            {delta >= 0 ? "+" : ""}{Math.round(delta)}
          </span>
          {isHigher && (
            <div style={{ color: T.green, fontWeight: 700, letterSpacing: "0.05em", marginTop: "0.2em" }}>STRONGER</div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: "0.4em", fontSize: "0.8em", color: T.textDim }}>ELO {Math.round(card.elo)}</div>
      )}
    </button>
  );
};

interface LeaderboardPanelProps {
  accent: string;
  entries: DuelLeaderboardEntry[] | null;
  onClose: () => void;
}

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({ accent, entries, onClose }) => (
  <div
    style={{
      marginTop: "2em",
      background: T.surface,
      border: `1px solid ${T.borderGold}44`,
      borderRadius: 6,
      padding: "1.4em 1.6em",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8em" }}>
      <h2 style={{ margin: 0, color: accent, fontFamily: "Cinzel, serif", fontSize: "1.1em", letterSpacing: "0.05em" }}>
        Top 10 by ELO
      </h2>
      <button
        type="button"
        onClick={onClose}
        style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 3, padding: "0.2em 0.7em", cursor: "pointer" }}
      >
        Close
      </button>
    </div>

    {entries === null && <p style={{ color: T.textDim }}>Loading…</p>}
    {entries !== null && entries.length === 0 && (
      <p style={{ color: T.textDim }}>No votes yet — be the first to rank these cards.</p>
    )}
    {entries !== null && entries.length > 0 && (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["#", "", "Card", "ELO", "W / Games"].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "0.4em 0.8em",
                    textAlign: i >= 3 ? "right" : "left",
                    color: T.textDim,
                    textTransform: "uppercase",
                    fontSize: "0.78em",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.rank} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "0.4em 0.8em", color: accent, fontWeight: 700 }}>{e.rank}</td>
                <td style={{ padding: "0.3em 0.8em" }}>
                  {e.image && <img src={e.image} alt={e.name} style={{ width: 36, borderRadius: 3, display: "block" }} />}
                </td>
                <td style={{ padding: "0.4em 0.8em", color: T.textBright }}>{e.name}</td>
                <td style={{ padding: "0.4em 0.8em", textAlign: "right", color: T.textBright, fontWeight: 700 }}>
                  {Math.round(e.elo)}
                </td>
                <td style={{ padding: "0.4em 0.8em", textAlign: "right", color: T.textDim }}>
                  {e.wins} / {e.games_played}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default CardDuelPage;
