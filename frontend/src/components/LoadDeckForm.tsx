import React, { useRef, useState } from "react";

interface LoadDeckFormProps {
  format: string;
  setFormat: (val: string) => void;
  commanderName: string;
  setCommanderName: (val: string) => void;
  deckName: string;
  setDeckName: (val: string) => void;
  deckDescription: string;
  setDeckDescription: (val: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const LoadDeckForm: React.FC<LoadDeckFormProps> = ({
  format,
  setFormat,
  commanderName,
  setCommanderName,
  deckName,
  setDeckName,
  deckDescription,
  setDeckDescription,
  onFileChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Save deck handler
  const handleSaveDeck = async () => {
    setSaving(true);
    setErrorMsg(null);
    const formData = new FormData();
    formData.append("deck_name", deckName);
    formData.append("deck_description", deckDescription);
    formData.append("format", format);
    formData.append("commander_name", commanderName);
    if (
      fileInputRef.current &&
      fileInputRef.current.files &&
      fileInputRef.current.files[0]
    ) {
      formData.append("deckfile", fileInputRef.current.files[0]);
    }
    try {
      const res = await fetch("http://localhost:5000/api/save_deck", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setErrorMsg("Failed to save deck.");
      } else {
        alert("Deck saved!");
      }
    } catch {
      setErrorMsg("Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        border: "2px solid black",
        borderRadius: "8px",
        padding: "1.5em",
        marginBottom: "2em",
        background: "#fafafa",
        maxWidth: 500,
      }}
    >
      {/* Format selection */}
      <div style={{ marginBottom: "1em" }}>
        <label>
          Format:&nbsp;
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="commander">EDH</option>
            <option value="Standard">Standard</option>
            <option value="Modern">Modern</option>
            <option value="Pioneer">Pioneer</option>
          </select>
        </label>
      </div>
      {/* Commander name input (only for EDH) */}
      {format === "commander" && (
        <div style={{ marginBottom: "1em" }}>
          <label>
            Commander Name:&nbsp;
            <input
              type="text"
              value={commanderName}
              onChange={(e) => setCommanderName(e.target.value)}
              placeholder="Enter commander name"
            />
          </label>
        </div>
      )}
      {/* Deck name input */}
      <div style={{ marginBottom: "1em" }}>
        <label>
          Deck Name:&nbsp;
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Enter deck name"
          />
        </label>
      </div>
      {/* Deck description input */}
      <div style={{ marginBottom: "1em" }}>
        <label>
          Deck Description:&nbsp;
          <textarea
            value={deckDescription}
            onChange={(e) => setDeckDescription(e.target.value)}
            placeholder="Enter deck description"
            rows={4}
            style={{ width: "100%", resize: "vertical" }}
          />
        </label>
      </div>
      {/* File input */}
      <div style={{ marginBottom: "1em" }}>
        <label
          style={{
            display: "inline-block",
            padding: "0.5em 1em",
            background: "#1976d2",
            color: "#fff",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Load Deck File
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {/* Save button */}
      <button
        type="button"
        onClick={handleSaveDeck}
        disabled={saving}
        style={{
          background: "#388e3c",
          color: "#fff",
          padding: "0.5em 1.5em",
          border: "none",
          borderRadius: "4px",
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving..." : "Save"}
      </button>
      {errorMsg && (
        <div style={{ color: "red", marginTop: "1em" }}>{errorMsg}</div>
      )}
    </div>
  );
};

export default LoadDeckForm;
