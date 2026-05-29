import React from "react";
import { T } from "../../theme";
import type { MinigameRendererProps } from "./types";

// "select_one" renderer: pick one option; after voting, reveal the community split.
const SelectOneGame: React.FC<MinigameRendererProps> = ({
  detail,
  onVote,
  result,
  votedOptionId,
  voting,
}) => {
  const revealed = result !== null;
  const accent = detail.game === "riftbound" ? T.purple : T.blue;

  return (
    <div>
      <h2
        style={{
          margin: "0 0 0.9em",
          color: accent,
          fontFamily: "Cinzel, serif",
          fontSize: "1.2em",
          letterSpacing: "0.04em",
        }}
      >
        {detail.prompt}
      </h2>

      <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
        {detail.options.map((opt) => {
          const res = result?.results.find((r) => r.option_id === opt.id);
          const pct = res?.percentage ?? 0;
          const votes = res?.votes ?? 0;
          const isPicked = votedOptionId === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={voting || revealed}
              onClick={() => onVote(opt.id)}
              style={{
                flex: "1 1 160px",
                position: "relative",
                overflow: "hidden",
                textAlign: "center",
                padding: "0.9em 0.8em",
                background: T.surface2,
                color: T.textBright,
                border: `1px solid ${isPicked ? T.gold : T.border}`,
                borderRadius: 6,
                cursor: revealed || voting ? "default" : "pointer",
                transition: "border-color 0.15s",
              }}
            >
              {/* Result bar fills from the left once revealed */}
              {revealed && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${pct}%`,
                    background: `${accent}33`,
                    borderRight: `2px solid ${accent}`,
                    transition: "width 0.4s ease",
                    zIndex: 0,
                  }}
                />
              )}

              <span style={{ position: "relative", zIndex: 1, display: "block" }}>
                {opt.image_url && (
                  <img
                    src={opt.image_url}
                    alt={opt.label}
                    style={{
                      width: "100%",
                      maxWidth: 140,
                      borderRadius: 4,
                      marginBottom: "0.6em",
                      display: "block",
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  />
                )}
                <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>{opt.label}</span>
                {revealed && (
                  <span
                    style={{
                      display: "block",
                      marginTop: "0.4em",
                      color: isPicked ? T.gold : T.textDim,
                      fontSize: "0.85em",
                      fontWeight: 700,
                    }}
                  >
                    {pct}% · {votes} {votes === 1 ? "vote" : "votes"}
                    {isPicked && " · your pick"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ margin: "0.9em 0 0", color: T.textDim, fontSize: "0.82em" }}>
        {revealed
          ? `${result?.total_votes ?? 0} total ${result?.total_votes === 1 ? "vote" : "votes"}`
          : "Tap an option to vote and see what the community thinks."}
      </p>
    </div>
  );
};

export default SelectOneGame;
