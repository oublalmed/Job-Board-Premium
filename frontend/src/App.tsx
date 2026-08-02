import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/auth-context';
import { RequireAuth } from '@/auth/require-auth';
import { AppShell } from '@/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { DesignSystemDemoPage } from '@/pages/DesignSystemDemoPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

// Every route renders inside <AppShell /> (header, nav, language
// switcher, container). <RequireAuth /> gates the authenticated
// subtree; per-role subtrees (candidate/recruiter/admin) nest under it
// the same way once those flows exist — wrap the relevant <Route> group
// in <RequireRole roles={[...]} /> (see auth/require-role.tsx), nested
// one level deeper than /dashboard is here. No business routes exist
// yet — this is scaffolding only, per Front 0's scope.
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/design-system" element={<DesignSystemDemoPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
