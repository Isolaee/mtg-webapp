import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
        minHeight: "60vh",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "2em",
          boxShadow: "0 4px 24px #0001",
          background: "#fff",
        }}
      >
        {/* Mode tabs */}
        <div
          style={{
            display: "flex",
            marginBottom: "1.5em",
            borderBottom: "2px solid #eee",
          }}
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setSuccess(null);
              }}
              style={{
                flex: 1,
                padding: "0.6em",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontWeight: mode === m ? 700 : 400,
                fontSize: "1em",
                color: mode === m ? "#1a5276" : "#888",
                borderBottom: mode === m ? "2px solid #1a5276" : "2px solid transparent",
                marginBottom: -2,
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
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            style={inputStyle}
          />

          {error && (
            <div style={{ color: "#c0392b", fontSize: 13, marginBottom: "0.75em" }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ color: "#27ae60", fontSize: 13, marginBottom: "0.75em" }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: "100%",
              padding: "0.65em",
              background: "#1a5276",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: "1em",
              cursor: loading ? "default" : "pointer",
              opacity: !username || !password ? 0.6 : 1,
            }}
          >
            {loading ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: "1.25em", textAlign: "center", fontSize: 13, color: "#888" }}>
          {mode === "login" ? (
            <>No account?{" "}
              <button onClick={() => setMode("register")} style={linkBtnStyle}>
                Register
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} style={linkBtnStyle}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#444",
  marginBottom: "0.3em",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.55em 0.7em",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: "1em",
  marginBottom: "1em",
  boxSizing: "border-box",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#1a5276",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
};

export default LoginPage;
