import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "@/features/auth/api";
import { useAuthStore } from "@/stores/auth-store";

export function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const location = useLocation();
  const { user, hydrated } = useAuthStore();

  if (!hydrated) {
    return <div className="min-h-screen bg-[#020617] text-white" />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
