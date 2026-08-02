import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/auth-context';
import { RequireAuth } from '@/auth/require-auth';
import { DashboardPage } from '@/pages/DashboardPage';
import { DesignSystemDemoPage } from '@/pages/DesignSystemDemoPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

// Deliberately minimal routing — just enough to make "redirect if
// unauthenticated" a real, provable behavior rather than a guard
// component nobody can reach. The real layout shell (header, nav,
// candidate/recruiter/admin route structure) replaces this in the next
// commit; this is not the final route tree.
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/design-system" element={<DesignSystemDemoPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
