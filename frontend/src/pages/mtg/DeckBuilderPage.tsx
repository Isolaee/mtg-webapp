import React, { useState, useEffect } from "react";
import FindCardForm from "../../components/FindCard";
import FoundCardsComponent from "../../components/FoundCardsComponent";
import StackVisualizer from "../../components/visualStack";
import DeckStats from "../../components/DeckStats";
import FormatSelection from "../../components/FormatSelection";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  MtgDeckSummary,
  fetchMtgDeckList,
  fetchMtgDeck,
  saveMtgDeck,
  authHeaders,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../theme";
import PageHeader from "../../components/PageHeader";
import CreateDeckModal, { CreateDeckMeta } from "../../components/CreateDeckModal";

const API_BASE_URL = process.env.REACT_APP_API_URL ?? "http://localhost:8080/api";

// Formats that play with a sideboard. Singleton formats (commander, brawl) do not.
const SIDEBOARD_FORMATS = new Set([
  "standard",
  "modern",
  "pioneer",
  "legacy",
  "vintage",
  "pauper",
  "historic",
  "alchemy",
]);

type Board = "main" | "side" | "maybe";
type ExportFormat = "plain" | "arena" | "mtgo";

interface DeckEntry {
  card: Card;
  count: number;
}

// ── Pure board helpers ─────────────────────────────────────────────────────────

function addOrIncrement(prev: DeckEntry[], card: Card): DeckEntry[] {
  const idx = prev.findIndex((e) => e.card.name === card.name);
  if (idx !== -1) {
    const u = [...prev];
    u[idx] = { ...u[idx], count: u[idx].count + 1 };
    return u;
  }
  return [...prev, { card, count: 1 }];
}

function decrementOrRemove(prev: DeckEntry[], name: string): DeckEntry[] {
  const idx = prev.findIndex((e) => e.card.name === name);
  if (idx === -1) return prev;
  if (prev[idx].count > 1) {
    const u = [...prev];
    u[idx] = { ...u[idx], count: u[idx].count - 1 };
    return u;
  }
  return prev.filter((_, i) => i !== idx);
}

// Group a flat (duplicated) card array into counted entries, preserving order.
function groupEntries(cards: Card[]): DeckEntry[] {
  const map = new Map<string, DeckEntry>();
  for (const card of cards) {
    const existing = map.get(card.name);
    map.set(card.name, { card, count: (existing?.count ?? 0) + 1 });
  }
  return [...map.values()];
}

