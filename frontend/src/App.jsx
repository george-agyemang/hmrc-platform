import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { Login, Register } from './pages/Auth.jsx';
import ConnectHmrc from './pages/ConnectHmrc.jsx';
import { AuthSuccess, AuthError } from './pages/AuthCallbacks.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AddBusiness from './pages/AddBusiness.jsx';
import SubmitReturn from './pages/SubmitReturn.jsx';
import Settings from './pages/Settings.jsx';
import ITSAReturn from './pages/ITSAReturn.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';

function AppRoutes() {
  const { user, login, logout } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register onLogin={login} />} />
      <Route path="/auth/success" element={<AuthSuccess />} />
      <Route path="/auth/error" element={<AuthError />} />
      <Route path="/connect" element={<ProtectedRoute><ConnectHmrc /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard user={user} onLogout={logout} /></ProtectedRoute>} />
      <Route path="/businesses/new" element={<ProtectedRoute><AddBusiness /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings user={user} /></ProtectedRoute>} />
      <Route path="/businesses/:businessId/submit" element={<ProtectedRoute><SubmitReturn /></ProtectedRoute>} />
        <Route path="/businesses/:businessId/itsa" element={<ProtectedRoute><ITSAReturn /></ProtectedRoute>} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}
