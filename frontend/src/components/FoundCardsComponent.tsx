import React, { useState } from "react";
import { Card } from "../api";
import { T } from "../theme";
import CardImageModal from "./CardImageModal";

interface FoundCardsProps {
  suggestions: Card[];
  onAddToDeck: (card: Card) => void;
  format?: string;
  commanderName?: string;
  onAddCommander?: (card: Card) => void;
}

const PREVIEW_W = 200;
const PREVIEW_H = 280;
const OFFSET = 16;

const FoundCardsContainer: React.FC<FoundCardsProps> = ({
  suggestions,
  onAddToDeck,
  format,
  commanderName,
  onAddCommander,
}) => {
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  // Tapping a row opens a full-image modal — the touch path, since the hover
  // preview never fires on Android.
  const [modal, setModal] = useState<{ src: string; alt: string } | null>(null);

  if (suggestions.length === 0) return null;

  const previewLeft =
    mouse.x + OFFSET + PREVIEW_W < window.innerWidth
      ? mouse.x + OFFSET
      : mouse.x - PREVIEW_W - OFFSET;
  const previewTop = Math.max(
    10,
    Math.min(mouse.y - PREVIEW_H / 2, window.innerHeight - PREVIEW_H - 10),
  );

  return (
    <div style={{ marginBottom: "1.2em" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: T.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "0.5em",
        }}
      >
        Results ({suggestions.length})
      </div>

      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          maxHeight: 360,
          overflowY: "auto",
        }}
        onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPreview(null)}
      >
        {suggestions.map((card) => (
          <div
            key={card.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6em",
              padding: "0.4em 0.8em",
              borderBottom: `1px solid ${T.border}`,
              cursor: card.image ? "pointer" : "default",
            }}
            onMouseEnter={() =>
              card.image ? setPreview({ src: card.image, alt: card.name }) : setPreview(null)
            }
            onClick={() => card.image && setModal({ src: card.image, alt: card.name })}
          >
            <span style={{ fontWeight: 500, flex: 1, fontSize: 13, color: T.textBright }}>
              {card.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToDeck(card);
              }}
              style={{
                padding: "2px 10px",
                fontSize: 12,
                background: `${T.blue}33`,
                color: T.blue,
                border: `1px solid ${T.blue}55`,
                borderRadius: 3,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Add
            </button>
            {format === "commander" && !commanderName && onAddCommander && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddCommander(card);
                }}
                style={{
                  padding: "2px 8px",
                  fontSize: 12,
                  background: `${T.gold}22`,
                  color: T.gold,
                  border: `1px solid ${T.gold}55`,
                  borderRadius: 3,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Commander
              </button>
            )}
          </div>
        ))}
      </div>

      {preview && (
        <img
          src={preview.src}
          alt={preview.alt}
          style={{
            position: "fixed",
            left: previewLeft,
            top: previewTop,
            width: PREVIEW_W,
            height: "auto",
            borderRadius: 10,
            border: `1px solid ${T.borderGold}`,
            boxShadow: "0 8px 32px #00000099",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        />
      )}

      {modal && (
        <CardImageModal src={modal.src} alt={modal.alt} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

export default FoundCardsContainer;
