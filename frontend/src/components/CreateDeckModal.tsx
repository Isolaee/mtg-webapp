import React, { useEffect, useState } from "react";
import FormatSelection from "./FormatSelection";
import { T } from "../theme";

export interface CreateDeckMeta {
  name: string;
  format: string;
  description: string;
  isPublic: boolean;
}

interface CreateDeckModalProps {
  isOpen: boolean;
  game: "mtg" | "riftbound";
  loggedIn: boolean;
  onClose: () => void;
  onCreate: (meta: CreateDeckMeta) => void;
}

const CreateDeckModal: React.FC<CreateDeckModalProps> = ({
  isOpen,
  game,
  loggedIn,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  // Riftbound has no format selector — decks are always "standard".
  const [format, setFormat] = useState(game === "mtg" ? "commander" : "standard");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setFormat(game === "mtg" ? "commander" : "standard");
    setDescription("");
    setIsPublic(false);
  }, [isOpen, game]);

  if (!isOpen) return null;

  const accent = game === "mtg" ? T.blue : T.purple;
  const showPublic = game === "mtg" && loggedIn;

  const submit = () => {
    onCreate({ name: name.trim(), format, description: description.trim(), isPublic });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1em",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.borderGold}66`,
          borderRadius: 6,
          width: "min(460px, 100%)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0.9em 1.2em",
            borderBottom: `1px solid ${T.border}`,
            gap: "1em",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.goldLight }}>
              Create New Deck
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>
              {game === "mtg" ? "Magic: The Gathering" : "Riftbound"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              color: T.text,
              padding: "0.3em 0.7em",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.1em 1.2em", display: "flex", flexDirection: "column", gap: "1em" }}>
          <Field label="Deck name">
            <input
              type="text"
              autoFocus
              placeholder="Untitled deck"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </Field>

          <Field label="Format">
            {game === "mtg" ? (
              <FormatSelection value={format} onChange={setFormat} />
            ) : (
              <span style={{ fontSize: 13, color: T.text }}>Standard</span>
            )}
          </Field>

          <Field label="Description (optional)">
            <textarea
              placeholder="What's this deck about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 60,
                background: T.bg,
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: 4,
                padding: "0.5em",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </Field>

          {showPublic && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5em",
                fontSize: 13,
                fontWeight: 600,
                color: T.textBright,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Public — viewable via a share link
            </label>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.8em 1.2em",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6em",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.5em 1.2em",
              background: "transparent",
              color: T.textDim,
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              fontWeight: 600,
              fontSize: "0.85em",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            style={{
              padding: "0.5em 1.4em",
              background: accent,
              color: T.bg,
              border: "none",
              borderRadius: 4,
              fontWeight: 700,
              fontSize: "0.85em",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Create Deck
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.4em" }}>
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: T.textDim,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {label}
    </span>
    {children}
  </div>
);

export default CreateDeckModal;
