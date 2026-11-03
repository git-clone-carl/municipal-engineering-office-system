import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Permits from './pages/Permits';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import RBAC from './pages/RBAC';
import Settings from './pages/Settings';

function PrivateRoute({ children, module }) {
  const { user, loading, hasAccess } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (module && !hasAccess(module)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<PrivateRoute module="dashboard"><Dashboard /></PrivateRoute>} />
        <Route path="/clients" element={<PrivateRoute module="clients"><Clients /></PrivateRoute>} />
        <Route path="/permits" element={<PrivateRoute module="permits"><Permits /></PrivateRoute>} />
        <Route path="/payments" element={<PrivateRoute module="payments"><Payments /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute module="reports"><Reports /></PrivateRoute>} />
        <Route path="/audit" element={<PrivateRoute module="audit_logs"><AuditLogs /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute module="users"><Users /></PrivateRoute>} />
        <Route path="/rbac" element={<PrivateRoute module="rbac"><RBAC /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute module="settings"><Settings /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
