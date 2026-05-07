import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { T, btn, panel } from "../theme";
import { ScanMatch, scanCard, addToCollection } from "../api";

type Stage = "idle" | "scanning" | "results";

const CollectionScanPage: React.FC = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [picked, setPicked] = useState<ScanMatch | null>(null);
  const [isFoil, setIsFoil] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    setError(null);
    setMatches([]);
    setPicked(null);
    setStage("scanning");
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 80,
        width: 800,
      });

      if (!photo.base64String) {
        setError("No image data returned from camera.");
        setStage("idle");
        return;
      }

      setPreview(`data:image/jpeg;base64,${photo.base64String}`);

      const results = await scanCard(photo.base64String);
      setMatches(results);
      setPicked(results[0] ?? null);
      setStage("results");
    } catch (e: unknown) {
      // User cancelled the camera — treat silently; any real error shown
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("dismiss")) {
        setError("Scan failed: " + msg);
      }
      setStage("idle");
    }
  };

  const handleAdd = async () => {
    if (!picked) return;
    setIsAdding(true);
    try {
      await addToCollection({ game: picked.game, card_id: picked.card_id, is_foil: isFoil });
      navigate("/collection");
    } catch (e: unknown) {
      setError("Could not add card: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsAdding(false);
    }
  };

  const confidenceLabel = (d: number) => {
    if (d <= 8) return { text: "Strong match", color: T.green };
    if (d <= 18) return { text: "Possible match", color: T.gold };
    return { text: "Weak match", color: T.textDim };
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.8em", marginBottom: "1.4em" }}>
        <button
          onClick={() => navigate("/collection")}
          style={{ ...btn.ghost(), padding: "0.3em 0.8em", fontSize: "0.8em" }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: "1.4em" }}>Scan Card</h1>
      </div>

      {/* Camera button */}
      {(stage === "idle" || stage === "scanning") && (
        <div style={{ ...panel, textAlign: "center", padding: "2em 1.6em" }}>
          {preview ? (
            <img
              src={preview}
              alt="Captured card"
              style={{ maxWidth: "100%", borderRadius: 6, marginBottom: "1.2em" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                paddingTop: "56%",
                background: T.surface2,
                borderRadius: 6,
                border: `2px dashed ${T.border}`,
                marginBottom: "1.2em",
                position: "relative",
              }}
            >
              <span
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
                Point camera at a card
              </span>
            </div>
          )}

          <button
            onClick={handleCapture}
            disabled={stage === "scanning"}
            style={{ ...btn.primary(T.blue), fontSize: "1em", padding: "0.6em 2em" }}
          >
            {stage === "scanning" ? "Scanning…" : "Take Photo"}
          </button>
        </div>
      )}

      {error && (
        <p style={{ color: T.red, fontSize: 13, marginTop: "0.8em" }}>{error}</p>
      )}

      {/* Match results */}
      {stage === "results" && matches.length > 0 && (
        <>
          <p style={{ color: T.textDim, fontSize: 13, marginBottom: "0.8em" }}>
            Select the correct card:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6em", marginBottom: "1.4em" }}>
            {matches.map((m) => {
              const conf = confidenceLabel(m.distance);
              const isSelected = picked?.card_id === m.card_id && picked?.game === m.game;
              const color = m.game === "mtg" ? T.blue : T.purple;
              return (
                <div
                  key={`${m.game}-${m.card_id}`}
                  onClick={() => setPicked(m)}
                  style={{
                    ...panel,
                    padding: "0.8em 1em",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.9em",
                    border: isSelected
                      ? `2px solid ${color}`
                      : `1px solid ${T.border}`,
                    transition: "border 0.1s",
                  }}
                >
                  {m.image && (
                    <img
                      src={m.image}
                      alt={m.card_name}
                      style={{ height: 56, borderRadius: 3, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: T.textBright,
                        fontSize: "0.95em",
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
                    <div style={{ fontSize: 11, color: conf.color, fontWeight: 600 }}>
                      {conf.text}
                    </div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
                      dist {m.distance}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Foil override + confirm */}
          <div style={{ ...panel }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5em",
                cursor: "pointer",
                marginBottom: "1em",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={isFoil}
                onChange={(e) => setIsFoil(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ color: isFoil ? T.gold : T.textDim }}>
                Foil
              </span>
              <span style={{ color: T.textDim, fontSize: 12, marginLeft: "0.3em" }}>
                (camera may not detect foiling — override here)
              </span>
            </label>

            <div style={{ display: "flex", gap: "0.6em" }}>
              <button
                onClick={handleAdd}
                disabled={!picked || isAdding}
                style={{
                  ...btn.primary(picked?.game === "riftbound" ? T.purple : T.blue),
                  flex: 1,
                  fontSize: "0.9em",
                  padding: "0.55em 0",
                  opacity: !picked ? 0.5 : 1,
                }}
              >
                {isAdding ? "Adding…" : "Add to Collection"}
              </button>
              <button
                onClick={() => {
                  setStage("idle");
                  setPreview(null);
                  setMatches([]);
                  setPicked(null);
                  setIsFoil(false);
                }}
                style={{ ...btn.ghost(), fontSize: "0.9em", padding: "0.55em 1em" }}
              >
                Rescan
              </button>
            </div>
          </div>
        </>
      )}

      {stage === "results" && matches.length === 0 && (
        <div style={{ ...panel, textAlign: "center", color: T.textDim, padding: "2em" }}>
          <p>No matches found.</p>
          <p style={{ fontSize: 12, marginTop: "0.4em" }}>
            Make sure the card art fills the frame and the image is in focus.
          </p>
          <button
            onClick={() => { setStage("idle"); setPreview(null); }}
            style={{ ...btn.ghost(), marginTop: "1em", fontSize: "0.85em" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default CollectionScanPage;
