import React, { useRef, useState, useEffect } from "react";

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
  onDeckLoaded?: (deck: any) => void;
}

// DeckList component for showing all deck names and descriptions
const DeckList: React.FC<{
  onDeckSelect: (deckName: string) => void;
}> = ({ onDeckSelect }) => {
  const [decks, setDecks] = useState<
    { deck_name: string; deck_description?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecks = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("http://localhost:5000/api/list_decks");
        if (!res.ok) {
          setError("Failed to fetch decks.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setDecks(data.decks ? data.decks : []);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, []);

  return (
    <div
      style={{
        border: "2px solid #1976d2",
        borderRadius: "8px",
        padding: "1em",
        background: "#f0f7ff",
        maxWidth: 250,
        marginLeft: "2em",
        height: "fit-content",
      }}
    >
      <h3>Decks in Database</h3>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
      {!loading && !error && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {decks.map((deck) => (
            <li
              key={deck.deck_name}
              style={{
                padding: "0.5em 0",
                borderBottom: "1px solid #ccc",
                cursor: "pointer",
              }}
              onClick={() => onDeckSelect(deck.deck_name)}
              title={deck.deck_description || ""}
            >
              <strong>{deck.deck_name}</strong>
              {deck.deck_description && (
                <div style={{ fontSize: "0.9em", color: "#555" }}>
                  {deck.deck_description}
                </div>
              )}
            </li>
          ))}
          {decks.length === 0 && <li>No decks found.</li>}
        </ul>
      )}
    </div>
  );
};

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
  onDeckLoaded,
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

  // Load deck from DB handler
  const handleLoadFromDB = async (name?: string) => {
    if (!name) {
      name = prompt("Enter deck name to load from database:") || "";
    }
    if (!name) return;
    setErrorMsg(null);
    try {
      const res = await fetch(
        `http://localhost:5000/api/load_deck?deck_name=${encodeURIComponent(
          name,
        )}`,
      );
      if (!res.ok) {
        setErrorMsg("Deck not found in database.");
        return;
      }
      const deck = await res.json();
      setDeckName(deck.deck_name || "");
      setDeckDescription(deck.deck_description || "");
      setFormat(deck.format || "");
      setCommanderName(deck.commander_name || "");
      if (onDeckLoaded) onDeckLoaded(deck);
      alert("Deck loaded from database!");
    } catch {
      setErrorMsg("Network error.");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <div
        style={{
          border: "2px solid black",
          borderRadius: "8px",
          padding: "1.5em",
          marginBottom: "2em",
          background: "#fafafa",
          maxWidth: 500,
          flex: 1,
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
        {/* File input and Load from DB button */}
        <div style={{ marginBottom: "1em", display: "flex", gap: "1em" }}>
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
          <button
            type="button"
            onClick={() => handleLoadFromDB()}
            style={{
              background: "#1976d2",
              color: "#fff",
              padding: "0.5em 1em",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Load Deck from Database
          </button>
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
      {/* Deck list on the right */}
      <DeckList onDeckSelect={handleLoadFromDB} />
    </div>
  );
};

export default LoadDeckForm;
