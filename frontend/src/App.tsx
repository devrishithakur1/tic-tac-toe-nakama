import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { NakamaProvider, useNakama } from './context/NakamaContext';
import { AuthPage } from './pages/AuthPage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { LeaderboardPage } from './pages/LeaderboardPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useNakama();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;
  if (!session) return <Navigate to="/" />;
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
      <Route path="/game/:matchId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <NakamaProvider>
      <Router>
        <AppRoutes />
      </Router>
    </NakamaProvider>
  );
}

export default App;
