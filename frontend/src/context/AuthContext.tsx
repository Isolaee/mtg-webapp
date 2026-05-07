import React, { createContext, useState, useContext, useEffect } from "react";
import { fetchProfile } from "../api";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isPremium: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshPremium: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeUsername(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

const STORAGE_KEY = "tcg_token";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const [isPremium, setIsPremium] = useState(false);

  const username = token ? decodeUsername(token) : null;

  useEffect(() => {
    if (!token) { setIsPremium(false); return; }
    fetchProfile().then((p) => setIsPremium(p.is_premium ?? false)).catch(() => {});
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setIsPremium(false);
  };

  const refreshPremium = () => {
    if (!token) return;
    fetchProfile().then((p) => setIsPremium(p.is_premium ?? false)).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ token, username, isPremium, login, logout, refreshPremium }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
