import React, { useState } from "react";
import { fetchCards, Card } from "../api";
import { T } from "../theme";

interface FindCardFormProps {
  onCardsFound: (cards: Card[]) => void;
}

const FindCardForm: React.FC<FindCardFormProps> = ({ onCardsFound }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShowCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCards({ name });
      onCardsFound(data);
    } catch {
      setError("Error fetching cards");
      onCardsFound([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: "0.5em", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75em" }}>
      <input
        type="text"
        placeholder="Search by card name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleShowCard()}
        style={{ minWidth: 220 }}
      />
      <button
        onClick={handleShowCard}
        disabled={loading}
        style={{
          padding: "0.5em 1.2em",
          background: loading ? `${T.blue}44` : `${T.blue}CC`,
          color: T.bg,
          border: `1px solid ${T.blue}88`,
          borderRadius: 4,
          fontWeight: 700,
          fontSize: "0.85em",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Searching…" : "Search"}
      </button>
      {error && <span style={{ color: "#E74C3C", fontSize: 13 }}>{error}</span>}
    </div>
  );
};

export default FindCardForm;
