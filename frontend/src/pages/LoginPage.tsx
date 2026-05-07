import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const API_URL = "http://localhost:8080/api";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.msg ?? "Something went wrong.");
        return;
      }

      if (mode === "register") {
        setSuccess("Account created! You can now log in.");
        setMode("login");
        setPassword("");
      } else {
        login(data.access_token);
        navigate(from, { replace: true });
      }
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "65vh",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: T.surface,
          border: `1px solid ${T.borderGold}55`,
          borderTop: `3px solid ${T.gold}`,
          borderRadius: 6,
          padding: "2.2em 2em",
          boxShadow: `0 8px 40px #00000088`,
        }}
      >
        {/* Header */}
        <h1
          style={{
            textAlign: "center",
            fontSize: "1.4em",
            marginBottom: "1.6em",
            color: T.gold,
            letterSpacing: "0.06em",
          }}
        >
          TCG Builder
        </h1>

        {/* Mode tabs */}
        <div
          style={{
            display: "flex",
            marginBottom: "1.8em",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              style={{
                flex: 1,
                padding: "0.6em",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: mode === m ? 700 : 400,
                fontSize: "0.9em",
                fontFamily: "Cinzel, serif",
                letterSpacing: "0.04em",
                color: mode === m ? T.gold : T.textDim,
                borderBottom: mode === m ? `2px solid ${T.gold}` : "2px solid transparent",
                marginBottom: -1,
                textTransform: "uppercase",
              }}
            >
              {m === "login" ? "Log in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            autoFocus
            style={{ marginBottom: "1em" }}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            style={{ marginBottom: "1.2em" }}
          />

          {error && (
            <div style={{ color: "#E74C3C", fontSize: 13, marginBottom: "0.75em" }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ color: T.green, fontSize: 13, marginBottom: "0.75em" }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: "100%",
              padding: "0.65em",
              background: loading || !username || !password
                ? `${T.gold}44`
                : `linear-gradient(to bottom, ${T.gold}CC, ${T.gold}99)`,
              color: T.bg,
              border: `1px solid ${T.gold}88`,
              borderRadius: 4,
              fontWeight: 700,
              fontSize: "0.95em",
              fontFamily: "Cinzel, serif",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: "1.25em", textAlign: "center", fontSize: 13, color: T.textDim }}>
          {mode === "login" ? (
            <>No account?{" "}
              <button onClick={() => setMode("register")} style={linkBtnStyle}>Register</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} style={linkBtnStyle}>Log in</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: T.textDim,
  marginBottom: "0.35em",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: T.gold,
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
};

export default LoginPage;
