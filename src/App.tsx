import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminSubmissions } from './pages/AdminSubmissions';
import { AdminProperties } from './pages/AdminProperties';
import { AdminTeam } from './pages/AdminTeam';
import { AdminSettings } from './pages/AdminSettings';
import { AcceptInvite } from './pages/AcceptInvite';
import { VerificationWizard } from './pages/VerificationWizard';
import { ResetPassword } from './pages/ResetPassword';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/verify" element={<VerificationWizard />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute userType="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/submissions"
              element={
                <ProtectedRoute userType="admin">
                  <AdminSubmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/properties"
              element={
                <ProtectedRoute minRole="staff">
                  <AdminProperties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/team"
              element={
                <ProtectedRoute minRole="admin">
                  <AdminTeam />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute minRole="admin">
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