const DeckBuilderPage: React.FC = () => {
  const { username } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [deck, setDeck] = useState<DeckEntry[]>([]);
  const [sideboard, setSideboard] = useState<DeckEntry[]>([]);
  const [maybeboard, setMaybeboard] = useState<DeckEntry[]>([]);
  const [deckName, setDeckName] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [format, setFormat] = useState("commander");
  const [commander, setCommander] = useState<Card | null>(null);
  const [suggestions, setSuggestions] = useState<Card[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<Board>("main");

  const [savedDecks, setSavedDecks] = useState<MtgDeckSummary[]>([]);
  const [selectedDeck, setSelectedDeck] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("plain");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // The builder UI stays hidden until a deck is started (created, prefilled, or loaded).
  const [deckStarted, setDeckStarted] = useState(false);

  const sideboardAllowed = SIDEBOARD_FORMATS.has(format);
  const setters: Record<Board, React.Dispatch<React.SetStateAction<DeckEntry[]>>> = {
    main: setDeck,
    side: setSideboard,
    maybe: setMaybeboard,
  };

  // Keep the add-target valid: sideboard isn't a target in singleton formats.
  useEffect(() => {
    if (!sideboardAllowed && addTarget === "side") setAddTarget("main");
  }, [sideboardAllowed, addTarget]);

  useEffect(() => {
    const preload = searchParams.get("load");
    if (preload) {
      setLoading(true);
      fetchMtgDeck(preload)
        .then((d) => applyLoadedDeck(d))
        .catch(() => setLoadError("Failed to load deck."))
        .finally(() => setLoading(false));
      return;
    }
    // New-deck prefill from the Create Deck dialog (via My Decks navigation).
    const n = searchParams.get("name");
    const f = searchParams.get("format");
    const d = searchParams.get("description");
    if (n !== null) {
      setDeckName(n);
      setDeckStarted(true);
    }
    if (f) setFormat(f);
    if (d !== null) setDeckDescription(d);
    if (searchParams.get("public") === "1" && username) setIsPublic(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLoadedDeck = (d: {
    name: string;
    description?: string;
    format: string;
    commander?: Card | null;
    cards: Card[];
    sideboard?: Card[];
    maybeboard?: Card[];
    is_public?: boolean;
    share_slug?: string;
  }) => {
    setDeckName(d.name);
    setDeckDescription(d.description ?? "");
    setFormat(d.format);
    setCommander(d.commander ?? null);
    setDeck(groupEntries(d.cards));
    setSideboard(groupEntries(d.sideboard ?? []));
    setMaybeboard(groupEntries(d.maybeboard ?? []));
    setIsPublic(d.is_public ?? false);
    setShareSlug(d.share_slug ?? null);
    setDeckStarted(true);
  };

  const openLoadPanel = async () => {
    setExportOpen(false);
    setLoadOpen(true);
    setLoadError(null);
    try {
      setSavedDecks(await fetchMtgDeckList());
    } catch {
      setLoadError("Could not fetch saved decks.");
    }
  };

  const loadDeck = async () => {
    if (!selectedDeck) return;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await fetchMtgDeck(selectedDeck);
      applyLoadedDeck(d);
      setLoadOpen(false);
      setSelectedDeck("");
    } catch {
      setLoadError("Failed to load deck.");
    } finally {
      setLoading(false);
    }
  };

  // Shared import path — accepts a file or a pasted-text Blob and posts it to
  // the existing multipart /upload_deck parser. Returns true on success.
  const submitImport = async (deckfile: Blob): Promise<boolean> => {
    const formData = new FormData();
    formData.append("deckfile", deckfile);
    formData.append("format", format);
    formData.append("deck_name", deckName);
    if (format === "commander" && commander) {
      formData.append("commander_name", commander.name);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/upload_deck`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        window.alert(
          res.status === 401
            ? "Log in to import a deck."
            : msg?.msg ?? "Failed to import deck.",
        );
        return false;
      }
      const data = await res.json();
      if (data.name && !deckName) setDeckName(data.name);
      if (data.commander) setCommander(data.commander);
      setDeck(groupEntries(data.cards ?? []));
      setSideboard(groupEntries(data.sideboard ?? []));
      setMaybeboard(groupEntries(data.maybeboard ?? []));
      const loaded =
        (data.cards?.length ?? 0) +
        (data.sideboard?.length ?? 0) +
        (data.maybeboard?.length ?? 0);
      window.alert(`Imported ${loaded} card${loaded === 1 ? "" : "s"}.`);
      return true;
    } catch {
      window.alert("Failed to import deck.");
      return false;
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await submitImport(file);
    // reset file input so the same file can be re-imported
    e.target.value = "";
  };

  const handlePasteImport = async () => {
    if (!importText.trim()) return;
    const ok = await submitImport(new Blob([importText], { type: "text/plain" }));
    if (ok) {
      setImportOpen(false);
      setImportText("");
    }
  };

  const handleAddCard = (card: Card) => {
    setters[addTarget]((prev) => addOrIncrement(prev, card));
  };

  const handleRemoveCard = (name: string, board: Board) => {
    setters[board]((prev) => decrementOrRemove(prev, name));
  };

  const handleMoveCard = (entry: DeckEntry, from: Board, to: Board) => {
    if (from === to) return;
    setters[from]((prev) => decrementOrRemove(prev, entry.card.name));
    setters[to]((prev) => addOrIncrement(prev, entry.card));
  };

  const handleSetCommander = (card: Card) => {
    setCommander(card);
  };

  const handleClear = () => {
    const hasContent =
      deck.length > 0 || sideboard.length > 0 || maybeboard.length > 0 || deckName.trim();
    if (hasContent && !window.confirm("Clear the current deck? This cannot be undone.")) return;
    setDeck([]);
    setSideboard([]);
    setMaybeboard([]);
    setCommander(null);
    setDeckName("");
    setDeckDescription("");
    setSuggestions([]);
    setAddTarget("main");
    setLoadOpen(false);
    setExportOpen(false);
    setIsPublic(false);
    setShareSlug(null);
    setDeckStarted(false);
  };

  // Apply metadata from the Create Deck dialog to a fresh deck. We're already
  // mounted on the builder, so set state directly (the mount effect won't re-fire).
  const handleCreateDeck = (meta: CreateDeckMeta) => {
    setDeck([]);
    setSideboard([]);
    setMaybeboard([]);
    setCommander(null);
    setSuggestions([]);
    setAddTarget("main");
    setLoadOpen(false);
    setExportOpen(false);
    setShareSlug(null);
    setDeckName(meta.name);
    setFormat(meta.format);
    setDeckDescription(meta.description);
    setIsPublic(meta.isPublic && !!username);
    setDeckStarted(true);
  };

  const flatten = (entries: DeckEntry[]): Card[] =>
    entries.flatMap((e) => Array(e.count).fill(e.card));

  const handleSave = async () => {
    if (!deckName.trim()) return;
    try {
      const result = await saveMtgDeck({
        name: deckName,
        format,
        description: deckDescription || undefined,
        commander: commander ?? undefined,
        cards: flatten(deck),
        sideboard: flatten(sideboard),
        maybeboard: flatten(maybeboard),
        is_public: isPublic,
      });
      if (result.share_slug) setShareSlug(result.share_slug);
      setSaveMsg("Deck saved!");
    } catch {
      setSaveMsg("Save failed.");
    }
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const publicShareUrl = (): string =>
    `${window.location.origin}${window.location.pathname}#/deck/public/${shareSlug}`;

  const handleCopyShareLink = async () => {
    if (!shareSlug) return;
    try {
      await navigator.clipboard.writeText(publicShareUrl());
      setShareMsg("Share link copied!");
    } catch {
      setShareMsg("Copy failed.");
    }
    setTimeout(() => setShareMsg(null), 3000);
  };

  // Decklist text in the selected export dialect. All variants are
  // round-trippable with the import parser (which recognises Commander/Deck/
  // Sideboard/Maybeboard section headers).
  const buildDeckText = (fmt: ExportFormat = exportFormat): string => {
    const lines: string[] = [];
    const list = (entries: DeckEntry[]) =>
      entries.forEach((e) => lines.push(`${e.count} ${e.card.name}`));

    if (fmt === "arena") {
      // MTG Arena: "Commander"/"Deck"/"Sideboard" sections, no maybeboard.
      if (commander) lines.push("Commander", `1 ${commander.name}`, "");
      lines.push("Deck");
      list(deck);
      if (sideboard.length > 0) {
        lines.push("", "Sideboard");
        list(sideboard);
      }
    } else if (fmt === "mtgo") {
      // MTGO: bare quantities, sideboard separated by a blank line.
      if (commander) lines.push(`1 ${commander.name}`);
      list(deck);
      if (sideboard.length > 0) {
        lines.push("");
        list(sideboard);
      }
    } else {
      // Plain text (default).
      if (commander) lines.push(`// Commander: ${commander.name}`);
      list(deck);
      if (sideboard.length > 0) {
        lines.push("", "Sideboard");
        list(sideboard);
      }
      if (maybeboard.length > 0) {
        lines.push("", "Maybeboard");
        list(maybeboard);
      }
    }
    return lines.join("\n");
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(buildDeckText());
      setExportMsg("Copied to clipboard!");
    } catch {
      setExportMsg("Copy failed.");
    }
    setTimeout(() => setExportMsg(null), 3000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([buildDeckText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(deckName.trim() || "deck").replace(/[^\w.-]+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const mainCards = flatten(deck);
  const mainTotal = deck.reduce((n, e) => n + e.count, 0);
  const sideTotal = sideboard.reduce((n, e) => n + e.count, 0);
  const maybeTotal = maybeboard.reduce((n, e) => n + e.count, 0);
  const deckEmpty = deck.length === 0 && sideboard.length === 0 && maybeboard.length === 0;

  const targets: { key: Board; label: string }[] = [
    { key: "main", label: "Main" },
    ...(sideboardAllowed ? [{ key: "side" as Board, label: "Sideboard" }] : []),
    { key: "maybe", label: "Maybe" },
  ];

  return (
    <div>
      <PageHeader title="MTG Deck Builder" accent={T.blue} />

      <CreateDeckModal
        isOpen={createOpen}
        game="mtg"
        loggedIn={!!username}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreateDeck}
      />

      {/* Create Deck — prompt for name/format/description, then start a fresh deck */}
      <div style={{ marginBottom: "0.75em" }}>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            padding: "0.55em 1.3em",
            background: T.green,
            color: T.bg,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.85em",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          + Create Deck
        </button>
      </div>

      {deckStarted && (
      <>
      {/* Save note — the deck only persists when you press Save Deck */}
      <div style={{ marginBottom: "0.75em", padding: "0.5em 0.9em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, color: T.textDim }}>
        This deck isn’t stored until you press{" "}
        <strong style={{ color: T.textBright }}>Save Deck</strong> — and only registered users can save.
        {!username && " Log in or register to save it."}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "0.6em", alignItems: "center", marginBottom: "0.75em", flexWrap: "wrap" }}>
        <FormatSelection value={format} onChange={setFormat} />
        <input
          type="text"
          placeholder="Deck name…"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          style={{ width: 180 }}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={deckDescription}
          onChange={(e) => setDeckDescription(e.target.value)}
          style={{ width: 200 }}
        />
        <button
          onClick={handleSave}
          disabled={!username || !deckName.trim()}
          title={!username ? "Log in to save decks" : undefined}
          style={{
            padding: "0.5em 1.2em",
            background: !username || !deckName.trim() ? `${T.blue}33` : `${T.blue}CC`,
            color: !username || !deckName.trim() ? T.textDim : T.bg,
            border: `1px solid ${T.blue}88`,
            borderRadius: 4,
            fontWeight: 700,
            fontSize: "0.85em",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: !username || !deckName.trim() ? "default" : "pointer",
          }}
        >
          Save Deck
        </button>
        {saveMsg && (
          <span style={{ fontSize: 13, color: saveMsg === "Deck saved!" ? T.green : T.red }}>
            {saveMsg}
            {saveMsg === "Deck saved!" && (
              <Link to="/my-decks" style={{ marginLeft: "0.6em", color: T.gold, fontWeight: 600 }}>
                View in My Decks →
              </Link>
            )}
          </span>
        )}
        <label
          title={!username ? "Log in to share decks" : "Make this deck publicly viewable via a share link"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35em",
            fontSize: "0.8em",
            fontWeight: 600,
            color: username ? T.textBright : T.textDim,
            cursor: username ? "pointer" : "default",
          }}
        >
          <input
            type="checkbox"
            checked={isPublic}
            disabled={!username}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public
        </label>
        {isPublic && shareSlug && (
          <button
            onClick={handleCopyShareLink}
            title="Copy a public read-only link to this deck"
            style={{
              padding: "0.5em 1.1em",
              background: "transparent",
              color: T.green,
              border: `1px solid ${T.green}66`,
              borderRadius: 4,
              fontWeight: 600,
              fontSize: "0.85em",
              cursor: "pointer",
            }}
          >
            Copy Share Link
          </button>
        )}
        {shareMsg && <span style={{ fontSize: 13, color: T.green }}>{shareMsg}</span>}
        {!username && (
          <span style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>
            Log in to save or load decks
          </span>
        )}
        <button
          onClick={loadOpen ? () => setLoadOpen(false) : openLoadPanel}
          disabled={!username}
          title={!username ? "Log in to load saved decks" : undefined}
          style={{
            padding: "0.5em 1.2em",
            background: "transparent",
            color: username ? T.gold : T.textDim,
            border: `1px solid ${username ? T.gold : T.border}55`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: username ? "pointer" : "default",
          }}
        >
          {loadOpen ? "Cancel" : "Load Deck"}
        </button>
        <button
          onClick={() => {
            setLoadOpen(false);
            setExportOpen((o) => !o);
          }}
          disabled={deckEmpty}
          title={deckEmpty ? "Add cards to export" : undefined}
          style={{
            padding: "0.5em 1.2em",
            background: "transparent",
            color: deckEmpty ? T.textDim : T.green,
            border: `1px solid ${deckEmpty ? T.border : T.green}66`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: deckEmpty ? "default" : "pointer",
          }}
        >
          {exportOpen ? "Close Export" : "Export"}
        </button>
        {username && deckName.trim() && (
          <button
            onClick={() => navigate(`/deck-analysis?deck=${encodeURIComponent(deckName)}`)}
            style={{
              padding: "0.5em 1.2em",
              background: "transparent",
              color: T.purple,
              border: `1px solid ${T.purple}66`,
              borderRadius: 4,
              fontWeight: 600,
              fontSize: "0.85em",
              cursor: "pointer",
            }}
          >
            Analyze
          </button>
        )}
        <label
          style={{
            padding: "0.5em 1.1em",
            background: "transparent",
            color: T.textDim,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: "pointer",
          }}
        >
          Import File
          <input type="file" accept=".txt" onChange={handleFileImport} style={{ display: "none" }} />
        </label>
        <button
          onClick={() => {
            setLoadOpen(false);
            setExportOpen(false);
            setImportOpen((o) => !o);
          }}
          style={{
            padding: "0.5em 1.1em",
            background: "transparent",
            color: importOpen ? T.gold : T.textDim,
            border: `1px solid ${importOpen ? T.gold : T.border}`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: "pointer",
          }}
        >
          {importOpen ? "Close Import" : "Import Text"}
        </button>
        <button
          onClick={handleClear}
          disabled={deckEmpty && !deckName.trim()}
          style={{
            padding: "0.5em 1.1em",
            background: "transparent",
            color: deckEmpty && !deckName.trim() ? T.textDim : T.red,
            border: `1px solid ${deckEmpty && !deckName.trim() ? T.border : T.red}66`,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: "0.85em",
            cursor: deckEmpty && !deckName.trim() ? "default" : "pointer",
          }}
        >
          Clear
        </button>
      </div>

      {/* Load panel */}
      {loadOpen && (
        <div style={{ marginBottom: "1em", padding: "0.8em 1em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
            style={{ width: "auto", minWidth: 220 }}
          >
            <option value="">— select a deck —</option>
            {savedDecks.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.format})
              </option>
            ))}
          </select>
          <button
            onClick={loadDeck}
            disabled={!selectedDeck || loading}
            style={{
              padding: "0.45em 1.1em",
              background: !selectedDeck || loading ? `${T.blue}33` : `${T.blue}CC`,
              color: T.bg,
              border: `1px solid ${T.blue}66`,
              borderRadius: 4,
              fontWeight: 700,
              fontSize: "0.85em",
              cursor: !selectedDeck || loading ? "default" : "pointer",
            }}
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {savedDecks.length === 0 && !loadError && (
            <span style={{ color: T.textDim, fontSize: 13 }}>No saved decks yet.</span>
          )}
          {loadError && <span style={{ color: T.red, fontSize: 13 }}>{loadError}</span>}
        </div>
      )}

      {/* Export panel */}
      {exportOpen && (
        <div style={{ marginBottom: "1em", padding: "0.8em 1em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
          <div style={{ display: "flex", gap: "0.4em", alignItems: "center", marginBottom: "0.6em", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Format
            </span>
            {([
              { key: "plain" as ExportFormat, label: "Plain" },
              { key: "arena" as ExportFormat, label: "Arena" },
              { key: "mtgo" as ExportFormat, label: "MTGO" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setExportFormat(key)}
                style={{
                  padding: "0.3em 0.9em",
                  background: exportFormat === key ? `${T.green}CC` : "transparent",
                  color: exportFormat === key ? T.bg : T.textBright,
                  border: `1px solid ${exportFormat === key ? T.green : T.border}`,
                  borderRadius: 4,
                  fontWeight: 600,
                  fontSize: "0.8em",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.6em", alignItems: "center", marginBottom: "0.6em", flexWrap: "wrap" }}>
            <button
              onClick={handleCopyExport}
              style={{ padding: "0.45em 1.1em", background: `${T.green}CC`, color: T.bg, border: `1px solid ${T.green}88`, borderRadius: 4, fontWeight: 700, fontSize: "0.85em", cursor: "pointer" }}
            >
              Copy to Clipboard
            </button>
            <button
              onClick={handleDownloadExport}
              style={{ padding: "0.45em 1.1em", background: "transparent", color: T.green, border: `1px solid ${T.green}66`, borderRadius: 4, fontWeight: 600, fontSize: "0.85em", cursor: "pointer" }}
            >
              Download .txt
            </button>
            {exportMsg && <span style={{ fontSize: 13, color: T.green }}>{exportMsg}</span>}
          </div>
          <textarea
            readOnly
            value={buildDeckText()}
            style={{ width: "100%", minHeight: 140, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 4, fontFamily: "monospace", fontSize: 12, padding: "0.5em", resize: "vertical" }}
          />
        </div>
      )}

      {/* Import-text panel */}
      {importOpen && (
        <div style={{ marginBottom: "1em", padding: "0.8em 1em", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: "0.5em" }}>
            Paste a decklist (e.g. <code>4 Lightning Bolt</code>). Lines under{" "}
            <code>Sideboard</code> / <code>Maybeboard</code> headers go to those boards.
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"4 Lightning Bolt\n2 Counterspell\n\nSideboard\n2 Negate"}
            style={{ width: "100%", minHeight: 140, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 4, fontFamily: "monospace", fontSize: 12, padding: "0.5em", resize: "vertical" }}
          />
          <div style={{ marginTop: "0.5em", display: "flex", gap: "0.6em", alignItems: "center" }}>
            <button
              onClick={handlePasteImport}
              disabled={!importText.trim()}
              style={{ padding: "0.45em 1.1em", background: importText.trim() ? `${T.gold}CC` : `${T.gold}33`, color: T.bg, border: `1px solid ${T.gold}88`, borderRadius: 4, fontWeight: 700, fontSize: "0.85em", cursor: importText.trim() ? "pointer" : "default" }}
            >
              Import
            </button>
            <span style={{ fontSize: 12, color: T.textDim }}>Replaces the current deck.</span>
          </div>
        </div>
      )}

      {/* Commander field */}
      {format === "commander" && (
        <div style={{ marginBottom: "0.75em", fontSize: 13, color: T.textDim }}>
          Commander:{" "}
          {commander ? (
            <span style={{ color: T.gold, fontWeight: 600 }}>
              {commander.name}{" "}
              <button
                onClick={() => setCommander(null)}
                style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 13, padding: "0 4px" }}
              >
                ×
              </button>
            </span>
          ) : (
            <span style={{ fontStyle: "italic" }}>none — search a card and click Commander</span>
          )}
        </div>
      )}

      {/* Add-target selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5em", marginBottom: "0.6em", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Add to
        </span>
        {targets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAddTarget(key)}
            style={{
              padding: "0.3em 0.9em",
              background: addTarget === key ? `${T.blue}CC` : "transparent",
              color: addTarget === key ? T.bg : T.textBright,
              border: `1px solid ${addTarget === key ? T.blue : T.border}`,
              borderRadius: 4,
              fontWeight: 600,
              fontSize: "0.8em",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Card search */}
      <FindCardForm onCardsFound={setSuggestions} />
      <FoundCardsComponent
        suggestions={suggestions}
        onAddToDeck={handleAddCard}
        format={format}
        commanderName={commander?.name}
        onAddCommander={handleSetCommander}
      />

      {/* Deck list */}
      {!deckEmpty && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "1em 1.2em", marginBottom: "1em" }}>
          <BoardSection
            label="Main Deck"
            count={mainTotal}
            board="main"
            entries={deck}
            sideboardAllowed={sideboardAllowed}
            onRemove={handleRemoveCard}
            onMove={handleMoveCard}
          />
          {sideboardAllowed && sideboard.length > 0 && (
            <BoardSection
              label="Sideboard"
              count={sideTotal}
              board="side"
              entries={sideboard}
              sideboardAllowed={sideboardAllowed}
              onRemove={handleRemoveCard}
              onMove={handleMoveCard}
            />
          )}
          {maybeboard.length > 0 && (
            <BoardSection
              label="Maybeboard"
              count={maybeTotal}
              board="maybe"
              entries={maybeboard}
              sideboardAllowed={sideboardAllowed}
              onRemove={handleRemoveCard}
              onMove={handleMoveCard}
            />
          )}
        </div>
      )}

      <DeckStats cards={mainCards} sideboardCount={sideboardAllowed ? sideTotal : undefined} format={format} />
      <StackVisualizer cards={mainCards} format={format} commanderName={commander?.name ?? ""} />
      </>
      )}
    </div>
  );
};

// ── Deck-list section ───────────────────────────────────────────────────────────

const BoardSection: React.FC<{
  label: string;
  count: number;
  board: Board;
  entries: DeckEntry[];
  sideboardAllowed: boolean;
  onRemove: (name: string, board: Board) => void;
  onMove: (entry: DeckEntry, from: Board, to: Board) => void;
}> = ({ label, count, board, entries, sideboardAllowed, onRemove, onMove }) => {
  if (entries.length === 0 && board !== "main") return null;
  // Destinations a card can be moved to from this board.
  const moves: { to: Board; label: string }[] = (
    [
      { to: "main" as Board, label: "→ Main" },
      { to: "side" as Board, label: "→ Side" },
      { to: "maybe" as Board, label: "→ Maybe" },
    ]
  ).filter((m) => m.to !== board && (m.to !== "side" || sideboardAllowed));

  return (
    <div style={{ marginBottom: "0.8em" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4em" }}>
        {label} ({count} {count === 1 ? "card" : "cards"})
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: T.textDim, fontStyle: "italic" }}>Empty.</div>
      ) : (
        entries.map((entry) => (
          <div key={entry.card.name} style={{ display: "flex", alignItems: "center", gap: "0.5em", padding: "0.2em 0", fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ flex: 1, color: T.textBright }}>{entry.card.name}</span>
            <span style={{ color: T.gold, fontWeight: 700, minWidth: 28, textAlign: "right" }}>×{entry.count}</span>
            {moves.map((m) => (
              <button
                key={m.to}
                onClick={() => onMove(entry, board, m.to)}
                title={`Move one copy to ${m.label.slice(2)}`}
                style={{ padding: "1px 6px", background: "none", border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}
              >
                {m.label}
              </button>
            ))}
            <button
              onClick={() => onRemove(entry.card.name, board)}
              style={{ padding: "1px 7px", background: "none", border: `1px solid ${T.border}`, borderRadius: 3, color: T.textDim, cursor: "pointer", fontSize: 13 }}
            >
              −
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default DeckBuilderPage;
