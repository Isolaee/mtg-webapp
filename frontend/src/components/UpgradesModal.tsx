import React, { useEffect, useState } from "react";
import { fetchUpgrades, UpgradesResponse, UpgradeSwap, ManaReport } from "../api";
import { T } from "../theme";

interface UpgradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckName: string;
  format: string;
  isEmpty: boolean;
  onApplySwap: (cutName: string, addName: string) => Promise<void> | void;
}

type Tab = "perCard" | "holistic";

const UpgradesModal: React.FC<UpgradesModalProps> = ({
  isOpen,
  onClose,
  deckName,
  format,
  isEmpty,
  onApplySwap,
}) => {
  const [tab, setTab] = useState<Tab>("perCard");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UpgradesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    if (isEmpty) return;
    setLoading(true);
    setError(null);
    setData(null);
    setAppliedKeys(new Set());
    fetchUpgrades(deckName, format)
      .then(setData)
      .catch((e) => {
        const msg =
          e?.response?.data?.msg ??
          e?.message ??
          "Failed to fetch upgrade proposals.";
        setError(typeof msg === "string" ? msg : "Failed to fetch upgrade proposals.");
      })
      .finally(() => setLoading(false));
  }, [isOpen, isEmpty, deckName, format]);

  if (!isOpen) return null;

  const swapKey = (s: UpgradeSwap) => `${s.cut}→${s.add}`;

  const handleApply = async (swap: UpgradeSwap) => {
    const key = swapKey(swap);
    if (appliedKeys.has(key)) return;
    setAppliedKeys((prev) => new Set(prev).add(key));
    try {
      await onApplySwap(swap.cut, swap.add);
    } catch {
      // Revert mark on failure so the user can retry
      setAppliedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
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
          width: "min(900px, 100%)",
          maxHeight: "min(85vh, 800px)",
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
              Suggest Upgrades
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>
              {deckName || "Untitled deck"} · {format}
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

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
          <TabButton active={tab === "perCard"} onClick={() => setTab("perCard")}>
            Per-card swaps
          </TabButton>
          <TabButton active={tab === "holistic"} onClick={() => setTab("holistic")}>
            Holistic report
          </TabButton>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1em 1.2em" }}>
          {isEmpty ? (
            <EmptyState />
          ) : loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
          ) : !data ? (
            <LoadingState />
          ) : tab === "perCard" ? (
            <PerCardTab
              swaps={data.swaps}
              appliedKeys={appliedKeys}
              swapKey={swapKey}
              onApply={handleApply}
            />
          ) : (
            <HolisticTab
              landAdvice={data.landAdvice}
              topStrict={data.holistic.topStrict}
              topSidegrade={data.holistic.topSidegrade}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.7em 1.2em",
            borderTop: `1px solid ${T.border}`,
            fontSize: 12,
            color: T.textDim,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            Applied swaps update the deck in-memory. Click <b>Save Deck</b> to persist.
          </span>
          {appliedKeys.size > 0 && (
            <span style={{ color: T.green }}>{appliedKeys.size} applied</span>
          )}
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      background: "transparent",
      border: "none",
      borderBottom: active ? `2px solid ${T.gold}` : "2px solid transparent",
      color: active ? T.goldLight : T.textDim,
      padding: "0.7em 1em",
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      cursor: "pointer",
    }}
  >
    {children}
  </button>
);

const EmptyState: React.FC = () => (
  <div style={{ padding: "3em 1em", textAlign: "center", color: T.textDim }}>
    <div style={{ fontSize: 36, marginBottom: "0.4em" }}>·</div>
    <div style={{ fontSize: 14 }}>Add cards to your deck first.</div>
    <div style={{ fontSize: 12, marginTop: "0.4em" }}>
      Upgrade suggestions need a deck to analyze.
    </div>
  </div>
);

const LoadingState: React.FC = () => (
  <div style={{ padding: "3em 1em", textAlign: "center", color: T.textDim }}>
    <div style={{ fontSize: 14 }}>Analyzing deck…</div>
    <div style={{ fontSize: 12, marginTop: "0.4em" }}>
      Scanning the candidate pool for upgrades.
    </div>
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      padding: "1em 1.2em",
      background: `${T.red}22`,
      border: `1px solid ${T.red}66`,
      borderRadius: 4,
      color: T.red,
      fontSize: 13,
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 4 }}>Couldn't load upgrades</div>
    <div style={{ color: T.text }}>{message}</div>
  </div>
);

// ── Per-card tab ───────────────────────────────────────────────────────────

