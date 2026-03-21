import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BarChart3,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Facebook,
  GraduationCap,
  IdCard,
  Laptop,
  Linkedin,
  Monitor,
  ShieldCheck,
  Smartphone,
  Twitter,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { getPublicAudienceBlocks } from "@/lib/landing-api";
import "./LandingPage.css";

const AUDIENCE_ICON_MAP: Record<string, LucideIcon> = {
  Users,
  Building2,
  Monitor,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  Laptop,
  BookOpen,
};

const navItems = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Pricing", href: "#cta" },
  { label: "For Institutions", href: "#how-it-works" },
  { label: "For Candidates", href: "#how-it-works" },
];

const trustSignals = [
  { label: "AI Proctoring", icon: ShieldCheck },
  { label: "Screen Monitoring", icon: Monitor },
  { label: "ID Verification", icon: IdCard },
  { label: "GDPR Compliant", icon: BadgeCheck },
  { label: "Cloud Based", icon: Cloud },
  { label: "Real-Time Alerts", icon: BellRing },
];

const steps = [
  { title: "Buy Exam", helper: "Pick from trusted exam listings." },
  { title: "Verify Identity", helper: "Complete secure ID verification." },
  { title: "Start Exam", helper: "Begin with live AI monitoring." },
  { title: "Get Results", helper: "Receive your score instantly." },
];

const marketplaceFeatures = [
  { label: "AI & Live Proctoring", icon: ShieldCheck },
  { label: "ID Verification", icon: IdCard },
  { label: "Advanced Reporting", icon: BarChart3 },
  { label: "LMS Integration", icon: Laptop },
];

const keyFeatures = [
  { label: "AI & Live Proctoring", icon: ShieldCheck },
  { label: "ID Verification", icon: IdCard },
  { label: "Advanced Reporting", icon: BarChart3 },
  { label: "LMS Integration", icon: BookOpen },
  { label: "Multi-Device Support", icon: Smartphone },
  { label: "Auto Violation Detection", icon: BellRing },
];

const testimonials = [
  {
    quote: "The best proctoring solution we've used. Highly reliable and secure.",
    author: "Sarah M, ABC University",
  },
  {
    quote: "Improved our exam integrity and increased our convenience.",
    author: "James R, CertTech",
  },
];

