import React from "react";
import { Link } from "react-router-dom";
import { T } from "../theme";

function HomePage() {
  return (
    <div>
      <h1 style={{ fontSize: "2.2em", marginBottom: "0.2em" }}>TCG Builder</h1>
      <p style={{ color: T.textDim, marginBottom: "2.5em", fontSize: "1.05em" }}>
        Deck builder for Magic: The Gathering and Riftbound. Search cards, build lists, save your work.
      </p>

      <div style={{ display: "flex", gap: "1.5em", flexWrap: "wrap" }}>
        <GameCard
          title="Magic: The Gathering"
          description="Search 34,000+ cards, visualize your deck, upload existing lists, and save decks to your account."
          color={T.blue}
          links={[
            { to: "/create-deck", label: "Create Deck" },
            { to: "/load-deck", label: "Upload List" },
          ]}
        />
        <GameCard
          title="Riftbound"
          description="Browse all 950+ cards across OGN, OGS, SFD, and UNL sets. Build and save competitive decks."
          color={T.purple}
          links={[
            { to: "/riftbound", label: "Browse Cards" },
            { to: "/riftbound/deck-builder", label: "Deck Builder" },
          ]}
        />
      </div>
    </div>
  );
}

interface GameCardProps {
  title: string;
  description: string;
  color: string;
  links: { to: string; label: string }[];
}

const GameCard: React.FC<GameCardProps> = ({ title, description, color, links }) => (
  <div
    style={{
      flex: "1 1 320px",
      background: T.surface,
      border: `1px solid ${color}44`,
      borderTop: `3px solid ${color}`,
      borderRadius: 6,
      padding: "1.8em",
      display: "flex",
      flexDirection: "column",
      gap: "0.8em",
    }}
  >
    <h2
      style={{
        margin: 0,
        color,
        fontSize: "1.15em",
        fontFamily: "Cinzel, serif",
        letterSpacing: "0.05em",
      }}
    >
      {title}
    </h2>
    <p style={{ color: T.text, margin: 0, fontSize: "0.95em", lineHeight: 1.6 }}>
      {description}
    </p>
    <div style={{ display: "flex", gap: "0.6em", marginTop: "0.4em" }}>
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          style={{
            padding: "0.45em 1.2em",
            background: `${color}22`,
            color,
            border: `1px solid ${color}66`,
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
  </div>
);

export default HomePage;
