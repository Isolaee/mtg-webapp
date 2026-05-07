import React from "react";
import { Link, useLocation } from "react-router-dom";

const MTG_LINKS = [
  { to: "/", label: "Home" },
  { to: "/create-deck", label: "Create Deck" },
  { to: "/load-deck", label: "Load Deck" },
];

const RB_LINKS = [
  { to: "/riftbound", label: "Cards" },
  { to: "/riftbound/deck-builder", label: "Deck Builder" },
];

const Nav: React.FC = () => {
  const { pathname } = useLocation();
  const isMtg = !pathname.startsWith("/riftbound");
  const subLinks = isMtg ? MTG_LINKS : RB_LINKS;

  return (
    <nav style={{ borderBottom: "2px solid #222", marginBottom: "1.5em" }}>
      {/* Game switcher */}
      <div style={{ display: "flex", gap: 0 }}>
        <GameTab
          to="/"
          label="Magic: The Gathering"
          active={isMtg}
          color="#1a5276"
        />
        <GameTab
          to="/riftbound"
          label="Riftbound"
          active={!isMtg}
          color="#6d2a8c"
        />
      </div>

      {/* Per-game sub-navigation */}
      <div
        style={{
          display: "flex",
          gap: "0.25em",
          padding: "0.4em 0.75em",
          background: "#f5f5f5",
        }}
      >
        {subLinks.map(({ to, label }) => {
          const active =
            to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              style={{
                padding: "0.3em 0.8em",
                borderRadius: 4,
                textDecoration: "none",
                fontWeight: active ? 700 : 400,
                color: active ? "#fff" : "#333",
                background: active ? "#333" : "transparent",
                fontSize: "0.9em",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

interface GameTabProps {
  to: string;
  label: string;
  active: boolean;
  color: string;
}

const GameTab: React.FC<GameTabProps> = ({ to, label, active, color }) => (
  <Link
    to={to}
    style={{
      padding: "0.5em 1.4em",
      textDecoration: "none",
      fontWeight: 700,
      fontSize: "0.95em",
      color: active ? "#fff" : "#555",
      background: active ? color : "#e8e8e8",
      borderRight: "1px solid #ccc",
      letterSpacing: "0.02em",
      transition: "background 0.15s",
    }}
  >
    {label}
  </Link>
);

export default Nav;
