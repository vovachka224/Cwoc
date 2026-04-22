import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import AuthPage from './pages/AuthPage';
import MainApp from './pages/MainApp';
import './App.css';

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-icon">✈</div>
        <div className="splash-text">Telegraph</div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <SocketProvider>
      <MainApp />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
