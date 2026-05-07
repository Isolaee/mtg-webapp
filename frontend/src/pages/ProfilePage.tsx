import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { fetchProfile, changePassword, activatePremium, UserProfile } from "../api";
import { useAuth } from "../context/AuthContext";
import { T, panel, btn } from "../theme";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { isPremium, refreshPremium } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(() => setLoadError("Could not load profile."));
  }, []);

  const handlePurchasePremium = async () => {
    setPurchaseError(null);
    setPurchasing(true);
    try {
      // TODO: install an IAP plugin (e.g. @capgo/capacitor-purchases or cordova-plugin-purchase)
      // and replace the line below with a real purchase call for product "remove_ads".
      // After a confirmed purchase, call activatePremium with the purchase token.
      // Example: const { purchaseToken } = await YourIAPPlugin.purchase({ productId: "remove_ads" });
      await activatePremium("pending");
      refreshPremium();
    } catch {
      setPurchaseError("Purchase failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }

    setPwLoading(true);
    try {
      await changePassword(oldPw, newPw);
      setPwSuccess(true);
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      setPwError(err?.response?.data?.msg ?? "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  if (loadError) return <p style={{ color: T.red }}>{loadError}</p>;
  if (!profile) return <p style={{ color: T.textDim }}>Loading…</p>;

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ marginBottom: "1.5em" }}>Profile</h1>

      {/* Account card */}
      <div style={{ ...panel, marginBottom: "1.5em" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1em", marginBottom: "1.4em" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${T.blue}44, ${T.purple}44)`,
              border: `2px solid ${T.gold}88`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              color: T.goldLight,
              fontFamily: "Cinzel, serif",
              flexShrink: 0,
            }}
          >
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.15em", color: T.textBright, fontFamily: "Cinzel, serif" }}>
              {profile.username}
            </div>
            {joinedDate && (
              <div style={{ fontSize: 13, color: T.textDim, marginTop: 2 }}>
                Member since {joinedDate}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1em" }}>
          <StatPill label="MTG Decks" value={profile.mtg_deck_count} color={T.blue} onClick={() => navigate("/my-decks")} />
          <StatPill label="Riftbound Decks" value={profile.rb_deck_count} color={T.purple} onClick={() => navigate("/my-decks")} />
        </div>
      </div>

      {/* Premium status */}
      {isPremium ? (
        <div style={{ ...panel, marginBottom: "1.5em", display: "flex", alignItems: "center", gap: "0.6em" }}>
          <span style={{ color: T.green, fontSize: 18 }}>✓</span>
          <span style={{ color: T.green, fontSize: 14, fontWeight: 600 }}>Premium — ads disabled. Thank you for your support!</span>
        </div>
      ) : Capacitor.isNativePlatform() ? (
        <div style={{ ...panel, marginBottom: "1.5em" }}>
          <h2 style={{ fontSize: "1em", color: T.gold, letterSpacing: "0.06em", marginBottom: "0.5em" }}>Remove Ads</h2>
          <p style={{ color: T.textDim, fontSize: 13, marginBottom: "1em" }}>
            One-time purchase to remove all ads permanently and support development.
          </p>
          {purchaseError && <div style={{ color: T.red, fontSize: 13, marginBottom: "0.75em" }}>{purchaseError}</div>}
          <button
            onClick={handlePurchasePremium}
            disabled={purchasing}
            style={{ ...btn.primary(T.gold), opacity: purchasing ? 0.6 : 1 }}
          >
            {purchasing ? "Processing…" : "Upgrade — Remove Ads"}
          </button>
        </div>
      ) : null}

      {/* Change password */}
      <div style={panel}>
        <h2 style={{ marginBottom: "1.2em", fontSize: "1em", color: T.gold, letterSpacing: "0.06em" }}>
          Change Password
        </h2>
        <form onSubmit={handleChangePassword}>
          <Field label="Current password">
            <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required autoComplete="new-password" />
          </Field>

          {pwError && <div style={{ color: T.red, fontSize: 13, marginBottom: "0.75em" }}>{pwError}</div>}
          {pwSuccess && <div style={{ color: T.green, fontSize: 13, marginBottom: "0.75em" }}>Password updated successfully.</div>}

          <button
            type="submit"
            disabled={pwLoading || !oldPw || !newPw || !confirmPw}
            style={{
              padding: "0.5em 1.6em",
              background: !oldPw || !newPw || !confirmPw ? `${T.gold}33` : `linear-gradient(to bottom, ${T.gold}CC, ${T.gold}99)`,
              color: T.bg,
              border: `1px solid ${T.gold}88`,
              borderRadius: 4,
              fontWeight: 700,
              fontSize: "0.85em",
              fontFamily: "Cinzel, serif",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: pwLoading ? "default" : "pointer",
            }}
          >
            {pwLoading ? "Saving…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: number; color: string; onClick: () => void }> = ({ label, value, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: `${color}11`,
      border: `1px solid ${color}44`,
      borderRadius: 6,
      padding: "0.6em 1.2em",
      cursor: "pointer",
      textAlign: "center",
      minWidth: 120,
    }}
  >
    <div style={{ fontSize: "1.6em", fontWeight: 700, color, fontFamily: "Cinzel, serif" }}>{value}</div>
    <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{label}</div>
  </button>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: "1em" }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textDim, marginBottom: "0.35em", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {label}
    </label>
    {children}
  </div>
);

export default ProfilePage;
