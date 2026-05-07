import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { T, btn, panel } from "../theme";
import {
  CollectionEntry,
  fetchCollection,
  addToCollection,
  updateCollectionEntry,
  removeFromCollection,
  fetchCards,
  fetchRbCards,
} from "../api";

type Game = "mtg" | "riftbound";

interface SearchResult {
  id: string;
  name: string;
  image?: string;
}

const CollectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Game>("mtg");
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-card state
  const [searchName, setSearchName] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [isFoil, setIsFoil] = useState(false);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchCollection());
    } catch {
      setError("Could not load collection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchName.trim()) return;
    setSearching(true);
    setSelected(null);
    try {
      if (tab === "mtg") {
        const cards = await fetchCards({ name: searchName.trim() });
        setResults(cards.slice(0, 8).map((c) => ({ id: c.name, name: c.name, image: c.image })));
      } else {
        const cards = await fetchRbCards({ name: searchName.trim() });
        setResults(cards.slice(0, 8).map((c) => ({ id: c.id, name: c.name, image: c.image })));
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    try {
      await addToCollection({ game: tab, card_id: selected.id, is_foil: isFoil });
      setEntries(await fetchCollection());
      setSelected(null);
      setSearchName("");
      setResults([]);
      setIsFoil(false);
    } finally {
      setAdding(false);
    }
  };

  const handleQuantity = async (entry: CollectionEntry, delta: number) => {
    const newQty = Math.max(1, entry.quantity + delta);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, quantity: newQty } : e)));
    try {
      await updateCollectionEntry(entry.id, { quantity: newQty });
    } catch {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    }
  };

  const handleRemove = async (entry: CollectionEntry) => {
    if (!window.confirm(`Remove "${entry.card_id}" from collection?`)) return;
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      await removeFromCollection(entry.id);
    } catch {
      setEntries((prev) => [...prev, entry]);
    }
  };

  const tabColor = tab === "mtg" ? T.blue : T.purple;
  const tabEntries = entries.filter((e) => e.game === tab);

  return (
    <div>
      <h1 style={{ marginBottom: "1.2em" }}>My Collection</h1>

      {/* Game tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: "1.8em" }}>
        {(["mtg", "riftbound"] as Game[]).map((t) => {
          const c = t === "mtg" ? T.blue : T.purple;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0.55em 1.4em",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: tab === t ? 700 : 400,
                fontSize: "0.85em",
                fontFamily: "Cinzel, serif",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: tab === t ? c : T.textDim,
                borderBottom: tab === t ? `2px solid ${c}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t === "mtg" ? "Magic: The Gathering" : "Riftbound"}
            </button>
          );
        })}
      </div>

      {/* Add card panel */}
      <div style={{ ...panel, marginBottom: "1.6em" }}>
        <div
          style={{
            fontSize: "0.78em",
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tabColor,
            marginBottom: "0.8em",
          }}
        >
          Add Card
        </div>

        <div style={{ display: "flex", gap: "0.5em", marginBottom: "0.5em" }}>
          <input
            type="text"
            value={searchName}
            onChange={(e) => {
              setSearchName(e.target.value);
              setSelected(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search card name…"
            style={{ flex: 1 }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{ ...btn.primary(tabColor), fontSize: "0.8em", padding: "0.45em 1.1em" }}
          >
            {searching ? "…" : "Search"}
          </button>
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && !selected && (
          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: "0.6em",
            }}
          >
            {results.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setSearchName(r.name);
                  setResults([]);
                }}
                style={{
                  padding: "0.4em 0.8em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6em",
                  borderBottom: `1px solid ${T.border}`,
                  background: T.surface2,
                  color: T.text,
                  fontSize: 13,
                }}
              >
                {r.image && (
                  <img src={r.image} alt="" style={{ height: 28, borderRadius: 2 }} />
                )}
                {r.name}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "1em", flexWrap: "wrap" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4em",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={isFoil}
              onChange={(e) => setIsFoil(e.target.checked)}
            />
            <span style={{ color: isFoil ? T.gold : T.textDim }}>Foil</span>
          </label>

          <button
            onClick={handleAdd}
            disabled={!selected || adding}
            style={{
              ...btn.primary(tabColor),
              fontSize: "0.8em",
              padding: "0.45em 1.2em",
              opacity: !selected ? 0.5 : 1,
            }}
          >
            {adding ? "Adding…" : "Add to Collection"}
          </button>

          {Capacitor.isNativePlatform() && (
            <button
              onClick={() => navigate("/collection/scan")}
              style={{ ...btn.ghost(), fontSize: "0.8em", padding: "0.45em 1.1em" }}
            >
              Scan Card
            </button>
          )}
        </div>
      </div>

      {loading && <p style={{ color: T.textDim }}>Loading…</p>}
      {error && <p style={{ color: T.red }}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={{ fontSize: "0.75em", color: T.textDim, marginBottom: "0.8em" }}>
            {tabEntries.length} card{tabEntries.length !== 1 ? "s" : ""}
          </div>

          {tabEntries.length === 0 ? (
            <p style={{ color: T.textDim, fontStyle: "italic" }}>
              No cards yet — search above to add some.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.4em 0.6em",
                      color: T.textDim,
                      fontWeight: 600,
                      fontSize: "0.78em",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Card
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "0.4em 0.6em",
                      color: T.textDim,
                      fontWeight: 600,
                      fontSize: "0.78em",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Qty
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tabEntries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: `1px solid ${T.border}22` }}>
                    <td style={{ padding: "0.55em 0.6em", color: T.textBright }}>
                      {entry.card_id}
                      {entry.is_foil === 1 && (
                        <span
                          style={{
                            marginLeft: "0.5em",
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 10,
                            background: `${T.gold}22`,
                            color: T.gold,
                            border: `1px solid ${T.gold}55`,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          Foil
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.55em 0.6em", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.4em",
                        }}
                      >
                        <button
                          onClick={() => handleQuantity(entry, -1)}
                          style={{
                            width: 22,
                            height: 22,
                            border: `1px solid ${T.border}`,
                            background: T.surface2,
                            color: T.text,
                            cursor: "pointer",
                            borderRadius: 3,
                            fontSize: 14,
                            lineHeight: 1,
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            minWidth: 24,
                            textAlign: "center",
                            color: T.textBright,
                            fontWeight: 700,
                          }}
                        >
                          {entry.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantity(entry, 1)}
                          style={{
                            width: 22,
                            height: 22,
                            border: `1px solid ${T.border}`,
                            background: T.surface2,
                            color: T.text,
                            cursor: "pointer",
                            borderRadius: 3,
                            fontSize: 14,
                            lineHeight: 1,
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "0.55em 0.6em", textAlign: "right" }}>
                      <button
                        onClick={() => handleRemove(entry)}
                        style={{ ...btn.danger(), padding: "0.2em 0.7em", fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default CollectionPage;
