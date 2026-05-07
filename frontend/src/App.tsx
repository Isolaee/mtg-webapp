import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";

import HomePage from "./pages/HomePage";
import CreateDeckPage from "./pages/CreateDeckPage";
import LoadDeckPage from "./pages/LoadDeckPage";
import TestPage from "./pages/TestPage";
import CardBrowserPage from "./pages/riftbound/CardBrowserPage";
import DeckBuilderPage from "./pages/riftbound/DeckBuilderPage";

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1em" }}>
        <Nav />
        <ErrorBoundary>
          <Routes>
            {/* MTG */}
            <Route path="/" element={<HomePage />} />
            <Route path="/create-deck" element={<CreateDeckPage />} />
            <Route path="/load-deck" element={<LoadDeckPage />} />
            <Route path="/test" element={<TestPage />} />
            {/* Riftbound */}
            <Route path="/riftbound" element={<CardBrowserPage />} />
            <Route path="/riftbound/deck-builder" element={<DeckBuilderPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  </AuthProvider>
);

export default App;
