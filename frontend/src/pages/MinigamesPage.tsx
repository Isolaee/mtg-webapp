import React, { useEffect, useState } from "react";
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
