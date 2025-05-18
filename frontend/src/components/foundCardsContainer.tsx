import React from "react";
import { Card } from "../api";

interface FoundCardsProps {
  suggestions: Card[];
  onAddToDeck: (card: Card) => void;
}

const SuggestionList: React.FC<FoundCardsProps> = ({
  suggestions,
  onAddToDeck,
}) => (
  <div>
    <h2>Suggestions</h2>
    <ul>
      {suggestions.map((card, idx) => (
        <li key={idx}>
          {card.name}
          <button
            style={{ marginLeft: "1em" }}
            onClick={() => onAddToDeck(card)}
          >
            Add to Deck
          </button>
        </li>
      ))}
      {suggestions.length === 0 && <li>No suggestions yet.</li>}
    </ul>
  </div>
);

export default SuggestionList;
