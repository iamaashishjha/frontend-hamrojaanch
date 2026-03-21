import { Navigate, useLocation } from "react-router-dom";
import { getStoredUser, isAuthenticated } from "@/lib/auth-api";

export default function RedirectByRole() {
  const location = useLocation();

  if (!isAuthenticated()) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  const user = getStoredUser();
  const role = user?.role.toLowerCase();

  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  // Teacher lands on dashboard (approved structure); no longer on teachers list.
  if (role === "teacher") return <Navigate to="/admin/dashboard" replace />;
  if (role === "proctor") return <Navigate to="/proctor" replace />;

  // default: student or unknown role
  return <Navigate to="/student-dashboard" replace />;
}
