import React from "react";
import { T } from "../theme";

interface PageHeaderProps {
  /** Page title. Keep it aligned with the matching nav label. */
  title: string;
  /** Accent color for the title — the active game color (T.blue / T.purple),
   *  or omit for neutral/cross-game pages (defaults to gold). */
  accent?: string;
  /** Optional one-line description shown under the title. */
  subtitle?: string;
  /** Optional actions rendered on the right (buttons, links). */
  right?: React.ReactNode;
}

/**
 * Standard page title. Centralises title color + spacing so every page is
 * consistent: title color follows the game accent (gold when neutral) and
 * page titles match their nav labels.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, accent = T.gold, subtitle, right }) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "1em",
      flexWrap: "wrap",
      marginBottom: "1.2em",
    }}
  >
    <div>
      <h1 style={{ margin: 0, color: accent }}>{title}</h1>
      {subtitle && (
        <p style={{ margin: "0.35em 0 0", color: T.textDim, fontSize: "0.95em" }}>{subtitle}</p>
      )}
    </div>
    {right && <div style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>{right}</div>}
  </div>
);

export default PageHeader;
