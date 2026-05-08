import React, { useEffect } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { AdMob } from "@capacitor-community/admob";
import Nav from "./components/Nav";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AdSlot from "./components/AdSlot";
import AndroidBanner from "./components/AndroidBanner";
import Footer from "./components/Footer";
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
import CollectionPage from "./pages/CollectionPage";
import CollectionScanPage from "./pages/CollectionScanPage";
import TournamentsPage from "./pages/TournamentsPage";
import DeckAnalysisPage from "./pages/mtg/DeckAnalysisPage";

const SLOT_ID_LEADERBOARD = "XXXXXXXXXX"; // replace with AdSense leaderboard ad unit slot ID

const AppInner: React.FC = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    AdMob.initialize({ initializeForTesting: false }).catch(() => {});
  }, []);

  return (
    <>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5em" }}>
        <Nav />
        <AdSlot slotId={SLOT_ID_LEADERBOARD} style={{ marginBottom: "0.5em" }} />
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
            {/* Collection */}
            <Route
              path="/collection"
              element={
                <ProtectedRoute>
                  <CollectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collection/scan"
              element={
                <ProtectedRoute>
                  <CollectionScanPage />
                </ProtectedRoute>
              }
            />
            {/* MTG Tournaments */}
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route
              path="/deck-analysis"
              element={
                <ProtectedRoute>
                  <DeckAnalysisPage />
                </ProtectedRoute>
              }
            />
            {/* Riftbound */}
            <Route path="/riftbound" element={<CardBrowserPage />} />
            <Route path="/riftbound/deck-builder" element={<RbDeckBuilderPage />} />
            <Route path="/riftbound/tournaments" element={<TournamentsPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <Footer />
      <AndroidBanner />
    </>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <AppInner />
    </Router>
  </AuthProvider>
);

export default App;
