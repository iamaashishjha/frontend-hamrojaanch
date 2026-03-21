import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/lib/auth-api";

interface RequireRegistrationProps {
  children: ReactNode;
}

/**
 * WHY: Previously checked localStorage.getItem("hj_registered") === "true"
 *      which allowed anyone to bypass. Now we check for a real JWT token.
 */
export default function RequireRegistration({ children }: RequireRegistrationProps) {
  const location = useLocation();

  if (!isAuthenticated()) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <>{children}</>;
}
