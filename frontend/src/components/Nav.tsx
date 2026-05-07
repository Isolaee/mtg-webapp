import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const MTG_LINKS = [
  { to: "/", label: "Home" },
  { to: "/deck-builder", label: "Deck Builder" },
  { to: "/my-decks", label: "My Decks" },
];

const RB_LINKS = [
  { to: "/riftbound", label: "Cards" },
  { to: "/riftbound/deck-builder", label: "Deck Builder" },
  { to: "/my-decks", label: "My Decks" },
];

const Nav: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const isMtg = !pathname.startsWith("/riftbound");
  const subLinks = isMtg ? MTG_LINKS : RB_LINKS;
  const accentColor = isMtg ? T.blue : T.purple;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav style={{ marginBottom: "2em" }}>
      {/* Top bar: game tabs + user pill */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: T.surface,
          borderBottom: `1px solid ${T.borderGold}55`,
        }}
      >
        <GameTab to="/" label="Magic: The Gathering" active={isMtg} color={T.blue} />
        <GameTab to="/riftbound" label="Riftbound" active={!isMtg} color={T.purple} />

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

      {/* Sub-navigation */}
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
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
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