const PerCardTab: React.FC<{
  swaps: UpgradeSwap[];
  appliedKeys: Set<string>;
  swapKey: (s: UpgradeSwap) => string;
  onApply: (s: UpgradeSwap) => void;
}> = ({ swaps, appliedKeys, swapKey, onApply }) => {
  if (swaps.length === 0) {
    return (
      <div style={{ padding: "2em 1em", textAlign: "center", color: T.textDim, fontSize: 13 }}>
        No upgrade candidates found for this deck.
      </div>
    );
  }
  // Group by cut card
  const byCut = new Map<string, UpgradeSwap[]>();
  for (const s of swaps) {
    const arr = byCut.get(s.cut) ?? [];
    arr.push(s);
    byCut.set(s.cut, arr);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.7em" }}>
      {[...byCut.entries()].map(([cut, group]) => (
        <div
          key={cut}
          style={{
            background: T.surface2,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            padding: "0.7em 1em",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.textBright,
              marginBottom: "0.5em",
            }}
          >
            Replace <span style={{ color: T.gold }}>{cut}</span>
          </div>
          {group.map((s) => {
            const key = swapKey(s);
            const applied = appliedKeys.has(key);
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7em",
                  padding: "0.35em 0",
                  borderTop: `1px solid ${T.border}55`,
                }}
              >
                <KindChip kind={s.kind} />
                <span style={{ flex: 1, color: T.text, fontSize: 13 }}>
                  with <b style={{ color: T.goldLight }}>{s.add}</b>
                  <span style={{ marginLeft: 6, color: T.textDim }}>· {s.reason}</span>
                  {s.edhrecInclusionPct !== undefined && (
                    <span style={{ marginLeft: 6, color: T.textDim }}>
                      · EDHREC {s.edhrecInclusionPct.toFixed(0)}%
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onApply(s)}
                  disabled={applied}
                  style={{
                    padding: "0.3em 0.9em",
                    background: applied ? `${T.green}22` : "transparent",
                    color: applied ? T.green : T.gold,
                    border: `1px solid ${applied ? T.green : T.gold}66`,
                    borderRadius: 3,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: applied ? "default" : "pointer",
                  }}
                >
                  {applied ? "Applied" : "Apply"}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const KindChip: React.FC<{ kind: "strict" | "sidegrade" }> = ({ kind }) => {
  const color = kind === "strict" ? T.green : T.blue;
  const label = kind === "strict" ? "Strict" : "Sidegrade";
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
        color: color,
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
};

// ── Holistic tab ───────────────────────────────────────────────────────────

const HolisticTab: React.FC<{
  landAdvice: ManaReport;
  topStrict: UpgradeSwap[];
  topSidegrade: UpgradeSwap[];
}> = ({ landAdvice, topStrict, topSidegrade }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "1em" }}>
    <ManaBaseCard report={landAdvice} />
    <SummaryList title="Top strict upgrades" swaps={topStrict} />
    <SummaryList title="Top sidegrades" swaps={topSidegrade} />
  </div>
);

const ManaBaseCard: React.FC<{ report: ManaReport }> = ({ report }) => {
  const total = report.recommendedTotalLands;
  const current = report.currentTotalLands;
  const totalDelta = current - total;
  return (
    <div
      style={{
        background: T.surface2,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        padding: "0.9em 1em",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: T.textDim,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "0.5em",
        }}
      >
        Mana base
      </div>
      <div
        style={{
          display: "flex",
          gap: "1.2em",
          alignItems: "baseline",
          fontSize: 13,
          marginBottom: "0.7em",
        }}
      >
        <span style={{ color: T.text }}>
          Lands{" "}
          <b style={{ color: T.goldLight, fontSize: 18 }}>{current}</b>{" "}
          <span style={{ color: T.textDim }}>/ recommended {total}</span>
        </span>
        {totalDelta !== 0 && (
          <span style={{ color: totalDelta < 0 ? T.red : T.textDim }}>
            {totalDelta < 0 ? `add ${-totalDelta}` : `cut ${totalDelta}`}
          </span>
        )}
        <span style={{ color: T.textDim }}>
          avg MV {report.avgMv.toFixed(2)} · ramp {report.rampCount}
        </span>
      </div>
      {report.perColor.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3em" }}>
          {report.perColor.map((p) => {
            const pct = Math.min(100, (p.currentSources / Math.max(1, p.neededSources)) * 100);
            const short = p.currentSources < p.neededSources;
            const color = colorForMana(p.color);
            return (
              <div
                key={p.color}
                style={{ display: "flex", alignItems: "center", gap: "0.6em", fontSize: 12 }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: color,
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {p.color}
                </span>
                <div style={{ flex: 1, height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: short ? T.red : T.green,
                    }}
                  />
                </div>
                <span style={{ color: T.text, minWidth: 90, textAlign: "right" }}>
                  {p.currentSources} / {p.neededSources} for {p.maxPipDemand}-pip
                </span>
              </div>
            );
          })}
        </div>
      )}
      {report.suggestedAdds.length > 0 && (
        <ul style={{ marginTop: "0.7em", marginBottom: 0, paddingLeft: "1.2em", color: T.text, fontSize: 12 }}>
          {report.suggestedAdds.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {report.suggestedCuts.length > 0 && (
        <div style={{ marginTop: "0.5em", fontSize: 12, color: T.textDim }}>
          Consider cutting: {report.suggestedCuts.join(", ")}
        </div>
      )}
    </div>
  );
};

const colorForMana = (color: string): string => {
  switch (color) {
    case "W":
      return "#F8F4E3";
    case "U":
      return "#7BB7E0";
    case "B":
      return "#A29A93";
    case "R":
      return "#E26D5C";
    case "G":
      return "#7BC47F";
    default:
      return T.textDim;
  }
};

const SummaryList: React.FC<{ title: string; swaps: UpgradeSwap[] }> = ({ title, swaps }) => (
  <div
    style={{
      background: T.surface2,
      border: `1px solid ${T.border}`,
      borderRadius: 4,
      padding: "0.7em 1em",
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: T.textDim,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: "0.4em",
      }}
    >
      {title}
    </div>
    {swaps.length === 0 ? (
      <div style={{ color: T.textDim, fontSize: 12, fontStyle: "italic" }}>
        None found.
      </div>
    ) : (
      <ul style={{ margin: 0, paddingLeft: "1.2em", color: T.text, fontSize: 13 }}>
        {swaps.map((s, i) => (
          <li key={i}>
            <span style={{ color: T.gold }}>{s.cut}</span> →{" "}
            <b style={{ color: T.goldLight }}>{s.add}</b>
            {s.edhrecInclusionPct !== undefined && (
              <span style={{ color: T.textDim }}>
                {" "}
                · {s.edhrecInclusionPct.toFixed(0)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default UpgradesModal;
