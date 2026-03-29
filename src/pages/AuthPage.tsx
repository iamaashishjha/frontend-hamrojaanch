import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Facebook,
  Globe,
  Headphones,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import "./AuthPage.css";
import { useExamSession } from "@/hooks/useExamSession";
import { login, register } from "@/lib/auth-api";
import { resolveSafeNextPath } from "@/lib/navigation";

const highlights = [
  { label: "AI & Live Proctoring", icon: ShieldCheck },
  { label: "Secure & Private", icon: Lock },
  { label: "24/7 Support", icon: Headphones },
  { label: "GDPR Compliant", icon: BadgeCheck },
];

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { update } = useExamSession();
  const { settings } = useSiteSettings();
  const footerLinks = settings.footer.links.filter((link) => link.label && link.href);
  const privacyLink =
    footerLinks.find((link) => link.label.toLowerCase().includes("privacy"))?.href ?? "/pages/privacy";
  const termsLink =
    footerLinks.find((link) => link.label.toLowerCase().includes("terms"))?.href ?? "/pages/terms";
  const next = useMemo(() => {
    const params = new URLSearchParams(location.search);
    // Exam deep-links can still pass ?next=/system-check&examId=...
    return resolveSafeNextPath(params.get("next"), "");
  }, [location.search]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    // Validation
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      let role = "student";
      if (mode === "login") {
        const data = await login({ email: email.trim(), password });
        if (data.user.email) {
          update({ email: data.user.email });
        }
        role = data.user.role.toLowerCase();
      } else {
        const data = await register({
          email: email.trim(),
          name: name.trim(),
          password,
        });
        if (data.user.email) {
          update({ email: data.user.email });
        }
        role = data.user.role.toLowerCase();
      }
      const target =
        next ||
        (role === "admin"
          ? "/dashboard"
          : role === "teacher"
          ? "/admin/teachers"
          : role === "proctor"
          ? "/proctor"
          : "/student-dashboard");
      navigate(target, { replace: true });
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : "Something went wrong.";
      if (message === "Failed to fetch" || /cannot reach the backend/i.test(message)) {
        message =
          "Cannot reach the backend. Make sure it's running on http://localhost:4000 — run .\\run.bat or start the backend (e.g. cd backend && npx tsx watch src/index.ts).";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page public-page-scale">
      <div className="auth-shell">
        <div className="auth-surface">
          <section className="auth-visual">
            <div className="auth-visual-brand">
              <LogoMark className="h-10 w-10" />
              <BrandText />
            </div>
            <div className="auth-illustration">
              <div className="floating-card card-1">
                <Mail size={20} />
                <span>Secure Invites</span>
              </div>
              <div className="floating-card card-2">
                <ShieldCheck size={18} />
                <span>Identity Verified</span>
              </div>
              <div className="floating-card card-3">
                <Globe size={18} />
                <span>Remote Ready</span>
              </div>
              <div className="agent-card">
                <div className="agent-avatar">HJ</div>
                <div>
                  <h4>Proctor Assist</h4>
                  <p>Friendly support during every exam session.</p>
                </div>
              </div>
            </div>
            <div className="auth-visual-footer">
              <h3>Stay confident with secure exam delivery.</h3>
              <p>Verified ID checks, AI monitoring, and human proctoring in one place.</p>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-panel-header">
              <LogoMark className="h-9 w-9" />
              <BrandText />
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => setMode("login")}
              >
                Log In
              </button>
              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => setMode("register")}
              >
                Register
              </button>
            </div>

            <div className="auth-copy">
              <h2>{mode === "login" ? "Welcome Back!" : "Create Your Account"}</h2>
              <p>
                {mode === "login"
                  ? "Log in to your account to continue."
                  : "Register to access secure, verified exam sessions."}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div className="auth-error" style={{
                  background: "#fef2f2", color: "#b91c1c", padding: "0.625rem 0.875rem",
                  borderRadius: "0.5rem", fontSize: "0.85rem", marginBottom: "0.25rem",
                  border: "1px solid #fecaca"
                }}>
                  {error}
                </div>
              )}
              {mode === "register" && (
                <label className="auth-field">
                  <span>Full Name</span>
                  <div className="auth-input">
                    <User size={16} />
                    <input
                      type="text"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </label>
              )}
              <label className="auth-field">
                <span>Email</span>
                <div className="auth-input">
                  <Mail size={16} />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </label>
              <label className="auth-field">
                <span>Password</span>
                <div className="auth-input">
                  <Lock size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              {mode === "register" && (
                <label className="auth-field">
                  <span>Confirm Password</span>
                  <div className="auth-input">
                    <Lock size={16} />
                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </label>
              )}
              <div className="auth-row">
                <label className="remember-me">
                  <input type="checkbox" defaultChecked />
                  <span>Remember me</span>
                </label>
                <a href="#reset" className="auth-link">
                  Forgot password?
                </a>
              </div>

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Log In"
                  : "Register"}
              </button>
            </form>

            <div className="auth-switch">
              {mode === "login" ? (
                <span>
                  Don&apos;t have an account?{" "}
                  <button type="button" onClick={() => setMode("register")}>
                    Register
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{" "}
                  <button type="button" onClick={() => setMode("login")}>
                    Log in
                  </button>
                </span>
              )}
            </div>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <div className="social-row">
              <button type="button" className="social-btn">
                <Facebook size={18} />
                Log in with Facebook
              </button>
              <button type="button" className="social-btn">
                <Globe size={18} />
                Log in with Google
              </button>
            </div>

            <p className="auth-note">
              By continuing, you agree to the{" "}
              <a href={privacyLink} className="auth-link">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href={termsLink} className="auth-link">
                Terms of Service
              </a>
              .
            </p>
          </section>
        </div>

        <div className="auth-footer">
          <div className="auth-footer-highlights">
            {highlights.map(({ label, icon: Icon }) => (
              <div key={label} className="footer-item">
                <Icon size={16} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="auth-footer-links">
            {footerLinks.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </a>
            ))}
            <Link to="/">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
