import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, hasRole } from "@/lib/auth-api";

interface RequireProctorAuthProps {
  children: ReactNode;
}

export default function RequireProctorAuth({ children }: RequireProctorAuthProps) {
  const location = useLocation();

  if (!isAuthenticated() || !hasRole("proctor")) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
