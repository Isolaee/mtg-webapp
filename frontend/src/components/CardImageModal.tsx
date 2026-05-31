import React, { useEffect } from "react";
import { T } from "../theme";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

// Full-screen tap-to-dismiss overlay showing a single card image, centered and
// scaled to fit the viewport. This is the touch path for viewing a card image
// (Android has no hover, so the hover previews used elsewhere never fire) and a
// reasonable click path on desktop too. Tapping anywhere — backdrop, image, or
// the close button — dismisses it; Escape works on desktop.
const CardImageModal: React.FC<Props> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(1, 10, 19, 0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5em",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "92vw",
          maxHeight: "90vh",
          width: "auto",
          height: "auto",
          borderRadius: 14,
          border: `1px solid ${T.borderGold}`,
          boxShadow: "0 12px 48px #000000cc",
        }}
      />
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: T.surface,
          color: T.textBright,
          border: `1px solid ${T.border}`,
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default CardImageModal;
