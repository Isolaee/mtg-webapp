import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:5000/api";

function HomePage() {
  const { token, login, logout } = useAuth();

  // State for login/register form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Handle login or register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const endpoint = isRegister ? "/register" : "/login";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.msg || "Unknown error");
        return;
      }
      if (isRegister) {
        setFormSuccess("Registration successful! You can now log in.");
        setIsRegister(false);
        setUsername("");
        setPassword("");
      } else {
        login(data.access_token);
        setUsername("");
        setPassword("");
      }
    } catch (err) {
      setFormError("Network error: " + (err as Error).message);
    }
  };

  return (
    <div className="App">
      <h1>Magic: The Gathering Web App</h1>
      <p>
        <strong>About this site:</strong>
        <br />
        This is a web application for Magic: The Gathering players. You can
        search for cards, view card details, and visualize your deck as a stack
        of cards. Registered users can log in to save and load their personal
        decks.
      </p>
      <div style={{ margin: "1em 0" }}>
        {token ? (
          <>
            <span style={{ marginRight: "1em" }}>Logged in</span>
            <button onClick={logout}>Log out</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "inline-block" }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ marginRight: "0.5em" }}
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginRight: "0.5em" }}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
            <button type="submit">{isRegister ? "Register" : "Log in"}</button>
            <button
              type="button"
              style={{ marginLeft: "0.5em" }}
              onClick={() => {
                setIsRegister(!isRegister);
                setFormError(null);
                setFormSuccess(null);
              }}
            >
              {isRegister ? "Switch to Log in" : "Switch to Register"}
            </button>
            {formError && (
              <div style={{ color: "red", marginTop: "0.5em" }}>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div style={{ color: "green", marginTop: "0.5em" }}>
                {formSuccess}
              </div>
            )}
          </form>
        )}
      </div>
      <p>
        Use the navigation above to explore features. Log in to access deck
        saving and loading!
      </p>
    </div>
  );
}

export default HomePage;
