import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './state/auth.store';
import { ProtectedRoute } from './utils/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyPage from './pages/auth/VerifyPage';
import VerifyComplete from './pages/auth/VerifyComplete';
import StudentDashboard from './pages/student/StudentDashboard';
import SecurityDashboard from './pages/security/SecurityDashboard';
import SecurityAlertDetail from './pages/security/SecurityAlertDetail';
import SecurityHistory from './pages/security/SecurityHistory';
import AnalyticsPage from './pages/security/AnalyticsPage';

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
        <Route path="/verify" element={!isAuthenticated ? <VerifyPage /> : <Navigate to="/" />} />
        <Route path="/verify-complete" element={!isAuthenticated ? <VerifyComplete /> : <Navigate to="/" />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/security"
          element={
            <ProtectedRoute allowedRoles={['security']}>
              <SecurityDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/security/alert/:id"
          element={
            <ProtectedRoute allowedRoles={['security']}>
              <SecurityAlertDetail />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/security/history"
          element={
            <ProtectedRoute allowedRoles={['security']}>
              <SecurityHistory />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/security/analytics"
          element={
            <ProtectedRoute allowedRoles={['security']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
