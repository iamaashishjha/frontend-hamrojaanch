import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, Users } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { listSubscriptionPlansPublic, type SubscriptionPlan } from "@/lib/subscription-plans-api";
import "./PricingPage.css";

function formatPrice(plan: SubscriptionPlan) {
  const suffix = plan.interval === "monthly" ? "/month" : "/year";
  return `${plan.currency} ${plan.price.toLocaleString()} ${suffix}`;
}

export default function PricingPage() {
  const { settings } = useSiteSettings();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSubscriptionPlansPublic()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const [individualPlans, institutionPlans] = useMemo(() => {
    const indiv = plans.filter((p) => p.scope === "individual");
    const inst = plans.filter((p) => p.scope === "institution");
    return [indiv, inst];
  }, [plans]);

  return (
    <div className="pricing-page public-page-scale">
      <header className="pricing-nav">
        <Link to="/" className="brand">
          <LogoMark className="h-9 w-9" />
          <BrandText />
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/all-exams" className="nav-item">
            Exams
          </Link>
          <Link to="/pricing" className="nav-item active">
            Pricing
          </Link>
          <a href="#faq" className="nav-item">
            FAQ
          </a>
        </nav>
        <Link className="btn btn-primary btn-small" to="/auth">
          Sign In
        </Link>
      </header>

      <main className="pricing-shell">
        <section className="hero reveal">
          <div className="hero-copy">
            <h1>
              Simple, transparent
              <br />
              <span>pricing for secure exams</span>
            </h1>
            <p>
              Choose a plan that fits your exam volume – from individual test takers to full
              institutions.
            </p>
            <div className="hero-tags">
              <span>
                <Sparkles className="h-4 w-4" /> AI & live proctoring included
              </span>
              <span>
                <Users className="h-4 w-4" /> Built for universities & cert providers
              </span>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-metric">
              <span>Total proctored minutes</span>
              <strong>50k+</strong>
            </div>
            <div className="hero-metric">
              <span>Exam integrity alerts</span>
              <strong>Realtime</strong>
            </div>
            <div className="hero-metric">
              <span>Institutions onboarded</span>
              <strong>Growing</strong>
            </div>
          </div>
        </section>

        <section className="pricing-grid reveal">
          <div className="pricing-column">
            <h2>For individuals</h2>
            <p>Perfect for candidates buying exams directly from the marketplace.</p>
            {loading ? (
              <p className="muted">Loading plans…</p>
            ) : individualPlans.length === 0 ? (
              <p className="muted">Individual plans will appear here once configured by admin.</p>
            ) : (
              <div className="card-grid">
                {individualPlans.map((plan) => (
                  <article key={plan.id} className="plan-card">
                    <header>
                      <h3>{plan.name}</h3>
                      <p>{plan.description}</p>
                    </header>
                    <div className="plan-price">{formatPrice(plan)}</div>
                    <ul className="plan-list">
                      <li>
                        <Check className="h-4 w-4" /> Access to paid & free exams
                      </li>
                      <li>
                        <Check className="h-4 w-4" /> Secure identity verification
                      </li>
                      <li>
                        <Check className="h-4 w-4" /> Live & AI proctoring
                      </li>
                    </ul>
                    <Link to="/all-exams" className="btn btn-success full-width">
                      Browse exams
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="pricing-column">
            <h2>For institutions</h2>
            <p>Bundle exams, proctoring, and reporting for your organization.</p>
            {loading ? (
              <p className="muted">Loading plans…</p>
            ) : institutionPlans.length === 0 ? (
              <p className="muted">
                Institutional plans will appear here once configured. Contact us to discuss your
                needs.
              </p>
            ) : (
              <div className="card-grid">
                {institutionPlans.map((plan) => (
                  <article key={plan.id} className="plan-card featured">
                    <header>
                      <h3>{plan.name}</h3>
                      <p>{plan.description}</p>
                    </header>
                    <div className="plan-price">{formatPrice(plan)}</div>
                    <ul className="plan-list">
                      <li>
                        <Check className="h-4 w-4" /> Central admin dashboard
                      </li>
                      <li>
                        <Check className="h-4 w-4" /> {plan.maxCandidates ?? "Unlimited"} candidates
                      </li>
                      <li>
                        <Check className="h-4 w-4" /> {plan.maxExamsPerMonth ?? "Unlimited"} exams per
                        month
                      </li>
                    </ul>
                    <a
                      className="btn btn-outline full-width"
                      href={`mailto:${settings.contact.email}?subject=HamroJaanch%20Institution%20Plan%20${encodeURIComponent(
                        plan.name,
                      )}`}
                    >
                      Talk to sales
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="faq" className="faq-section reveal">
          <h2>Frequently asked questions</h2>
          <div className="faq-grid">
            <article>
              <h3>Can I start with a single exam?</h3>
              <p>
                Yes. Individual plans are designed so you can purchase just one exam and upgrade
                later if needed.
              </p>
            </article>
            <article>
              <h3>Do you support custom SLAs for institutions?</h3>
              <p>
                For institutional plans we can agree on custom SLAs, onboarding, training, and
                dedicated support.
              </p>
            </article>
            <article>
              <h3>How do payments work?</h3>
              <p>
                Payments are processed securely. Entitlements are granted on success and can be
                revoked on refund as per your policies.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

