import React, { useState } from "react";
import { fetchCards, Card } from "../api";

interface FindCardFormProps {
  onCardsFound: (cards: Card[]) => void;
}

const FindCardForm: React.FC<FindCardFormProps> = ({ onCardsFound }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleShowCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCards({ name });
      onCardsFound(data);
    } catch (err) {
      setError("Error fetching cards");
      onCardsFound([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter a name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ border: "1px solid black", padding: "0.5em" }}
      />
      <button
        onClick={handleShowCard}
        style={{
          marginLeft: "0.5em",
          border: "1px solid black",
          padding: "0.5em",
        }}
        disabled={loading}
      >
        {loading ? "Loading..." : "Show Card"}
      </button>
      {error && (
        <div
          style={{
            marginTop: "1em",
            minHeight: "2em",
            border: "1px solid black",
            padding: "0.5em",
          }}
        >
          <span style={{ color: "red" }}>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FindCardForm;
