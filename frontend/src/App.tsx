import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { authApi, TokenResponse, User } from "@/features/auth/api";
import AdminDashboardPage from "@/features/auth/pages/admin-dashboard";
import ForgotPasswordPage from "@/features/auth/pages/forgot-password";
import LoginPage from "@/features/auth/pages/login";
import RegisterPage from "@/features/auth/pages/register";
import ResetPasswordPage from "@/features/auth/pages/reset-password";
import VerifyEmailPage from "@/features/auth/pages/verify-email";
import WelcomePage from "@/features/auth/pages/welcome";
import ChatPage from "@/pages/chat";
import DashboardPage from "@/pages/dashboard";
import DocumentIngestPage from "@/pages/document-ingest";
import DocumentsPage from "@/pages/documents";
import NotFound from "@/pages/not-found";
import ProfilePage from "@/pages/profile";
import SearchPage from "@/pages/search";
import SettingsPage from "@/pages/settings";
import { useAuthStore } from "@/stores/auth-store";

const queryClient = new QueryClient();

function SessionBootstrapper() {
  const { setSession, clearSession, setHydrated } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    authApi.get<User>("/auth/me")
      .then(({ data }) => {
        if (mounted) setSession(data, useAuthStore.getState().accessToken ?? "");
      })
      .catch(async () => {
        try {
          const { data } = await authApi.post<TokenResponse>("/auth/refresh");
          if (mounted) setSession(data.user, data.access_token);
        } catch {
          if (mounted) clearSession();
        }
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, [clearSession, setHydrated, setSession]);

  return null;
}

function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SessionBootstrapper />
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            <Route element={<ProtectedAppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/ingest" element={<DocumentIngestPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="/admin" element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/me" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
