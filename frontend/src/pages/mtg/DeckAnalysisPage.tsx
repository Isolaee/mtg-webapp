import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  compareDecks,
  CompareResponse,
  fetchSimilarDecks,
  SimilarResult,
  SimilarResponse,
} from "../../api";
import SimilarityBar from "../../components/SimilarityBar";
import { T, btn, panel } from "../../theme";

const MTG_FORMATS = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "pauper",
  "premodern",
];

const LIMITS = [10, 20, 50];

const scoreColor = (v: number): string => {
  if (v >= 0.7) return T.green;
  if (v >= 0.4) return T.gold;
  return T.blue;
};

const DeckAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [deckName, setDeckName] = useState(
    searchParams.get("deck") ?? "",
  );
  const [game, setGame] = useState<"mtg" | "riftbound">(
    (searchParams.get("game") as "mtg" | "riftbound") ?? "mtg",
  );
  const [format, setFormat] = useState("");
  const [limit, setLimit] = useState(20);

  const [response, setResponse] = useState<SimilarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comparing, setComparing] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Auto-run if deck name was pre-filled from ?deck=
  useEffect(() => {
    const pre = searchParams.get("deck");
    if (pre) {
      runSearch(pre, game, format, limit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (
    name: string,
    g: "mtg" | "riftbound",
    fmt: string,
    lim: number,
  ) => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setExpandedId(null);
    setCompareResult(null);
    try {
      const data = await fetchSimilarDecks(name.trim(), fmt || undefined, lim, g);
      setResponse(data);
    } catch (e: unknown) {
      const axiosMsg =
        e &&
        typeof e === "object" &&
        "response" in e
          ? (e as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : undefined;
      setError(axiosMsg ?? "Failed to find similar decks.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async (placementId: number) => {
    if (!deckName.trim() || !response) return;
    setComparing(placementId);
    setCompareError(null);
    setCompareResult(null);
    try {
      const result = await compareDecks(
        { type: "user", name: deckName.trim() },
        { type: "tournament", placementId },
      );
      setCompareResult(result);
      setExpandedId(placementId);
    } catch {
      setCompareError("Failed to compare decks.");
    } finally {
      setComparing(null);
    }
  };

  const placementLabel = (n: number | null): string => {
    if (n === null) return "";
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    if (n <= 4) return "Top 4";
    if (n <= 8) return "Top 8";
    if (n <= 16) return "Top 16";
    return `Top ${n}`;
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: "Cinzel, serif",
          color: T.gold,
          fontSize: "1.15em",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "1em",
        }}
      >
        Deck Analysis
      </h2>

      {/* Input panel */}
      <div style={{ ...panel, marginBottom: "1.4em" }}>
        {/* Game toggle */}
        <div
          style={{ display: "flex", gap: "0.4em", marginBottom: "1em" }}
        >
          {(["mtg", "riftbound"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGame(g)}
              style={{
                ...btn.ghost(),
                borderColor:
                  game === g ? T.gold : `${T.border}`,
                color: game === g ? T.gold : T.textDim,
                padding: "0.3em 0.9em",
                fontSize: "0.82em",
              }}
            >
              {g === "mtg" ? "MTG" : "Riftbound"}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.6em",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {/* Deck name input */}
          <div style={{ flex: "1 1 200px" }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: T.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Deck Name
            </label>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Your saved deck name…"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  runSearch(deckName, game, format, limit);
              }}
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                color: T.textBright,
                padding: "0.45em 0.7em",
                fontSize: "0.9em",
                width: "100%",
                boxSizing: "border-box" as const,
              }}
            />
          </div>

          {/* Format selector (MTG only) */}
          {game === "mtg" && (
            <div style={{ flex: "0 0 auto" }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: T.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                style={{
                  background: T.surface2,
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  color: T.text,
                  padding: "0.45em 0.6em",
                  fontSize: "0.9em",
                }}
              >
                <option value="">Any format</option>
                {MTG_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Limit selector */}
          <div style={{ flex: "0 0 auto" }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                color: T.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Top N
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                color: T.text,
                padding: "0.45em 0.6em",
                fontSize: "0.9em",
              }}
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            onClick={() => runSearch(deckName, game, format, limit)}
            disabled={!deckName.trim() || loading}
            style={{
              ...btn.primary(T.blue),
              opacity: !deckName.trim() || loading ? 0.5 : 1,
              cursor: !deckName.trim() || loading ? "default" : "pointer",
            }}
          >
            {loading ? "Searching…" : "Find Similar Decks"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            color: T.red,
            fontSize: 13,
            marginBottom: "1em",
            padding: "0.6em 0.8em",
            background: `${T.red}11`,
            border: `1px solid ${T.red}44`,
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      {response && response.results.length === 0 && (
        <div style={{ color: T.textDim, fontSize: 13, padding: "1.5em 0" }}>
          No similar tournament decks found for this format. Try a different format or run{" "}
          <code>/api/analysis/precompute</code> to seed the tag cache.
        </div>
      )}

      {/* Results */}
      {response && response.results.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: T.textDim,
              marginBottom: "0.8em",
              letterSpacing: "0.03em",
            }}
          >
            {response.results.length} similar decks found for{" "}
            <span style={{ color: T.gold }}>{response.deckName}</span>
            {response.format && (
              <>
                {" "}
                ·{" "}
                <span style={{ color: T.text }}>{response.format}</span>
              </>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.8em" }}>
            {response.results.map((result) => (
              <ResultCard
                key={result.placementId}
                result={result}
                expanded={expandedId === result.placementId}
                compareResult={
                  expandedId === result.placementId ? compareResult : null
                }
                comparing={comparing === result.placementId}
                compareError={
                  expandedId === result.placementId ? compareError : null
                }
                placementLabel={placementLabel}
                onCompare={() => handleCompare(result.placementId)}
                onToggle={() => {
                  if (expandedId === result.placementId) {
                    setExpandedId(null);
                    setCompareResult(null);
                  } else {
                    setExpandedId(result.placementId);
                    setCompareResult(null);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── ResultCard sub-component ─────────────────────────────────────────────────

interface ResultCardProps {
  result: SimilarResult;
  expanded: boolean;
  compareResult: CompareResponse | null;
  comparing: boolean;
  compareError: string | null;
  placementLabel: (n: number | null) => string;
  onCompare: () => void;
  onToggle: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({
  result,
  expanded,
  compareResult,
  comparing,
  compareError,
  placementLabel,
  onCompare,
  onToggle,
}) => {
  const overall = result.overallScore;
  const color = scoreColor(overall);

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${expanded ? T.borderGold : T.border}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          padding: "0.9em 1.1em",
          display: "flex",
          gap: "0.8em",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Overall score */}
        <div
          style={{
            fontSize: "1.6em",
            fontWeight: 800,
            color,
            minWidth: "3.2em",
            textAlign: "center" as const,
            fontFamily: "Cinzel, serif",
          }}
        >
          {(overall * 100).toFixed(0)}%
        </div>

        {/* Event info */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: T.textBright,
              fontSize: "0.92em",
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {result.eventName}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5em",
              flexWrap: "wrap",
              fontSize: 11,
              color: T.textDim,
            }}
          >
            {result.player && <span>{result.player}</span>}
            {result.placement && (
              <span style={{ color: T.gold }}>
                {placementLabel(result.placement)}
              </span>
            )}
            {result.format && (
              <span
                style={{
                  background: `${T.blue}22`,
                  color: T.blue,
                  border: `1px solid ${T.blue}44`,
                  borderRadius: 3,
                  padding: "0 0.4em",
                }}
              >
                {result.format}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.4em" }}>
          <button
            onClick={onCompare}
            disabled={comparing}
            style={{
              ...btn.ghost(),
              padding: "0.3em 0.8em",
              fontSize: "0.8em",
              opacity: comparing ? 0.6 : 1,
            }}
          >
            {comparing ? "Loading…" : "Compare"}
          </button>
          <button
            onClick={onToggle}
            style={{
              ...btn.ghost(),
              padding: "0.3em 0.8em",
              fontSize: "0.8em",
            }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Score bars (always visible) */}
      <div
        style={{
          padding: "0 1.1em 0.8em",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0 1.2em",
        }}
      >
        <SimilarityBar label="Overall" value={overall} color={color} />
        <SimilarityBar label="Semantic" value={result.semanticScore} color={T.purple} />
        <SimilarityBar label="Classic" value={result.classicScore} color={T.blue} />
        <SimilarityBar label="Jaccard" value={result.jaccard} color={T.blue} />
        <SimilarityBar label="Cosine" value={result.cosine} color={T.blue} />
        <SimilarityBar label="Color Match" value={result.colorScore} color={T.gold} />
        <SimilarityBar label="Curve Match" value={result.cmcScore} color={T.gold} />
      </div>

      {/* Expanded comparison detail */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: "1em 1.1em",
          }}
        >
          {compareError && (
            <div style={{ color: T.red, fontSize: 12, marginBottom: "0.6em" }}>
              {compareError}
            </div>
          )}
          {compareResult && (
            <CardDiffPanel result={compareResult} />
          )}
        </div>
      )}
    </div>
  );
};

// ── CardDiffPanel sub-component ──────────────────────────────────────────────

const CardDiffPanel: React.FC<{ result: CompareResponse }> = ({ result }) => {
  const colStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 160,
  };
  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: T.textDim,
    marginBottom: "0.5em",
    fontWeight: 700,
  };
  const listStyle: React.CSSProperties = {
    maxHeight: 220,
    overflowY: "auto" as const,
    fontSize: 12,
    color: T.text,
    lineHeight: 1.7,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "1.2em",
          flexWrap: "wrap",
        }}
      >
        <div style={colStyle}>
          <div style={headerStyle}>
            Shared ({result.sharedCards.length})
          </div>
          <div style={{ ...listStyle, color: T.textBright }}>
            {result.sharedCards.length === 0 ? (
              <span style={{ color: T.textDim }}>None</span>
            ) : (
              result.sharedCards.map((c) => <div key={c}>{c}</div>)
            )}
          </div>
        </div>

        <div style={colStyle}>
          <div style={headerStyle}>
            Only in Your Deck ({result.uniqueToA.length})
          </div>
          <div style={{ ...listStyle, color: T.blue }}>
            {result.uniqueToA.length === 0 ? (
              <span style={{ color: T.textDim }}>None</span>
            ) : (
              result.uniqueToA.map((c) => <div key={c}>{c}</div>)
            )}
          </div>
        </div>

        <div style={colStyle}>
          <div style={headerStyle}>
            Only in Tournament Deck ({result.uniqueToB.length})
          </div>
          <div style={{ ...listStyle, color: T.gold }}>
            {result.uniqueToB.length === 0 ? (
              <span style={{ color: T.textDim }}>None</span>
            ) : (
              result.uniqueToB.map((c) => <div key={c}>{c}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckAnalysisPage;
