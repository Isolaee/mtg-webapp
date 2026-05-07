import React from "react";
import { Link } from "react-router-dom";
import { T } from "../theme";

const HomePage: React.FC = () => (
  <div>
    {/* Hero */}
    <div
      style={{
        textAlign: "center",
        padding: "3.5em 1em 3em",
        borderBottom: `1px solid ${T.border}`,
        marginBottom: "2.5em",
      }}
    >
      <div
        style={{
          fontFamily: "Cinzel, serif",
          fontSize: "2.6em",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: T.goldLight,
          marginBottom: "0.3em",
          lineHeight: 1.15,
        }}
      >
        TCG Builder
      </div>
      <p
        style={{
          color: T.textDim,
          fontSize: "1.05em",
          maxWidth: 480,
          margin: "0 auto",
          lineHeight: 1.7,
        }}
      >
        Browse cards, build decks, and save your collections for Magic: The Gathering and Riftbound.
      </p>
    </div>

    {/* Game cards */}
    <div style={{ display: "flex", gap: "1.5em", flexWrap: "wrap" }}>
      <GameSection
        title="Magic: The Gathering"
        tagline="34,000+ cards from all sets and formats"
        color={T.blue}
        features={["Search by name, type, and color", "Build and save decks", "Import existing lists from file", "Commander, Standard, Modern, and more"]}
        links={[
          { to: "/cards", label: "Browse Cards" },
          { to: "/deck-builder", label: "Deck Builder" },
        ]}
      />
      <GameSection
        title="Riftbound"
        tagline="950+ cards across OGN, OGS, SFD, and UNL sets"
        color={T.purple}
        features={["Filter by faction, type, rarity, and set", "Build champion + main + rune decks", "Deck validation and statistics", "Battlefield selection"]}
        links={[
          { to: "/riftbound", label: "Browse Cards" },
          { to: "/riftbound/deck-builder", label: "Deck Builder" },
        ]}
      />
    </div>
  </div>
);

interface GameSectionProps {
  title: string;
  tagline: string;
  color: string;
  features: string[];
  links: { to: string; label: string }[];
}

const GameSection: React.FC<GameSectionProps> = ({ title, tagline, color, features, links }) => (
  <div
    style={{
      flex: "1 1 340px",
      background: T.surface,
      border: `1px solid ${color}33`,
      borderTop: `3px solid ${color}`,
      borderRadius: 6,
      padding: "1.8em 2em",
      display: "flex",
      flexDirection: "column",
      gap: "1.1em",
    }}
  >
    <div>
      <h2
        style={{
          margin: "0 0 0.25em",
          color,
          fontSize: "1.15em",
          fontFamily: "Cinzel, serif",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, color: T.textDim, fontSize: "0.9em" }}>{tagline}</p>
    </div>

    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "0.4em",
      }}
    >
      {features.map((f) => (
        <li
          key={f}
          style={{
            fontSize: "0.88em",
            color: T.text,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.55em",
          }}
        >
          <span style={{ color, marginTop: "0.1em", flexShrink: 0 }}>◆</span>
          {f}
        </li>
      ))}
    </ul>

    <div style={{ display: "flex", gap: "0.7em", marginTop: "auto", paddingTop: "0.5em" }}>
      {links.map(({ to, label }, i) => (
        <Link
          key={to}
          to={to}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "0.55em 0",
            background: i === 0 ? `${color}CC` : "transparent",
            color: i === 0 ? T.bg : color,
            border: `1px solid ${color}${i === 0 ? "" : "66"}`,
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
