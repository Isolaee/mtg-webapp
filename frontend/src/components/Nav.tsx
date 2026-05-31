import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

// Game-specific tools. These change with the active game and take the game accent.
// NOTE: Riftbound has no "Analysis" entry — the deck analyzer is MTG-only for now
// (see tcg-website-tjp). Add it here once an RB analysis page exists.
const MTG_LINKS = [
  { to: "/cards", label: "Cards" },
  { to: "/deck-builder", label: "Deck Builder" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/deck-analysis", label: "Analysis" },
];

const RB_LINKS = [
  { to: "/riftbound", label: "Cards" },
  { to: "/riftbound/deck-builder", label: "Deck Builder" },
  { to: "/riftbound/tournaments", label: "Tournaments" },
];

// Cross-game features. These are NOT tied to a game, so they live in the top bar
// (not the per-game sub-nav) and keep a neutral gold accent. This avoids the old
// behaviour where opening them flipped the whole chrome back to MTG, and removes
// the redundant third level of game tabs (each of these pages picks its own game).
const NEUTRAL_LINKS = [
  { to: "/my-decks", label: "My Decks", auth: true },
  { to: "/collection", label: "Collection", auth: true },
  { to: "/minigames", label: "Minigames", auth: false },
];

// True when `to` is the best match for the current path — exact match, or a prefix
// followed by "/". The longest match wins so e.g. /riftbound/deck-builder activates
// "Deck Builder", not the "/riftbound" Cards index link.
const bestMatch = (pathname: string, links: { to: string }[]): string | undefined => {
  const matches = links
    .map((l) => l.to)
    .filter((to) => pathname === to || pathname.startsWith(to + "/"));
  return matches.sort((a, b) => b.length - a.length)[0];
};

// MTG-specific routes (and their sub-routes). Used to decide when the MTG game tab
// + sub-nav are shown. Anything that is neither an MTG path nor a Riftbound path
// (home, neutral pages, unknown/404 URLs) renders with no game sub-nav and no game
// tab forced active.
const MTG_PREFIXES = ["/cards", "/deck-builder", "/deck", "/tournaments", "/deck-analysis"];
const isMtgPath = (pathname: string) =>
  MTG_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

const Nav: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuth();

  const isRiftbound = pathname.startsWith("/riftbound");
  const isMtg = !isRiftbound && isMtgPath(pathname);
  const showSubNav = isMtg || isRiftbound;

  const subLinks = isRiftbound ? RB_LINKS : MTG_LINKS;
  const accentColor = isRiftbound ? T.purple : T.blue;
  const activeSub = bestMatch(pathname, subLinks);
  const activeNeutral = bestMatch(pathname, NEUTRAL_LINKS);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav style={{ marginBottom: "2em" }}>
      {/* Top bar: logo + game tabs + neutral links + user area */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          flexWrap: "wrap",
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
            padding: "0.6em 1.4em",
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
        <GameTab to="/cards" label="Magic: The Gathering" active={isMtg} color={T.blue} />
        <GameTab to="/riftbound" label="Riftbound" active={isRiftbound} color={T.purple} />

        <div style={{ flex: 1, minWidth: "1em" }} />

        {/* Cross-game links */}
        {NEUTRAL_LINKS.filter((l) => !l.auth || username).map(({ to, label }) => (
          <NeutralLink key={to} to={to} label={label} active={to === activeNeutral} />
        ))}

        {/* Ko-Fi support link */}
        <a
          href="https://ko-fi.com/oracle_singularity"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.3em",
            padding: "0 1em",
            fontSize: 12,
            color: T.textDim,
            textDecoration: "none",
            letterSpacing: "0.03em",
            borderLeft: `1px solid ${T.border}`,
            whiteSpace: "nowrap",
          }}
        >
          ♥ Support
        </a>

        {/* User area */}
        {username ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6em", padding: "0 1.2em", borderLeft: `1px solid ${T.border}` }}>
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
              borderLeft: `1px solid ${T.border}`,
            }}
          >
            Log in
          </Link>
        )}
      </div>

      {/* Sub-navigation — game-specific tools only; hidden on neutral pages */}
      {showSubNav && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0,
            background: T.bg,
            borderBottom: `1px solid ${T.border}`,
            padding: "0 0.25em",
          }}
        >
          {subLinks.map(({ to, label }) => {
            const active = to === activeSub;
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

const NeutralLink: React.FC<{ to: string; label: string; active: boolean }> = ({ to, label, active }) => (
  <Link
    to={to}
    style={{
      display: "flex",
      alignItems: "center",
      padding: "0 1em",
      fontSize: 12,
      fontWeight: active ? 700 : 500,
      color: active ? T.gold : T.textDim,
      textDecoration: "none",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      borderBottom: active ? `2px solid ${T.gold}` : "2px solid transparent",
      whiteSpace: "nowrap",
      transition: "color 0.15s, border-color 0.15s",
    }}
  >
    {label}
  </Link>
);

export default Nav;
