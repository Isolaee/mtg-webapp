import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile, changePassword, UserProfile } from "../api";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(oldPw, newPw);
      setPwSuccess(true);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      const msg = err?.response?.data?.msg ?? "Failed to change password.";
      setPwError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  if (loadError) {
    return <p style={{ color: "#c0392b" }}>{loadError}</p>;
  }

  if (!profile) {
    return <p style={{ color: "#888" }}>Loading…</p>;
  }

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ marginBottom: "0.25em" }}>Profile</h1>

      {/* Account info card */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "1.4em 1.6em",
          marginBottom: "2em",
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75em", marginBottom: "1em" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#1a5276",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {profile.username[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.15em" }}>{profile.username}</div>
            {joinedDate && (
              <div style={{ fontSize: 13, color: "#888" }}>Member since {joinedDate}</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.5em" }}>
          <StatPill
            label="MTG Decks"
            value={profile.mtg_deck_count}
            color="#1a5276"
            onClick={() => navigate("/my-decks")}
          />
          <StatPill
            label="Riftbound Decks"
            value={profile.rb_deck_count}
            color="#6d2a8c"
            onClick={() => navigate("/my-decks")}
          />
        </div>
      </div>

      {/* Change password */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "1.4em 1.6em",
          background: "#fafafa",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1em", fontSize: "1.05em" }}>
          Change Password
        </h2>
        <form onSubmit={handleChangePassword}>
          <Field label="Current password">
            <input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          {pwError && (
            <div style={{ color: "#c0392b", fontSize: 13, marginBottom: "0.75em" }}>
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div style={{ color: "#27ae60", fontSize: 13, marginBottom: "0.75em" }}>
              Password updated successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading || !oldPw || !newPw || !confirmPw}
            style={{
              padding: "0.5em 1.4em",
              background: "#1a5276",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: "0.95em",
              cursor: pwLoading ? "default" : "pointer",
              opacity: !oldPw || !newPw || !confirmPw ? 0.6 : 1,
            }}
          >
            {pwLoading ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
};

const StatPill: React.FC<{
  label: string;
  value: number;
  color: string;
  onClick: () => void;
}> = ({ label, value, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: "none",
      border: `1px solid ${color}44`,
      borderRadius: 8,
      padding: "0.5em 1em",
      cursor: "pointer",
      textAlign: "center",
      minWidth: 110,
    }}
  >
    <div style={{ fontSize: "1.5em", fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
  </button>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div style={{ marginBottom: "1em" }}>
    <label
      style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: "0.3em" }}
    >
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.5em 0.7em",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: "1em",
  boxSizing: "border-box",
};

export default ProfilePage;
