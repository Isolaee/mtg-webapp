import React from "react";
import { T } from "../theme";

interface Props {
  label: string;
  value: number; // 0..1
  color?: string;
}

const SimilarityBar: React.FC<Props> = ({ label, value, color = T.blue }) => (
  <div style={{ marginBottom: "0.5em" }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
        marginBottom: 3,
      }}
    >
      <span
        style={{
          color: T.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span style={{ color: T.textBright, fontWeight: 700 }}>
        {(value * 100).toFixed(1)}%
      </span>
    </div>
    <div
      style={{
        height: 6,
        background: T.border,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(value * 100, 100)}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "width 0.35s ease",
        }}
      />
    </div>
  </div>
);

export default SimilarityBar;
