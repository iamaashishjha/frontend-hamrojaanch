import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import AppShell from "@/components/admin/AppShell";
import { getStoredUser } from "@/lib/auth-api";

// Paths that only admin may access. Teacher hitting these is redirected to dashboard (governance: no bypass).
const ADMIN_ONLY_PATHS = [
  "/admin/teachers",
  "/admin/exams/settings",
  "/admin/notification-templates",
  "/admin/integrations",
  "/admin/webhook-simulator",
  "/admin/subscription-plans",
  "/admin/payments-reconciliation",
  "/admin/site-settings",
  "/admin/site-pages",
  "/admin/evidence-audit",
  "/admin/file-vault",
  "/admin/institutions",
  "/admin/policies",
  "/admin/feature-flags",
  "/admin/review-queue",
  "/admin/appeals",
  "/admin/certificates",
  "/admin/abuse-logs",
  "/admin/security-events",
];

function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default function AdminLayout() {
  const location = useLocation();
  const user = getStoredUser();
  const isTeacherOnly = user?.role?.toLowerCase() === "teacher";

  useEffect(() => {
    document.documentElement.classList.add("hj-admin-font-scale");
    return () => {
      document.documentElement.classList.remove("hj-admin-font-scale");
    };
  }, []);

  if (isTeacherOnly && isAdminOnlyPath(location.pathname)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
