// ============================================================
// ARKA Finance — Main App Router
// ============================================================

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/layout/Layout';
import { SetupPin } from './pages/SetupPin';
import { Login } from './pages/Login';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { TransactionForm } from './pages/TransactionForm';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Reports } from './pages/Reports';
import { hasPin } from './services/authService';
import { LoadingSpinner } from './components/ui';
import { ToastContainer } from './components/ui/Toast';

// ---- Protected Route ----
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ---- Dashboard Router (role-based) ----
function DashboardPage() {
  const { role } = useAuth();
  if (role === 'owner') return <OwnerDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  return <Navigate to="/login" replace />;
}

// ---- Inner App (needs auth context) ----
function AppInner() {
  const { isAuthenticated } = useAuth();
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    hasPin().then(exists => setPinExists(exists));
  }, [setupDone]);

  if (pinExists === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  // First-time setup
  if (!pinExists) {
    return (
      <>
        <SetupPin onComplete={() => setSetupDone(true)} />
        <ToastContainer />
      </>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/transaksi/baru"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <TransactionForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proyek"
        element={
          <ProtectedRoute>
            <Layout>
              <Projects />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proyek/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/laporan"
        element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route
        path="*"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}

// ---- Root App ----
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
