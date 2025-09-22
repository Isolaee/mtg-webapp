import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TestPage from "./pages/TestPage";
import LoadDeckPage from "./pages/LoadDeckPage";
import CreateDeckPage from "./pages/CreateDeckPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <nav style={{ margin: "1em 0" }}>
          <Link to="/">Home</Link> | <Link to="/test">Test</Link> |{" "}
          <Link to="/LoadDeck">Load Deck</Link> |{" "}
          <Link to="/createDeck">Create Deck</Link>
        </nav>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="/loadDeck" element={<LoadDeckPage />} />
            <Route path="/createDeck" element={<CreateDeckPage />} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
};

export default App;
