import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMinigames, type Minigame } from "../api";
import MinigameCard from "../components/minigames/MinigameCard";
import { T } from "../theme";

const MinigamesPage: React.FC = () => {
  const [games, setGames] = useState<Minigame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMinigames()
      .then(setGames)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: "0.3em", color: T.blue }}>Minigames</h1>
      <p style={{ color: T.textDim, marginTop: 0, marginBottom: "1.5em" }}>
        Cast your vote and see where the community lands.
      </p>

      {/* Card Duel launcher */}
      <Link
        to="/minigames/duel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1em",
          background: T.surface,
          border: `1px solid ${T.borderGold}44`,
          borderLeft: `3px solid ${T.blue}`,
          borderRadius: 6,
          padding: "1.2em 1.5em",
          marginBottom: "1.5em",
          textDecoration: "none",
        }}
      >
        <span>
          <span style={{ display: "block", color: T.textBright, fontWeight: 700, fontSize: "1.05em" }}>
            Card Duel — Which card is stronger?
          </span>
          <span style={{ color: T.textDim, fontSize: "0.88em" }}>
            Vote on random matchups and climb the per-format ELO leaderboard.
          </span>
        </span>
        <span style={{ color: T.gold, fontWeight: 700, whiteSpace: "nowrap" }}>Play →</span>
      </Link>

      {loading && <p style={{ color: T.textDim }}>Loading minigames…</p>}
      {error && <p style={{ color: T.red }}>Failed to load minigames.</p>}
      {!loading && !error && games.length === 0 && (
        <p style={{ color: T.textDim }}>No minigames available right now — check back soon.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5em" }}>
        {games.map((g) => (
          <MinigameCard key={g.id} minigameId={g.id} />
        ))}
      </div>
    </div>
  );
};

export default MinigamesPage;
