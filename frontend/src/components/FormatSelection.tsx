import React from "react";
import { T } from "../theme";

const MTG_FORMATS = ["commander", "standard", "modern", "pioneer", "legacy", "vintage", "pauper", "brawl", "historic", "alchemy"];

const FormatSelection: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.6em" }}>
    <label htmlFor="format-select" style={{ fontSize: 12, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      Format
    </label>
    <select id="format-select" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "auto" }}>
      {MTG_FORMATS.map((format) => (
        <option key={format} value={format}>{format.charAt(0).toUpperCase() + format.slice(1)}</option>
      ))}
    </select>
  </div>
);

export default FormatSelection;