export default function LandingPage() {
  const { settings } = useSiteSettings();
  const { data: audienceBlocks = [] } = useQuery({
    queryKey: ["landing", "audience-blocks"],
    queryFn: getPublicAudienceBlocks,
  });
  const supportEmail = settings.contact.email;
  const footerLinks = settings.footer.links;
  const socialLinks = [
    { label: "Facebook", href: settings.socials.facebook, icon: Facebook },
    { label: "Twitter", href: settings.socials.twitter, icon: Twitter },
    { label: "LinkedIn", href: settings.socials.linkedin, icon: Linkedin },
  ].filter((item) => item.href);
  return (
    <div className="marketing-home public-page-scale">
      <div className="marketing-shell">
        <header className="marketing-nav">
          <Link to="/" className="brand">
            <LogoMark className="h-9 w-9" />
            <BrandText />
          </Link>

          <nav className="nav-links" aria-label="Main navigation">
            <a href="#features" className="nav-item">
              Features
              <ChevronDown aria-hidden className="nav-chevron" />
            </a>
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="nav-item">
                {item.label}
              </a>
            ))}
          </nav>

          <Link className="btn btn-primary btn-small" to="/all-exams">
            Browse Exams
          </Link>
        </header>

        <section className="hero-section">
          <div className="hero-copy reveal">
            <h1>
              Secure Online Proctored Exams
              <br />
              with <span>Built-in Exam Marketplace</span>
            </h1>
            <p>
              Conduct, sell, and monitor exams using AI &amp; live proctoring — built for Nepal, multi-tenant institutions, and NPR
              payments.
            </p>
            <div className="hero-actions">
              <Link to="/all-exams" className="btn btn-success">
                Browse Exams
              </Link>
              {/* Practice exam flows through real demo/proctored exam ex_003 */}
              <Link to="/system-check?examId=ex_003" className="btn btn-outline">
                Take Practice Exam
              </Link>
            </div>
          </div>

          <div className="hero-preview reveal">
            <div className="dashboard-mockup">
              <div className="dashboard-topbar">
                <div className="dot-row">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="dashboard-brand">Secure Portal</div>
                <div className="window-actions">
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="dashboard-body">
                <aside className="dashboard-side">
                  <span className="side-line wide" />
                  <span className="side-line" />
                  <span className="side-line" />
                  <span className="side-line" />
                  <span className="side-line short" />
                </aside>
                <div className="dashboard-main">
                  <div className="dash-title-row">
                    <h3>Exam Dashboard</h3>
                    <span className="status-pill">Session Live</span>
                  </div>
                  <div className="dash-grid">
                    <div className="dash-card">
                      <span className="dash-label">Exam Attempts</span>
                      <strong>302</strong>
                    </div>
                    <div className="dash-card">
                      <span className="dash-label">Alerts</span>
                      <strong>3</strong>
                    </div>
                    <div className="dash-card">
                      <span className="dash-label">Verified IDs</span>
                      <strong>299</strong>
                    </div>
                    <div className="dash-card">
                      <span className="dash-label">Completed</span>
                      <strong>286</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="proctor-card">
              <div className="proctor-lock" aria-hidden>
                <ShieldCheck size={14} />
              </div>
              <div className="proctor-avatar">
                <span>AI</span>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          {trustSignals.map(({ label, icon: Icon }) => (
            <div key={label} className="trust-item">
              <Icon className="trust-icon" />
              <span>{label}</span>
            </div>
          ))}
        </section>

        <main className="page-content">
          <section className="section-card reveal" id="how-it-works">
            <h2 className="section-title">How It Works</h2>
            <div className="switch-pill" role="tablist" aria-label="Audience selector">
              <button type="button" className="active">
                For Candidates
              </button>
              <button type="button">For Organizations</button>
            </div>

            <div className="steps-grid">
              {steps.map((step, index) => (
                <article className="step-card" key={step.title}>
                  <div className="step-title">
                    <span className="step-number">{index + 1}</span>
                    <h3>{step.title}</h3>
                  </div>
                  <p>{step.helper}</p>
                  <div className="step-illustration" aria-hidden>
                    <span className="pill long" />
                    <span className="pill short" />
                  </div>
                </article>
              ))}
            </div>

            <Link to="/all-exams" className="btn btn-warning center-btn">
              Browse All Exams
              <ChevronRight size={16} />
            </Link>
          </section>

          <section className="section-card compact reveal">
            <h2 className="section-title">Built-in Exam Marketplace</h2>
            <div className="feature-strip">
              {marketplaceFeatures.map(({ label, icon: Icon }) => (
                <div key={label} className="feature-strip-item">
                  <Icon className="feature-icon" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="section-card compact reveal" id="features">
            <h2 className="section-title">Key Features</h2>
            <div className="feature-strip expanded">
              {keyFeatures.map(({ label, icon: Icon }) => (
                <div key={label} className="feature-strip-item">
                  <Icon className="feature-icon" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>

          {audienceBlocks.length > 0 && (
            <section className="section-card reveal" id="audiences">
              <h2 className="section-title">Who Uses HamroJaanch?</h2>
              <div className="steps-grid">
                {audienceBlocks.map((block, index) => {
                  const IconComponent = block.icon ? AUDIENCE_ICON_MAP[block.icon] : null;
                  return (
                  <article className="step-card" key={block.id}>
                    <div className="step-title">
                      <span className="step-number">{index + 1}</span>
                      <h3 className={IconComponent ? "flex items-center gap-2" : ""}>
                        {IconComponent && <IconComponent size={20} className="shrink-0 text-primary" />}
                        {block.title}
                      </h3>
                    </div>
                    <p>{block.description || ""}</p>
                    <div className="step-illustration" aria-hidden>
                      <span className="pill long" />
                      <span className="pill short" />
                    </div>
                    {(block.ctaLabel && block.ctaHref) && (
                      <div className="audience-cta-row">
                        {block.ctaHref.startsWith("http") ? (
                          <a href={block.ctaHref} className="btn btn-outline btn-small" target="_blank" rel="noreferrer">
                            {block.ctaLabel}
                          </a>
                        ) : (
                          <Link to={block.ctaHref} className="btn btn-outline btn-small">
                            {block.ctaLabel}
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="testimonial-zone reveal">
            <div className="laptop-mockup">
              <div className="laptop-screen">
                <div className="screen-sidebar">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="screen-main">
                  <div className="screen-row wide" />
                  <div className="screen-row" />
                  <div className="screen-row" />
                </div>
              </div>
              <div className="laptop-base" />
            </div>

            <div className="testimonial-panel">
              <h2>What Our Clients Say</h2>
              {testimonials.map(({ quote, author }, index) => (
                <article key={author} className="testimonial-item">
                  <div className="person-badge">{index === 0 ? "S" : "J"}</div>
                  <div>
                    <p>&quot;{quote}&quot;</p>
                    <span>- {author}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <section className="cta-band" id="cta">
          <h2>Start Secure Online Exams Today</h2>
          <div className="cta-actions">
            <Link className="btn btn-success" to="/all-exams">
              Browse Exams
            </Link>
            <a className="btn btn-light" href={supportEmail ? `mailto:${supportEmail}` : "#"}>
              Contact Sales
            </a>
          </div>
        </section>

                <footer className="marketing-footer">
          <div className="footer-links">
            {footerLinks.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <div className="social-links" aria-label="Social media links">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href ?? "#"} aria-label={label}>
                <Icon size={16} />
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}




