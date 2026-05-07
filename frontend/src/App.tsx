import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MtgDeckBuilderPage from "./pages/mtg/DeckBuilderPage";
import MtgCardBrowserPage from "./pages/mtg/CardBrowserPage";
import TestPage from "./pages/TestPage";
import CardBrowserPage from "./pages/riftbound/CardBrowserPage";
import RbDeckBuilderPage from "./pages/riftbound/DeckBuilderPage";
import MyDecksPage from "./pages/MyDecksPage";
import ProfilePage from "./pages/ProfilePage";

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5em" }}>
        <Nav />
        <ErrorBoundary>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            {/* MTG */}
            <Route path="/" element={<HomePage />} />
            <Route path="/cards" element={<MtgCardBrowserPage />} />
            <Route path="/deck-builder" element={<MtgDeckBuilderPage />} />
            <Route path="/test" element={<TestPage />} />
            <Route
              path="/my-decks"
              element={
                <ProtectedRoute>
                  <MyDecksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            {/* Riftbound */}
            <Route path="/riftbound" element={<CardBrowserPage />} />
            <Route path="/riftbound/deck-builder" element={<RbDeckBuilderPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  </AuthProvider>
);

export default App;
