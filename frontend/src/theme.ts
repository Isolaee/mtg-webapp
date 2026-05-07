import type React from "react";

export const T = {
  bg: "#010A13",
  surface: "#0A1428",
  surface2: "#0D1B2E",
  border: "#1E2A3A",
  borderGold: "#C89B3C",
  gold: "#C89B3C",
  goldLight: "#F0E6D3",
  blue: "#0BC4E3",
  blueDark: "#0397AB",
  purple: "#7B2FBE",
  purpleDark: "#5A1F8F",
  text: "#A9B4C0",
  textBright: "#F0E6D3",
  textDim: "#5B6980",
  red: "#C0392B",
  green: "#1F8C4E",
} as const;

export const btn = {
  primary: (color: string): React.CSSProperties => ({
    padding: "0.5em 1.4em",
    background: `linear-gradient(to bottom, ${color}CC, ${color})`,
    color: T.goldLight,
    border: `1px solid ${T.gold}88`,
    borderRadius: 3,
    fontWeight: 700,
    fontSize: "0.9em",
    cursor: "pointer",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  }),
  ghost: (): React.CSSProperties => ({
    padding: "0.5em 1.4em",
    background: "transparent",
    color: T.gold,
    border: `1px solid ${T.gold}66`,
    borderRadius: 3,
    fontWeight: 600,
    fontSize: "0.9em",
    cursor: "pointer",
    letterSpacing: "0.04em",
  }),
  danger: (): React.CSSProperties => ({
    padding: "0.35em 0.9em",
    background: "transparent",
    color: "#E74C3C",
    border: "1px solid #E74C3C66",
    borderRadius: 3,
    fontSize: "0.85em",
    cursor: "pointer",
  }),
};

export const panel: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.borderGold}44`,
  borderRadius: 6,
  padding: "1.4em 1.6em",
};
