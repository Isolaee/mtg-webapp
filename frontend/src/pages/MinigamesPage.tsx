import React from "react";
import { Link } from "react-router-dom";
import { T } from "../theme";

const MinigamesPage: React.FC = () => (
  <div>
    <h1 style={{ marginBottom: "0.3em", color: T.blue }}>Minigames</h1>
    <p style={{ color: T.textDim, marginTop: 0, marginBottom: "1.5em" }}>
      Quick games built on the card database.
    </p>

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
  </div>
);

export default MinigamesPage;
