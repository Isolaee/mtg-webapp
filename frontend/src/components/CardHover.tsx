import React, { useState, useRef, useCallback } from "react";
import { Card, fetchCards } from "../api";
import { T } from "../theme";
import CardImageModal from "./CardImageModal";

// Module-level cache so the same card name is only fetched once across the
// whole session (and across every CardHover instance).
const cache = new Map<string, Card | null>();

async function resolveCard(name: string): Promise<Card | null> {
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const matches = await fetchCards({ name });
    const exact =
      matches.find((c) => c.name.toLowerCase() === key) ?? matches[0] ?? null;
    cache.set(key, exact);
    return exact;
  } catch {
    cache.set(key, null);
    return null;
  }
}

interface Props {
  name: string;
  // Optional style override for the inline name text.
  style?: React.CSSProperties;
}

// Renders a card name that, on hover, shows a floating image preview of the
// card. The image is fetched lazily on first hover and cached.
const CardHover: React.FC<Props> = ({ name, style }) => {
  const [card, setCard] = useState<Card | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Tapping the name opens a full-image modal — the touch path, since the hover
  // preview never fires on Android.
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const PREVIEW_W = 240;
  const PREVIEW_H = 340;

  const show = useCallback(
    async (rect: DOMRect) => {
      // Prefer the right side; flip left if it would overflow the viewport.
      const spaceRight = window.innerWidth - rect.right;
      const left =
        spaceRight > PREVIEW_W + 16
          ? rect.right + 8
          : Math.max(8, rect.left - PREVIEW_W - 8);
      // Keep the preview vertically on-screen.
      const top = Math.min(
        Math.max(8, rect.top),
        window.innerHeight - PREVIEW_H - 8,
      );
      setPos({ left, top });
      const resolved = await resolveCard(name);
      setCard(resolved);
    },
    [name],
  );

  const handleEnter = () => {
    const el = anchorRef.current;
    if (el) show(el.getBoundingClientRect());
  };

  const handleLeave = () => {
    setPos(null);
  };

  const handleTap = async () => {
    setPos(null);
    const resolved = card ?? (await resolveCard(name));
    if (resolved?.image) setModalSrc(resolved.image);
  };

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleTap}
        style={{
          cursor: "pointer",
          textDecoration: "underline dotted",
          textUnderlineOffset: 2,
          ...style,
        }}
      >
        {name}
      </span>
      {pos && (
        <div
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            width: PREVIEW_W,
            zIndex: 2000,
            pointerEvents: "none",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
            border: `1px solid ${T.border}`,
            background: T.surface,
          }}
        >
          {card?.image ? (
            <img
              src={card.image}
              alt={name}
              style={{ width: "100%", display: "block" }}
            />
          ) : (
            <div
              style={{
                padding: "1em",
                fontSize: 12,
                color: T.textDim,
                textAlign: "center",
              }}
            >
              {card === null && cache.has(name.toLowerCase())
                ? "No image found"
                : "Loading…"}
            </div>
          )}
        </div>
      )}
      {modalSrc && (
        <CardImageModal src={modalSrc} alt={name} onClose={() => setModalSrc(null)} />
      )}
    </>
  );
};

export default CardHover;
