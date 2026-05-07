import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const MTG_LINKS = [
  { to: "/cards", label: "Cards" },
  { to: "/deck-builder", label: "Deck Builder" },
  { to: "/my-decks", label: "My Decks" },
  { to: "/collection", label: "Collection" },
];

const RB_LINKS = [
  { to: "/riftbound", label: "Cards" },
  { to: "/riftbound/deck-builder", label: "Deck Builder" },
  { to: "/my-decks", label: "My Decks" },
  { to: "/collection", label: "Collection" },
];

const Nav: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const isHome = pathname === "/";
  const isMtg = !pathname.startsWith("/riftbound");
  const subLinks = isMtg ? MTG_LINKS : RB_LINKS;
  const accentColor = isMtg ? T.blue : T.purple;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav style={{ marginBottom: "2em" }}>
      {/* Top bar: logo + game tabs + user area */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: T.surface,
          borderBottom: `1px solid ${T.borderGold}55`,
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5em",
            padding: "0 1.4em",
            textDecoration: "none",
            borderRight: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <LogoMark />
          <span
            style={{
              fontFamily: "Cinzel, serif",
              fontWeight: 700,
              fontSize: "0.95em",
              letterSpacing: "0.12em",
              color: T.gold,
              textTransform: "uppercase",
            }}
          >
            TCG Builder
          </span>
        </Link>

        {/* Game tabs */}
        <GameTab to="/cards" label="Magic: The Gathering" active={!pathname.startsWith("/riftbound") && !isHome} color={T.blue} />
        <GameTab to="/riftbound" label="Riftbound" active={pathname.startsWith("/riftbound")} color={T.purple} />

        <div style={{ flex: 1 }} />

        {/* User area */}
        {username ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6em", padding: "0 1.2em" }}>
            <Link
              to="/profile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4em",
                fontSize: 13,
                color: T.gold,
                textDecoration: "none",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${accentColor}88, ${accentColor}44)`,
                  border: `1px solid ${T.gold}88`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.goldLight,
                  fontFamily: "Cinzel, serif",
                }}
              >
                {username[0].toUpperCase()}
              </span>
              {username}
            </Link>
            <button
              onClick={handleLogout}
              style={{
                padding: "0.2em 0.7em",
                fontSize: 12,
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                background: "transparent",
                color: T.textDim,
                cursor: "pointer",
                letterSpacing: "0.03em",
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 1.2em",
              fontSize: 13,
              color: T.gold,
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Log in
          </Link>
        )}
      </div>

      {/* Sub-navigation — hidden on the landing page */}
      {!isHome && (
        <div
          style={{
            display: "flex",
            gap: 0,
            background: T.bg,
            borderBottom: `1px solid ${T.border}`,
            padding: "0 0.25em",
          }}
        >
          {subLinks.map(({ to, label }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                style={{
                  padding: "0.55em 1.1em",
                  textDecoration: "none",
                  fontWeight: active ? 700 : 400,
                  fontSize: "0.85em",
                  color: active ? accentColor : T.textDim,
                  borderBottom: active ? `2px solid ${accentColor}` : "2px solid transparent",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
};

// Placeholder logo mark — replace with an <img> when a real asset is available
const LogoMark: React.FC = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Outer hexagon */}
    <polygon
      points="14,2 25,8 25,20 14,26 3,20 3,8"
      fill="none"
      stroke={T.gold}
      strokeWidth="1.5"
      opacity="0.8"
    />
    {/* Inner diamond */}
    <polygon
      points="14,7 20,14 14,21 8,14"
      fill={`${T.gold}22`}
      stroke={T.gold}
      strokeWidth="1"
      opacity="0.9"
    />
    {/* Center dot */}
    <circle cx="14" cy="14" r="2" fill={T.gold} opacity="0.9" />
  </svg>
);

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
      padding: "0.65em 1.6em",
      textDecoration: "none",
      fontWeight: 700,
      fontSize: "0.85em",
      fontFamily: "Cinzel, serif",
      color: active ? color : T.textDim,
      background: active ? `${color}15` : "transparent",
      borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      transition: "all 0.15s",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </Link>
);

export default Nav;
