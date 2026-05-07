import React, { useRef, useState, useEffect } from "react";
import { authHeaders } from "../api";
import { T } from "../theme";

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

const MTG_FORMATS = ["commander", "standard", "modern", "pioneer", "legacy", "vintage", "pauper"];

const DeckList: React.FC<{ onDeckSelect: (name: string) => void }> = ({ onDeckSelect }) => {
  const [decks, setDecks] = useState<{ deck_name: string; deck_description?: string; format: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecks = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:8080/api/list_decks", { headers: authHeaders() });
        if (!res.ok) { setError("Failed to fetch decks."); return; }
        const data = await res.json();
        setDecks(data.decks ?? []);
      } catch { setError("Network error."); }
      finally { setLoading(false); }
    };
    fetchDecks();
  }, []);

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "1em", minWidth: 220, flex: "0 0 auto" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.6em" }}>
        Saved Decks
      </div>
      {loading && <div style={{ color: T.textDim, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ color: "#E74C3C", fontSize: 13 }}>{error}</div>}
      {!loading && !error && (
        <div>
          {decks.map((deck) => (
            <button
              key={deck.deck_name}
              onClick={() => onDeckSelect(deck.deck_name)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.4em 0.6em", marginBottom: "0.3em", background: "transparent", border: `1px solid ${T.border}`, borderRadius: 4, cursor: "pointer", color: T.textBright, fontSize: 13 }}
            >
              <div style={{ fontWeight: 600 }}>{deck.deck_name}</div>
              <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase" }}>{deck.format}</div>
            </button>
          ))}
          {decks.length === 0 && <div style={{ color: T.textDim, fontSize: 13, fontStyle: "italic" }}>No decks saved yet.</div>}
        </div>
      )}
    </div>
  );
};

const LoadDeckForm: React.FC<LoadDeckFormProps> = ({
  format, setFormat, commanderName, setCommanderName,
  deckName, setDeckName, deckDescription, setDeckDescription,
  onFileChange, onDeckLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSaveDeck = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const formData = new FormData();
    formData.append("deck_name", deckName);
    formData.append("deck_description", deckDescription);
    formData.append("format", format);
    formData.append("commander_name", commanderName);
    if (fileInputRef.current?.files?.[0]) formData.append("deckfile", fileInputRef.current.files[0]);
    try {
      const res = await fetch("http://localhost:8080/api/save_deck", { method: "POST", headers: authHeaders(), body: formData });
      if (!res.ok) { setErrorMsg("Failed to save deck."); }
      else { setSuccessMsg("Deck saved!"); setTimeout(() => setSuccessMsg(null), 3000); }
    } catch { setErrorMsg("Network error."); }
    finally { setSaving(false); }
  };

  const handleLoadFromDB = async (name?: string) => {
    if (!name) { name = prompt("Enter deck name to load:") || ""; }
    if (!name) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`http://localhost:8080/api/load_deck?deck_name=${encodeURIComponent(name)}`, { headers: authHeaders() });
      if (!res.ok) { setErrorMsg("Deck not found."); return; }
      const deck = await res.json();
      setDeckName(deck.deck_name || "");
      setDeckDescription(deck.deck_description || "");
      setFormat(deck.format || "");
      setCommanderName(deck.commander_name || "");
      if (onDeckLoaded) onDeckLoaded(deck);
    } catch { setErrorMsg("Network error."); }
  };

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3em" };

  return (
    <div style={{ display: "flex", gap: "1.2em", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "1.5em" }}>
      {/* Form */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "1.2em", flex: "1 1 340px", minWidth: 300 }}>
        {/* Format */}
        <div style={{ marginBottom: "0.9em" }}>
          <label style={labelStyle}>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)} style={{ width: "auto" }}>
            {MTG_FORMATS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>
        </div>

        {format === "commander" && (
          <div style={{ marginBottom: "0.9em" }}>
            <label style={labelStyle}>Commander Name</label>
            <input type="text" value={commanderName} onChange={(e) => setCommanderName(e.target.value)} placeholder="Enter commander name" />
          </div>
        )}

        <div style={{ marginBottom: "0.9em" }}>
          <label style={labelStyle}>Deck Name</label>
          <input type="text" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Enter deck name" />
        </div>

        <div style={{ marginBottom: "1em" }}>
          <label style={labelStyle}>Description</label>
          <textarea value={deckDescription} onChange={(e) => setDeckDescription(e.target.value)} placeholder="Optional description" rows={3} style={{ resize: "vertical" }} />
        </div>

        {/* Actions row */}
        <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
          <label style={{ padding: "0.45em 1em", background: `${T.blue}CC`, color: T.bg, border: `1px solid ${T.blue}88`, borderRadius: 4, fontWeight: 700, fontSize: "0.85em", letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer" }}>
            Upload File
            <input ref={fileInputRef} type="file" accept=".txt" onChange={onFileChange} style={{ display: "none" }} />
          </label>
          <button onClick={() => handleLoadFromDB()} style={{ padding: "0.45em 1em", background: "transparent", color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: 4, fontWeight: 600, fontSize: "0.85em", cursor: "pointer" }}>
            Load from DB
          </button>
          <button
            onClick={handleSaveDeck}
            disabled={saving || !deckName}
            style={{ padding: "0.45em 1em", background: saving || !deckName ? `${T.green}33` : `${T.green}CC`, color: T.textBright, border: `1px solid ${T.green}66`, borderRadius: 4, fontWeight: 700, fontSize: "0.85em", letterSpacing: "0.04em", textTransform: "uppercase", cursor: saving || !deckName ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : "Save Deck"}
          </button>
        </div>

        {errorMsg && <div style={{ color: "#E74C3C", fontSize: 13, marginTop: "0.75em" }}>{errorMsg}</div>}
        {successMsg && <div style={{ color: T.green, fontSize: 13, marginTop: "0.75em" }}>{successMsg}</div>}
      </div>

      {/* Saved decks panel */}
      <DeckList onDeckSelect={handleLoadFromDB} />
    </div>
  );
};

export default LoadDeckForm;
