import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import SignUp from './pages/auth/SignUp';
import Login from './pages/auth/Login';
import GitHubCallback from './pages/auth/GitHubCallback';
import Overview from './pages/Overview';
import APIKeys from './pages/APIKeys';
import Playground from './pages/Playground';
import UsageLogs from './pages/UsageLogs';
import RequestLogs from './pages/RequestLogs';
import BuyCredits from './pages/BuyCredits';
import Models from './pages/Models';
import Documentation from './pages/Documentation';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import KnowledgeBase from './pages/KnowledgeBase';
import Agents from './pages/Agents';
import Prompts from './pages/Prompts';
import BatchInference from './pages/BatchInference';
import Evaluate from './pages/Evaluate';
import Guardrails from './pages/Guardrails';
import MCPServers from './pages/MCPServers';

import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import NotificationCenter from './components/NotificationCenter';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DashboardProvider>
          <NotificationCenter />
          <Routes>
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/github/callback" element={<GitHubCallback />} />

            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Overview />} />
              <Route path="api-keys" element={<APIKeys />} />
              <Route path="playground" element={<Playground />} />
              <Route path="usage-logs" element={<UsageLogs />} />
              <Route path="usage-analytics" element={<UsageLogs />} />
              <Route path="request-logs" element={<RequestLogs />} />
              <Route path="buy-credits" element={<BuyCredits />} />
              <Route path="models" element={<Models />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="agents" element={<Agents />} />
              <Route path="prompts" element={<Prompts />} />
              <Route path="batch" element={<BatchInference />} />
              <Route path="evaluate" element={<Evaluate />} />
              <Route path="guardrails" element={<Guardrails />} />
              <Route path="mcp-servers" element={<MCPServers />} />
              <Route path="documentation" element={<Documentation />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
            </Route>
        </Routes>
        </DashboardProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
