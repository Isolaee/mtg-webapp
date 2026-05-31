import React from "react";
import { Link } from "react-router-dom";
import { T } from "../theme";

const LINKS = [
  { to: "/", label: "Home", color: T.gold },
  { to: "/cards", label: "Browse MTG Cards", color: T.blue },
  { to: "/riftbound", label: "Browse Riftbound Cards", color: T.purple },
];

const NotFoundPage: React.FC = () => (
  <div style={{ textAlign: "center", padding: "4em 1em" }}>
    <div
      style={{
        fontFamily: "Cinzel, serif",
        fontSize: "3.5em",
        fontWeight: 700,
        color: T.goldLight,
        lineHeight: 1,
        marginBottom: "0.2em",
      }}
    >
      404
    </div>
    <p style={{ color: T.textDim, fontSize: "1.05em", marginBottom: "2em" }}>
      That page doesn't exist. The link may be broken or the page may have moved.
    </p>
    <div style={{ display: "flex", gap: "0.7em", justifyContent: "center", flexWrap: "wrap" }}>
      {LINKS.map(({ to, label, color }) => (
        <Link
          key={to}
          to={to}
          style={{
            padding: "0.55em 1.2em",
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

export default NotFoundPage;
