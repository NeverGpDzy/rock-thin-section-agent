import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { AgentPage } from "@/pages/AgentPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { LoginPage } from "@/pages/LoginPage";
import { useAuthStore } from "@/store/authStore";

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PublicOnly = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <Routes>
    <Route
      path="/login"
      element={
        <PublicOnly>
          <LoginPage />
        </PublicOnly>
      }
    />
    <Route
      path="/"
      element={
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      }
    >
      <Route index element={<AgentPage />} />
      <Route path="agent" element={<AgentPage />} />
      <Route path="knowledge" element={<KnowledgePage />} />
      <Route path="history" element={<HistoryPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
