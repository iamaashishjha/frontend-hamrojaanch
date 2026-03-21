import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, hasRole } from "@/lib/auth-api";

interface RequireAdminAuthProps {
  children: ReactNode;
}

/**
 * WHY: Previously checked localStorage.getItem("hj_admin") === "true" which
 *      allowed anyone to bypass auth by setting a flag. Now we check for a
 *      real JWT token AND verify the user role is admin/teacher.
 */
export default function RequireAdminAuth({ children }: RequireAdminAuthProps) {
  const location = useLocation();

  if (!isAuthenticated() || !hasRole("admin", "teacher")) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
