import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  compareDecks,
  CompareResponse,
  fetchSimilarDecks,
  SimilarResult,
  SimilarResponse,
  fetchUpgrades,
  UpgradesResponse,
  UpgradeSwap,
  ManaReport,
} from "../../api";
import SimilarityBar from "../../components/SimilarityBar";
import CardHover from "../../components/CardHover";
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

type Tab = "analyze" | "swaps" | "holistic";

const scoreColor = (v: number): string => {
  if (v >= 0.7) return T.green;
  if (v >= 0.4) return T.gold;
  return T.blue;
};

const DeckAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [deckName, setDeckName] = useState(searchParams.get("deck") ?? "");
  const [game, setGame] = useState<"mtg" | "riftbound">(
    (searchParams.get("game") as "mtg" | "riftbound") ?? "mtg",
  );
  const [format, setFormat] = useState("");
  const [limit, setLimit] = useState(20);

  const [tab, setTab] = useState<Tab>("analyze");

  const [response, setResponse] = useState<SimilarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comparing, setComparing] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Upgrade proposals (drive the Per-card swaps + Holistic report tabs).
  const [upgrades, setUpgrades] = useState<UpgradesResponse | null>(null);
  const [upgradesFor, setUpgradesFor] = useState<string | null>(null);
  const [upgradesLoading, setUpgradesLoading] = useState(false);
  const [upgradesError, setUpgradesError] = useState<string | null>(null);

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
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : undefined;
      setError(axiosMsg ?? "Failed to find similar decks.");
    } finally {
      setLoading(false);
    }
  };

  // Lazily fetch upgrade proposals for the current deck when a swaps/holistic
  // tab is opened (or re-fetch when a different deck name is in the box).
  const loadUpgrades = async (name: string, fmt: string) => {
    if (!name.trim()) return;
    if (upgradesFor === name.trim() && upgrades) return; // already loaded
    setUpgradesLoading(true);
    setUpgradesError(null);
    setUpgrades(null);
    try {
      const data = await fetchUpgrades(name.trim(), fmt || "commander");
      setUpgrades(data);
      setUpgradesFor(name.trim());
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { msg?: string } } }).response?.data?.msg
          : undefined;
      setUpgradesError(msg ?? "Failed to fetch upgrade proposals.");
    } finally {
      setUpgradesLoading(false);
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    if ((next === "swaps" || next === "holistic") && deckName.trim()) {
      loadUpgrades(deckName, format);
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "analyze", label: "Analyze" },
    { key: "swaps", label: "Per-card swaps" },
    { key: "holistic", label: "Holistic report" },
  ];

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
        <div style={{ display: "flex", gap: "0.4em", marginBottom: "1em" }}>
          {(["mtg", "riftbound"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGame(g)}
              style={{
                ...btn.ghost(),
                borderColor: game === g ? T.gold : `${T.border}`,
                color: game === g ? T.gold : T.textDim,
                padding: "0.3em 0.9em",
                fontSize: "0.82em",
              }}
            >
              {g === "mtg" ? "MTG" : "Riftbound"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap", alignItems: "flex-end" }}>
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
                if (e.key === "Enter") runSearch(deckName, game, format, limit);
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
            onClick={() => {
              runSearch(deckName, game, format, limit);
              if (tab !== "analyze") loadUpgrades(deckName, format);
            }}
            disabled={!deckName.trim() || loading}
            style={{
              ...btn.primary(T.blue),
              opacity: !deckName.trim() || loading ? 0.5 : 1,
              cursor: !deckName.trim() || loading ? "default" : "pointer",
            }}
          >
            {loading ? "Searching…" : "Analyze Deck"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5em", marginBottom: "1.2em", borderBottom: `1px solid ${T.border}` }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            style={{
              padding: "0.5em 1em",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? `2px solid ${T.gold}` : "2px solid transparent",
              color: tab === t.key ? T.gold : T.textDim,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85em",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Analyze tab: similar tournament decks ── */}
      {tab === "analyze" && (
        <>
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

          {response && response.results.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: T.textDim, marginBottom: "0.8em", letterSpacing: "0.03em" }}>
                {response.results.length} similar decks found for{" "}
                <span style={{ color: T.gold }}>{response.deckName}</span>
                {response.format && (
                  <>
                    {" "}
                    · <span style={{ color: T.text }}>{response.format}</span>
                  </>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.8em" }}>
                {response.results.map((result) => (
                  <ResultCard
                    key={result.placementId}
                    result={result}
                    expanded={expandedId === result.placementId}
                    compareResult={expandedId === result.placementId ? compareResult : null}
                    comparing={comparing === result.placementId}
                    compareError={expandedId === result.placementId ? compareError : null}
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

          {!response && !error && (
            <div style={{ color: T.textDim, fontSize: 13 }}>
              Enter a saved deck name and click <b>Analyze Deck</b> to find similar tournament decks.
            </div>
          )}
        </>
      )}

      {/* ── Per-card swaps + Holistic report tabs ── */}
      {(tab === "swaps" || tab === "holistic") && (
        <>
          {!deckName.trim() ? (
            <div style={{ color: T.textDim, fontSize: 13 }}>
              Enter a saved deck name above to see suggestions.
            </div>
          ) : upgradesLoading ? (
            <div style={{ color: T.textDim, fontSize: 13 }}>Analyzing deck…</div>
          ) : upgradesError ? (
            <div style={{ color: T.red, fontSize: 13, padding: "0.6em 0.8em", background: `${T.red}11`, border: `1px solid ${T.red}44`, borderRadius: 4 }}>
              {upgradesError}
            </div>
          ) : !upgrades ? (
            <div style={{ color: T.textDim, fontSize: 13 }}>
              Click <b>Analyze Deck</b> to load suggestions.
            </div>
          ) : tab === "swaps" ? (
            <SwapsTab swaps={upgrades.swaps} />
          ) : (
            <HolisticTab data={upgrades} />
          )}
        </>
      )}
    </div>
  );
};

// ── Per-card swaps tab ───────────────────────────────────────────────────────

const KindChip: React.FC<{ kind: "strict" | "sidegrade" }> = ({ kind }) => {
  const color = kind === "strict" ? T.green : T.blue;
  return (
    <span
      style={{
        padding: "1px 8px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderRadius: 10,
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        whiteSpace: "nowrap",
      }}
    >
      {kind === "strict" ? "Strict" : "Sidegrade"}
    </span>
  );
};

const SwapRow: React.FC<{ swap: UpgradeSwap }> = ({ swap }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.7em", padding: "0.4em 0", borderTop: `1px solid ${T.border}55`, fontSize: 13 }}>
    <KindChip kind={swap.kind} />
    <span style={{ flex: 1, color: T.text }}>
      <CardHover name={swap.cut} style={{ color: T.gold }} /> →{" "}
      <CardHover name={swap.add} style={{ color: T.goldLight, fontWeight: 700 }} />
      {swap.reason && <span style={{ marginLeft: 6, color: T.textDim }}>· {swap.reason}</span>}
      {swap.edhrecInclusionPct !== undefined && (
        <span style={{ marginLeft: 6, color: T.textDim }}>· EDHREC {swap.edhrecInclusionPct.toFixed(0)}%</span>
      )}
    </span>
  </div>
);

const SwapsTab: React.FC<{ swaps: UpgradeSwap[] }> = ({ swaps }) => {
  if (swaps.length === 0) {
    return <div style={{ color: T.textDim, fontSize: 13 }}>No swap suggestions for this deck.</div>;
  }
  // Group by cut card.
  const byCut = new Map<string, UpgradeSwap[]>();
  for (const s of swaps) {
    const arr = byCut.get(s.cut) ?? [];
    arr.push(s);
    byCut.set(s.cut, arr);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.7em" }}>
      <p style={{ color: T.textDim, marginTop: 0, fontSize: 12 }}>Hover a card name to preview it.</p>
      {[...byCut.entries()].map(([cut, group]) => (
        <div key={cut} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "0.7em 1em" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright, marginBottom: "0.3em" }}>
            Replace <CardHover name={cut} style={{ color: T.gold }} />
          </div>
          {group.map((s, i) => (
            <SwapRow key={i} swap={s} />
          ))}
        </div>
      ))}
    </div>
  );
};

// ── Holistic report tab ──────────────────────────────────────────────────────

const colorForMana = (color: string): string => {
  switch (color) {
    case "W": return "#F8F4E3";
    case "U": return "#7BB7E0";
    case "B": return "#A29A93";
    case "R": return "#E26D5C";
    case "G": return "#7BC47F";
    default: return T.textDim;
  }
};

const HolisticTab: React.FC<{ data: UpgradesResponse }> = ({ data }) => {
  const r: ManaReport = data.landAdvice;
  const totalDelta = r.currentTotalLands - r.recommendedTotalLands;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1em" }}>
      {/* Mana base */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "0.9em 1em" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5em" }}>
          Mana base
        </div>
        <div style={{ display: "flex", gap: "1.2em", alignItems: "baseline", fontSize: 13, marginBottom: "0.7em", flexWrap: "wrap" }}>
          <span style={{ color: T.text }}>
            Lands <b style={{ color: T.goldLight, fontSize: 18 }}>{r.currentTotalLands}</b>{" "}
            <span style={{ color: T.textDim }}>/ recommended {r.recommendedTotalLands}</span>
          </span>
          {totalDelta !== 0 && (
            <span style={{ color: totalDelta < 0 ? T.red : T.textDim }}>
              {totalDelta < 0 ? `add ${-totalDelta}` : `cut ${totalDelta}`}
            </span>
          )}
          <span style={{ color: T.textDim }}>avg MV {r.avgMv.toFixed(2)} · ramp {r.rampCount}</span>
        </div>
        {r.perColor.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3em" }}>
            {r.perColor.map((p) => {
              const pct = Math.min(100, (p.currentSources / Math.max(1, p.neededSources)) * 100);
              const short = p.currentSources < p.neededSources;
              return (
                <div key={p.color} style={{ display: "flex", alignItems: "center", gap: "0.6em", fontSize: 12 }}>
                  <span
                    style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: colorForMana(p.color), color: "#000",
                      fontWeight: 700, fontSize: 11,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {p.color}
                  </span>
                  <div style={{ flex: 1, height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: short ? T.red : T.green }} />
                  </div>
                  <span style={{ color: T.text, minWidth: 110, textAlign: "right" }}>
                    {p.currentSources} / {p.neededSources} for {p.maxPipDemand}-pip
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {r.suggestedAdds.length > 0 && (
          <div style={{ marginTop: "0.7em", fontSize: 12, color: T.text }}>
            Consider adding:{" "}
            {r.suggestedAdds.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && ", "}
                <CardHover name={s} style={{ color: T.green }} />
              </React.Fragment>
            ))}
          </div>
        )}
        {r.suggestedCuts.length > 0 && (
          <div style={{ marginTop: "0.5em", fontSize: 12, color: T.textDim }}>
            Consider cutting:{" "}
            {r.suggestedCuts.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && ", "}
                <CardHover name={s} style={{ color: T.red }} />
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <SummaryList title="Top strict upgrades" swaps={data.holistic.topStrict} />
      <SummaryList title="Top sidegrades" swaps={data.holistic.topSidegrade} />
    </div>
  );
};

const SummaryList: React.FC<{ title: string; swaps: UpgradeSwap[] }> = ({ title, swaps }) => (
  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "0.7em 1em" }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.4em" }}>
      {title}
    </div>
    {swaps.length === 0 ? (
      <div style={{ color: T.textDim, fontSize: 12, fontStyle: "italic" }}>None found.</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2em", fontSize: 13 }}>
        {swaps.map((s, i) => (
          <div key={i} style={{ color: T.text }}>
            <CardHover name={s.cut} style={{ color: T.gold }} /> →{" "}
            <CardHover name={s.add} style={{ color: T.goldLight, fontWeight: 700 }} />
            {s.edhrecInclusionPct !== undefined && (
              <span style={{ color: T.textDim }}> · {s.edhrecInclusionPct.toFixed(0)}%</span>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

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
    <div style={{ background: T.surface, border: `1px solid ${expanded ? T.borderGold : T.border}`, borderRadius: 6, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ padding: "0.9em 1.1em", display: "flex", gap: "0.8em", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: "1.6em", fontWeight: 800, color, minWidth: "3.2em", textAlign: "center" as const, fontFamily: "Cinzel, serif" }}>
          {(overall * 100).toFixed(0)}%
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.textBright, fontSize: "0.92em", fontWeight: 600, marginBottom: 2 }}>
            {result.eventName}
          </div>
          <div style={{ display: "flex", gap: "0.5em", flexWrap: "wrap", fontSize: 11, color: T.textDim }}>
            {result.player && <span>{result.player}</span>}
            {result.placement && <span style={{ color: T.gold }}>{placementLabel(result.placement)}</span>}
            {result.format && (
              <span style={{ background: `${T.blue}22`, color: T.blue, border: `1px solid ${T.blue}44`, borderRadius: 3, padding: "0 0.4em" }}>
                {result.format}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.4em" }}>
          <button onClick={onCompare} disabled={comparing} style={{ ...btn.ghost(), padding: "0.3em 0.8em", fontSize: "0.8em", opacity: comparing ? 0.6 : 1 }}>
            {comparing ? "Loading…" : "Compare"}
          </button>
          <button onClick={onToggle} style={{ ...btn.ghost(), padding: "0.3em 0.8em", fontSize: "0.8em" }}>
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Score bars */}
      <div style={{ padding: "0 1.1em 0.8em", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.2em" }}>
        <SimilarityBar label="Overall" value={overall} color={color} />
        <SimilarityBar label="Semantic" value={result.semanticScore} color={T.purple} />
        <SimilarityBar label="Classic" value={result.classicScore} color={T.blue} />
        <SimilarityBar label="Jaccard" value={result.jaccard} color={T.blue} />
        <SimilarityBar label="Cosine" value={result.cosine} color={T.blue} />
        <SimilarityBar label="Color Match" value={result.colorScore} color={T.gold} />
        <SimilarityBar label="Curve Match" value={result.cmcScore} color={T.gold} />
      </div>

      {/* Expanded comparison */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "1em 1.1em" }}>
          {compareError && <div style={{ color: T.red, fontSize: 12, marginBottom: "0.6em" }}>{compareError}</div>}
          {compareResult && <CardDiffPanel result={compareResult} />}
        </div>
      )}
    </div>
  );
};

// ── CardDiffPanel sub-component ──────────────────────────────────────────────

const CardDiffPanel: React.FC<{ result: CompareResponse }> = ({ result }) => {
  const colStyle: React.CSSProperties = { flex: 1, minWidth: 160 };
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
    lineHeight: 1.7,
  };

  return (
    <div style={{ display: "flex", gap: "1.2em", flexWrap: "wrap" }}>
      <div style={colStyle}>
        <div style={headerStyle}>Shared ({result.sharedCards.length})</div>
        <div style={listStyle}>
          {result.sharedCards.length === 0 ? (
            <span style={{ color: T.textDim }}>None</span>
          ) : (
            result.sharedCards.map((c) => (
              <div key={c}><CardHover name={c} style={{ color: T.textBright }} /></div>
            ))
          )}
        </div>
      </div>

      <div style={colStyle}>
        <div style={headerStyle}>Only in Your Deck ({result.uniqueToA.length})</div>
        <div style={listStyle}>
          {result.uniqueToA.length === 0 ? (
            <span style={{ color: T.textDim }}>None</span>
          ) : (
            result.uniqueToA.map((c) => (
              <div key={c}><CardHover name={c} style={{ color: T.blue }} /></div>
            ))
          )}
        </div>
      </div>

      <div style={colStyle}>
        <div style={headerStyle}>Only in Tournament Deck ({result.uniqueToB.length})</div>
        <div style={listStyle}>
          {result.uniqueToB.length === 0 ? (
            <span style={{ color: T.textDim }}>None</span>
          ) : (
            result.uniqueToB.map((c) => (
              <div key={c}><CardHover name={c} style={{ color: T.gold }} /></div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DeckAnalysisPage;
