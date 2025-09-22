import React from "react";

interface FormatSelectionProps {
  value: string;
  onChange: (value: string) => void;
}

const MTG_FORMATS = [
  "commander",
  "standard",
  "modern",
  "pioneer",
  "legacy",
  "vintage",
  "pauper",
  "brawl",
  "historic",
  "alchemy",
];

const FormatSelection: React.FC<FormatSelectionProps> = ({
  value,
  onChange,
}) => (
  <div>
    <label htmlFor="format-select" style={{ marginRight: "0.5em" }}>
      Format:
    </label>
    <select
      id="format-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: "0.5em", border: "1px solid #ccc" }}
    >
      {MTG_FORMATS.map((format) => (
        <option key={format} value={format}>
          {format.charAt(0).toUpperCase() + format.slice(1)}
        </option>
      ))}
    </select>
  </div>
);

export default FormatSelection;
