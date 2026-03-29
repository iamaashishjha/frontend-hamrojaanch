import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Linkedin, Lock, Mail, Twitter } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { clearAuth, login, isAuthenticated, hasRole, getStoredUser } from "@/lib/auth-api";
import { resolveSafeNextPath } from "@/lib/navigation";
import "./AdminLoginPage.css";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSiteSettings();

  const role = getStoredUser()?.role?.toLowerCase();

  // Determine the correct home route based on the current user's role.
  const getHomeRouteForRole = () => {
    const user = getStoredUser();
    if (!user) return "/dashboard";
    const role = user.role.toLowerCase();
    if (role === "proctor") return "/proctor";
    if (role === "teacher") return "/admin/teachers";
    // Default admin home
    return "/admin/dashboard";
  };

  const authenticated = isAuthenticated() && hasRole("admin", "teacher", "proctor");
  const footerLinks = settings.footer.links.filter((link) => link.label && link.href);
  const socialLinks = [
    { label: "Facebook", href: settings.socials.facebook, icon: Facebook },
    { label: "Twitter", href: settings.socials.twitter, icon: Twitter },
    { label: "LinkedIn", href: settings.socials.linkedin, icon: Linkedin },
  ].filter((item) => item.href);
  const next = useMemo(() => {
    const params = new URLSearchParams(location.search);
    // If a specific next is provided (deep link), honour it.
    // Otherwise pick dashboard based on role.
    return resolveSafeNextPath(params.get("next"), getHomeRouteForRole());
  }, [location.search, role]);

  const resolvedNext = useMemo(() => {
    // Prevent redirect loops: proctor should never land on admin routes.
    if (role === "proctor" && next.startsWith("/admin")) {
      return "/proctor";
    }
    return next;
  }, [next, role]);

  if (authenticated) {
    return <Navigate to={resolvedNext} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password.length < 1) {
      setError("Password is required.");
      return;
    }

    setLoading(true);
    try {
      const data = await login({ email: email.trim(), password });
      // Allow admin/teacher for admin panel, proctor for proctor portal
      if (!["admin", "teacher", "proctor"].includes(data.user.role)) {
        setError("Access denied. This portal is for administrators, teachers, and proctors only.");
        // Clear the token since this user shouldn't be here
        clearAuth();
        return;
      }

      // Route to the appropriate dashboard for the authenticated role,
      // unless a custom ?next=... was provided. If proctor, override to /proctor.
      const target =
        resolvedNext ||
        (data.user.role.toLowerCase() === "proctor"
          ? "/proctor"
          : data.user.role.toLowerCase() === "teacher"
          ? "/admin/teachers"
          : "/admin/dashboard");
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-shell">
        <header className="admin-login-brand">
          <LogoMark className="h-10 w-10" />
          <BrandText />
        </header>

        <div className="admin-login-card">
          <form className="admin-login-form" onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: "#fef2f2", color: "#b91c1c", padding: "0.625rem 0.875rem",
                borderRadius: "0.5rem", fontSize: "0.85rem", marginBottom: "0.5rem",
                border: "1px solid #fecaca"
              }}>
                {error}
              </div>
            )}

            <label>
              Email
              <div className="admin-input">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </label>

            <label>
              Password
              <div className="admin-input">
                <Lock size={16} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </label>

            <div className="admin-login-row">
              <label className="remember">
                <input type="checkbox" defaultChecked />
                Remember me
              </label>
              <a href="#forgot">Forgot password?</a>
            </div>

            <button type="submit" className="admin-login-submit" disabled={loading}>
              {loading ? "Signing in..." : "Log In"}
            </button>
          </form>
        </div>

        <footer className="admin-login-footer">
          <div className="footer-links">
            {footerLinks.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          {socialLinks.length > 0 ? (
            <div className="footer-social">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} aria-label={label}>
                  <Icon size={16} />
                </a>
              ))}
            </div>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
