import React from "react";
import { Link } from "react-router-dom";

function HomePage() {
  return (
    <div className="App">
      <h1>TCG Web App</h1>
      <p>
        A deck builder for Magic: The Gathering and Riftbound. Search cards,
        visualize your deck, and save your lists. Log in to save and load decks.
      </p>
      <div style={{ display: "flex", gap: "2em", marginTop: "2em" }}>
        <div
          style={{
            flex: 1,
            padding: "1.5em",
            border: "1px solid #1a5276",
            borderRadius: 8,
            background: "#eaf0fb",
          }}
        >
          <h2 style={{ color: "#1a5276", marginTop: 0 }}>Magic: The Gathering</h2>
          <p style={{ color: "#444", fontSize: "0.95em" }}>
            Search the full card database, build decks, and visualize your stack.
          </p>
          <Link
            to="/create-deck"
            style={{
              display: "inline-block",
              padding: "0.5em 1.2em",
              background: "#1a5276",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.9em",
            }}
          >
            Create Deck
          </Link>
        </div>
        <div
          style={{
            flex: 1,
            padding: "1.5em",
            border: "1px solid #6d2a8c",
            borderRadius: 8,
            background: "#f5eafb",
          }}
        >
          <h2 style={{ color: "#6d2a8c", marginTop: 0 }}>Riftbound</h2>
          <p style={{ color: "#444", fontSize: "0.95em" }}>
            Browse all 950+ Riftbound cards and build decks for competitive play.
          </p>
          <Link
            to="/riftbound/deck-builder"
            style={{
              display: "inline-block",
              padding: "0.5em 1.2em",
              background: "#6d2a8c",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "0.9em",
            }}
          >
            Deck Builder
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
