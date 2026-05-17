import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { T, btn, panel } from "../theme";
import { ScanMatch, scanCard, addToCollection } from "../api";

const SCAN_INTERVAL_MS = 1800;

const CollectionScanPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preferredGame = (new URLSearchParams(location.search).get("game") ?? null) as "mtg" | "riftbound" | null;

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false); // prevents overlapping scan requests

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Results
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [picked, setPicked] = useState<ScanMatch | null>(null);
  const [manuallyPicked, setManuallyPicked] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isFoil, setIsFoil] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const captureAndScan = useCallback(async () => {
    if (busyRef.current) return;
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    busyRef.current = true;
    setScanning(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

      const results = await scanCard(base64);
      if (results.length > 0) {
        setMatches(results);
        if (!manuallyPicked) {
          const preferred = preferredGame ? results.find((r) => r.game === preferredGame) : null;
          setPicked(preferred ?? results[0]);
        }
      }
    } catch {
      // silently ignore individual scan failures
    } finally {
      busyRef.current = false;
      setScanning(false);
    }
  }, [manuallyPicked, preferredGame]);

  // Restart interval whenever captureAndScan reference changes (manuallyPicked toggle)
  useEffect(() => {
    if (!cameraReady) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(captureAndScan, SCAN_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [captureAndScan, cameraReady]);

  // Start camera stream on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) setCameraError("Camera access denied — check app permissions.");
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [stopCamera]);

  const handlePick = (m: ScanMatch) => {
    setPicked(m);
    setManuallyPicked(true);
  };

  const handleAdd = async () => {
    if (!picked) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await addToCollection({ game: picked.game, card_id: picked.card_id, is_foil: isFoil });
      stopCamera();
      navigate("/collection");
    } catch {
      setAddError("Could not add card — try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRescan = () => {
    setMatches([]);
    setPicked(null);
    setManuallyPicked(false);
    setAddError(null);
  };

  const confidenceLabel = (d: number) => {
    if (d <= 8) return { text: "Strong", color: T.green };
    if (d <= 18) return { text: "Possible", color: T.gold };
    return { text: "Weak", color: T.textDim };
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.8em", marginBottom: "1.2em" }}>
        <button
          onClick={() => { stopCamera(); navigate("/collection"); }}
          style={{ ...btn.ghost(), padding: "0.3em 0.8em", fontSize: "0.8em" }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: "1.4em" }}>Scan Card</h1>
        {preferredGame && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 10,
              background: preferredGame === "riftbound" ? `${T.purple}22` : `${T.blue}22`,
              color: preferredGame === "riftbound" ? T.purple : T.blue,
              border: `1px solid ${preferredGame === "riftbound" ? T.purple : T.blue}55`,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {preferredGame === "riftbound" ? "Riftbound" : "MTG"}
          </span>
        )}
        {scanning && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: T.textDim, letterSpacing: "0.04em" }}>
            scanning…
          </span>
        )}
      </div>

      {/* Viewfinder */}
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          background: T.surface2,
          border: `1px solid ${T.border}`,
          marginBottom: "1em",
          aspectRatio: "4/3",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {/* Corner guide lines */}
        {cameraReady && !cameraError && (
          <>
            {[
              { top: 12, left: 12, borderTop: `2px solid ${T.gold}`, borderLeft: `2px solid ${T.gold}` },
              { top: 12, right: 12, borderTop: `2px solid ${T.gold}`, borderRight: `2px solid ${T.gold}` },
              { bottom: 12, left: 12, borderBottom: `2px solid ${T.gold}`, borderLeft: `2px solid ${T.gold}` },
              { bottom: 12, right: 12, borderBottom: `2px solid ${T.gold}`, borderRight: `2px solid ${T.gold}` },
            ].map((s, i) => (
              <div
                key={i}
                style={{ position: "absolute", width: 24, height: 24, ...s }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 12,
                color: `${T.goldLight}BB`,
                letterSpacing: "0.04em",
                textShadow: "0 1px 4px #000",
              }}
            >
              Centre the card art in the frame
            </div>
          </>
        )}

        {!cameraReady && !cameraError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.textDim,
              fontSize: 13,
            }}
          >
            Starting camera…
          </div>
        )}

        {cameraError && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5em",
              color: T.red,
              fontSize: 13,
              padding: "1em",
              textAlign: "center",
            }}
          >
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {/* Match list */}
      {matches.length > 0 && (
        <>
          <p style={{ color: T.textDim, fontSize: 12, marginBottom: "0.5em", letterSpacing: "0.03em" }}>
            {manuallyPicked ? "Your selection:" : "Best matches — tap to select:"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5em", marginBottom: "1em" }}>
            {matches.map((m) => {
              const conf = confidenceLabel(m.distance);
              const isSelected = picked?.card_id === m.card_id && picked?.game === m.game;
              const accent = m.game === "mtg" ? T.blue : T.purple;
              return (
                <div
                  key={`${m.game}-${m.card_id}`}
                  onClick={() => handlePick(m)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.8em",
                    padding: "0.65em 0.9em",
                    background: T.surface,
                    border: isSelected ? `2px solid ${accent}` : `1px solid ${T.border}`,
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {m.image && (
                    <img
                      src={m.image}
                      alt={m.card_name}
                      style={{ height: 52, borderRadius: 3, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: T.textBright,
                        fontSize: "0.92em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.card_name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
                      {m.game === "mtg" ? "MTG" : "Riftbound"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: conf.color }}>{conf.text}</div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>dist {m.distance}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Foil + add */}
          <div style={{ ...panel }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5em",
                cursor: "pointer",
                marginBottom: "0.9em",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={isFoil}
                onChange={(e) => setIsFoil(e.target.checked)}
                style={{ width: 15, height: 15 }}
              />
              <span style={{ color: isFoil ? T.gold : T.textDim }}>Foil</span>
              <span style={{ color: T.textDim, fontSize: 11, marginLeft: "0.2em" }}>
                (override — camera can't detect foiling)
              </span>
            </label>

            {addError && (
              <p style={{ color: T.red, fontSize: 12, marginBottom: "0.6em" }}>{addError}</p>
            )}

            <div style={{ display: "flex", gap: "0.6em" }}>
              <button
                onClick={handleAdd}
                disabled={!picked || isAdding}
                style={{
                  ...btn.primary(picked?.game === "riftbound" ? T.purple : T.blue),
                  flex: 1,
                  fontSize: "0.88em",
                  padding: "0.55em 0",
                  opacity: !picked ? 0.5 : 1,
                }}
              >
                {isAdding ? "Adding…" : "Add to Collection"}
              </button>
              <button
                onClick={handleRescan}
                style={{ ...btn.ghost(), fontSize: "0.88em", padding: "0.55em 1em" }}
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}

      {cameraReady && matches.length === 0 && !scanning && (
        <p style={{ color: T.textDim, fontSize: 13, textAlign: "center", marginTop: "0.5em" }}>
          Scanning continuously — hold a card steady in the frame.
        </p>
      )}
    </div>
  );
};

export default CollectionScanPage;
