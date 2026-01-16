import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './state/auth.store';
import { ProtectedRoute } from './utils/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const VerifyPage = lazy(() => import('./pages/auth/VerifyPage'));
const VerifyComplete = lazy(() => import('./pages/auth/VerifyComplete'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const SecurityDashboard = lazy(() => import('./pages/security/SecurityDashboard'));
const SecurityAlertDetail = lazy(() => import('./pages/security/SecurityAlertDetail'));
const SecurityHistory = lazy(() => import('./pages/security/SecurityHistory'));
const AnalyticsPage = lazy(() => import('./pages/security/AnalyticsPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

function App() {
  const { checkAuth, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen bg-black flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
          <Route path="/verify" element={!isAuthenticated ? <VerifyPage /> : <Navigate to="/" />} />
          <Route path="/verify-complete" element={!isAuthenticated ? <VerifyComplete /> : <Navigate to="/" />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate
                  to={user?.role === 'admin' ? '/admin' : user?.role === 'security' ? '/security' : '/dashboard'}
                  replace
                />
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

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
