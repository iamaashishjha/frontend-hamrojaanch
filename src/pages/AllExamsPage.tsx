import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  BookOpen,
  ChevronDown,
  Clock,
  Globe,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { listCatalogCategoriesWithIds, listStorefrontExams } from "@/lib/exams-module-api";
import type { AdminExam } from "@/lib/exams-module-types";
import "./AllExamsPage.css";

const examHighlights = [
  { label: "Verified Providers", value: "140+" },
  { label: "Instant Results", value: "2 min avg" },
  { label: "Live Proctoring", value: "24/7" },
];

const filterGroups = [
  {
    title: "Exam Format",
    options: ["Multiple Choice", "Hands-on Lab", "Project Based", "Oral + Written"],
  },
  {
    title: "Duration",
    options: ["Under 60 min", "60-90 min", "90-120 min", "120+ min"],
  },
  {
    title: "Proctoring",
    options: ["AI + Live", "AI Only", "Recorded Review"],
  },
  {
    title: "Difficulty",
    options: ["Beginner", "Intermediate", "Advanced"],
  },
];

type PricingFilter = "all" | "free" | "demo" | "paid";
type StatusFilter = "all" | AdminExam["status"];

const fallbackTiles = [
  {
    id: "exam-it",
    title: "IT Certification Exam",
    category: "Technology",
    rating: 4.8,
    reviews: 1225,
    duration: "90 min",
    level: "Intermediate",
    price: "$25",
    tag: "Top Rated",
    accent: "blue",
    description:
      "Network security, software fundamentals, and IT operations with AI + live proctoring.",
  },
  {
    id: "exam-pm",
    title: "Project Management Essentials",
    category: "Business",
    rating: 4.7,
    reviews: 984,
    duration: "120 min",
    level: "Intermediate",
    price: "$30",
    tag: "Best Seller",
    accent: "violet",
    description: "Scope, stakeholder mapping, agile workflows, and delivery planning.",
  },
  {
    id: "exam-cyber",
    title: "Cybersecurity Analyst",
    category: "Technology",
    rating: 4.9,
    reviews: 1640,
    duration: "95 min",
    level: "Advanced",
    price: "$35",
    tag: "New",
    accent: "emerald",
    description: "Threat detection, incident response, and secure infrastructure strategy.",
  },
  {
    id: "exam-ux",
    title: "UX Research Foundations",
    category: "Design",
    rating: 4.6,
    reviews: 612,
    duration: "75 min",
    level: "Beginner",
    price: "$22",
    tag: "Popular",
    accent: "rose",
    description: "User interviews, usability studies, and evidence-backed design decisions.",
  },
  {
    id: "exam-fin",
    title: "Finance Analyst Screening",
    category: "Finance",
    rating: 4.5,
    reviews: 540,
    duration: "80 min",
    level: "Intermediate",
    price: "$28",
    tag: "Verified",
    accent: "amber",
    description: "Forecasting, KPI analysis, and reporting for high-growth teams.",
  },
  {
    id: "exam-health",
    title: "Healthcare Compliance",
    category: "Healthcare",
    rating: 4.7,
    reviews: 438,
    duration: "70 min",
    level: "Beginner",
    price: "$20",
    tag: "Updated",
    accent: "cyan",
    description: "HIPAA-ready workflows, privacy standards, and ethical handling of data.",
  },
  {
    id: "exam-data",
    title: "Data Literacy & Analytics",
    category: "Technology",
    rating: 4.6,
    reviews: 712,
    duration: "85 min",
    level: "Beginner",
    price: "$24",
    tag: "Fast Track",
    accent: "indigo",
    description: "SQL basics, metrics dashboards, and storytelling with data.",
  },
  {
    id: "exam-lang",
    title: "Business English Proficiency",
    category: "Languages",
    rating: 4.4,
    reviews: 362,
    duration: "60 min",
    level: "Intermediate",
    price: "$18",
    tag: "Remote Friendly",
    accent: "teal",
    description: "Writing, presentations, and high-stakes professional communication.",
  },
];

const accentPalette = ["blue", "violet", "emerald", "rose", "amber", "cyan", "indigo", "teal"];
const tagPool = ["Top Rated", "Best Seller", "New", "Popular", "Verified", "Updated", "Fast Track", "Trending"];

const hashString = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const formatStatusLabel = (status: AdminExam["status"]) => {
  switch (status) {
    case "published":
      return "Published";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
};

const resolvePricingLabel = (exam: AdminExam) => {
  if (exam.pricing.mode === "PAID") return "Paid";
  if (exam.pricing.isDemo) return "Demo";
  return "Free";
};

/** Free/Demo: no payment — go to system-check then exam. Paid: go to checkout. */
const getAccessUrl = (examId: string, pricingLabel: string) =>
  pricingLabel === "Paid" ? `/checkout?examId=${examId}` : `/system-check?examId=${examId}`;

const formatPrice = (exam: AdminExam) => {
  if (exam.pricing.mode === "PAID") {
    const price = exam.pricing.price ?? 0;
    return `${exam.pricing.currency} ${price}`;
  }
  return "Free";
};

const buildDescription = (exam: AdminExam) => {
  const category = exam.category ?? "General";
  const typeLabel =
    exam.type === "link" ? "link-based" : exam.type === "series" ? "series" : "group";
  const modeLabel = exam.questionsMode === "auto" ? "auto-curated" : "expert-curated";
  return `${category} ${typeLabel} assessment with ${modeLabel} questions and secure proctoring.`;
};

export default function AllExamsPage() {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [categoriesWithIds, setCategoriesWithIds] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<"rating" | "duration" | "price">("rating");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { settings } = useSiteSettings();
  const footerLinks = settings.footer.links.filter((link) => link.label && link.href);
  const supportEmail = settings.contact.email?.trim();
  const footerText = settings.footer.footerText || settings.branding.tagline;
  const footerItems =
    supportEmail && !footerLinks.some((link) => link.label.toLowerCase().includes("support"))
      ? [...footerLinks, { label: "Support", href: `mailto:${supportEmail}` }]
      : footerLinks;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const [catRows, examRows] = await Promise.all([
          listCatalogCategoriesWithIds(),
          listStorefrontExams({
            categoryId: activeCategory !== "All Categories" ? categoriesWithIds.find((c) => c.name === activeCategory)?.id : undefined,
            pricing: pricingFilter === "all" ? undefined : pricingFilter === "demo" ? "DEMO" : pricingFilter.toUpperCase() as "FREE" | "PAID",
            query: searchQuery.trim() || undefined,
          }),
        ]);
        setCategoriesWithIds(catRows);
        setExams(examRows);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load exams.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeCategory, pricingFilter, searchQuery]);

  const categoryChips = useMemo(() => {
    const categories = categoriesWithIds.map((c) => c.name);
    const chips = ["All Categories", ...categories];
    const hasUncategorized = exams.some((exam) => !exam.category);
    if (hasUncategorized && !chips.includes("Uncategorized")) {
      chips.push("Uncategorized");
    }
    return chips;
  }, [categoriesWithIds, exams]);

  const allTiles = useMemo(() => {
    const useFallback = loading || Boolean(errorMessage);
    if (exams.length === 0) {
      return useFallback
        ? fallbackTiles.map((tile) => ({
            ...tile,
            pricingLabel: tile.price.toLowerCase() === "free" ? "Free" : "Paid",
            status: "published" as const,
            statusLabel: "Published",
          }))
        : [];
    }
    return exams.map((exam, index) => {
      const hash = hashString(exam.id);
      const rating = Number((4.2 + ((hash % 8) * 0.1)).toFixed(1));
      const reviews = 200 + (hash % 1400);
      const tag = exam.pricing.isDemo ? "Demo" : tagPool[index % tagPool.length];
      const accent = accentPalette[index % accentPalette.length];
      const level = exam.security.preset === "strict" ? "Advanced" : "Intermediate";
      const pricingLabel = resolvePricingLabel(exam);
      const statusLabel = formatStatusLabel(exam.status);
      return {
        id: exam.id,
        title: exam.name,
        thumbnailUrl: exam.thumbnailUrl ?? null,
        category: exam.category ?? "Uncategorized",
        rating,
        reviews,
        duration: `${exam.durationMinutes} min`,
        level,
        price: formatPrice(exam),
        pricingLabel,
        status: exam.status,
        statusLabel,
        tag,
        accent,
        description: buildDescription(exam),
      };
    });
  }, [exams, loading, errorMessage]);

  const priceFilteredTiles = useMemo(() => {
    if (pricingFilter === "all") return allTiles;
    if (pricingFilter === "free") return allTiles.filter((tile) => tile.pricingLabel === "Free");
    if (pricingFilter === "demo") return allTiles.filter((tile) => tile.pricingLabel === "Demo");
    return allTiles.filter((tile) => tile.pricingLabel === "Paid");
  }, [allTiles, pricingFilter]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    priceFilteredTiles
      .filter((tile) => statusFilter === "all" || tile.status === statusFilter)
      .forEach((tile) => {
      counts.set(tile.category, (counts.get(tile.category) ?? 0) + 1);
      });
    return counts;
  }, [priceFilteredTiles, statusFilter]);

  const filteredTiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return priceFilteredTiles.filter((tile) => {
      if (activeCategory !== "All Categories" && tile.category !== activeCategory) return false;
      if (statusFilter !== "all" && tile.status !== statusFilter) return false;
      if (!query) return true;
      return (
        tile.title.toLowerCase().includes(query) ||
        tile.category.toLowerCase().includes(query) ||
        tile.description.toLowerCase().includes(query)
      );
    });
  }, [priceFilteredTiles, activeCategory, statusFilter, searchQuery]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<AdminExam["status"]>();
    allTiles.forEach((tile) => statuses.add(tile.status));
    return ["all", ...Array.from(statuses).sort()] as StatusFilter[];
  }, [allTiles]);

  const sortedTiles = useMemo(() => {
    const sorted = [...filteredTiles];
    sorted.sort((a, b) => {
      if (sortKey === "rating") {
        return sortDirection === "desc" ? b.rating - a.rating : a.rating - b.rating;
      }
      if (sortKey === "duration") {
        const aDuration = Number(a.duration.replace(/[^0-9.]/g, "")) || 0;
        const bDuration = Number(b.duration.replace(/[^0-9.]/g, "")) || 0;
        return sortDirection === "desc" ? bDuration - aDuration : aDuration - bDuration;
      }
      const aPrice = a.price.toLowerCase() === "free" ? 0 : Number(a.price.replace(/[^0-9.]/g, "")) || 0;
      const bPrice = b.price.toLowerCase() === "free" ? 0 : Number(b.price.replace(/[^0-9.]/g, "")) || 0;
      return sortDirection === "desc" ? bPrice - aPrice : aPrice - bPrice;
    });
    return sorted;
  }, [filteredTiles, sortKey, sortDirection]);

  const featuredTile = allTiles[0] ?? null;

  const toggleSort = (nextKey: "rating" | "duration" | "price") => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === "rating" ? "desc" : "asc");
    }
  };

  return (
    <div className="all-exams-page public-page-scale">
      <div className="all-exams-shell">
        <header className="all-exams-nav">
          <Link to="/" className="brand">
            <LogoMark className="h-9 w-9" />
            <BrandText />
          </Link>

          <nav className="all-exams-links" aria-label="Primary">
            <Link to="/all-exams" className="nav-item active">
              All Exams
            </Link>
            <a href="#pricing" className="nav-item">
              Pricing
            </a>
            <a href="#faq" className="nav-item">
              FAQ
            </a>
            <Link to="/student-dashboard" className="nav-item">
              My Account
            </Link>
          </nav>

          <Link to="/dashboard" className="btn btn-primary btn-small">
            Start Free Trial
          </Link>
        </header>

        <section className="all-exams-hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <Sparkles size={16} />
              <span>Exam Marketplace</span>
            </div>
            <h1>
              Browse verified exams built for
              <span> secure, confident hiring.</span>
            </h1>
            <p>
              Discover certifications and assessments across technology, business,
              healthcare, and more. Every listing includes AI + live proctoring,
              instant results, and verified providers.
            </p>
            <div className="hero-metrics">
              {examHighlights.map((item) => (
                <div key={item.label} className="hero-metric">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="hero-actions">
              <button type="button" className="btn btn-warning">
                Browse Categories
                <ChevronDown size={16} />
              </button>
              <Link to="/auth?next=/system-check" className="btn btn-outline">
                Try a Demo Exam
              </Link>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-header">
              <div>
                <span className="hero-card-tag">Featured Exam</span>
                <h2>{featuredTile ? featuredTile.title : "No featured exam yet"}</h2>
                <p>
                  {featuredTile
                    ? featuredTile.description
                    : "Publish exams to highlight them in the marketplace."}
                </p>
                {featuredTile && (
                  <div className="hero-card-badges">
                    <span className={`exam-pill pricing-${featuredTile.pricingLabel.toLowerCase()}`}>
                      {featuredTile.pricingLabel}
                    </span>
                    <span className={`status-chip status-${featuredTile.status}`}>
                      {featuredTile.statusLabel}
                    </span>
                  </div>
                )}
              </div>
              <div className="hero-card-price">
                <span>Starting at</span>
                <strong>{featuredTile ? featuredTile.price : "--"}</strong>
              </div>
            </div>
            <div className="hero-card-body">
              <div className="hero-card-row">
                <Clock size={18} />
                <span>{featuredTile ? featuredTile.duration : "Duration TBD"}</span>
              </div>
              <div className="hero-card-row">
                <ShieldCheck size={18} />
                <span>AI + Live Proctoring</span>
              </div>
              <div className="hero-card-row">
                <BadgeCheck size={18} />
                <span>Instant Results</span>
              </div>
              <div className="hero-card-row">
                <Users size={18} />
                <span>12,200+ Candidates</span>
              </div>
            </div>
            <Link
              to={featuredTile ? getAccessUrl(featuredTile.id, featuredTile.pricingLabel) : "/all-exams"}
              className="btn btn-primary hero-card-cta"
            >
              Get Access
            </Link>
            <div className="hero-card-footer">
              <span>GDPR Compliant</span>
              <span>SSL Encrypted Payment</span>
            </div>
          </div>
        </section>

        <section className="search-panel">
          <div className="search-input">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search exams, categories, or providers..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="search-filters">
            <button type="button" className="filter-pill">
              <Globe size={16} />
              Remote-ready
            </button>
            <button type="button" className="filter-pill">
              <Clock size={16} />
              Under 90 mins
            </button>
            <button type="button" className="filter-pill">
              <ShieldCheck size={16} />
              Live + AI Proctoring
            </button>
            <button type="button" className="filter-pill">
              <BookOpen size={16} />
              Beginner-friendly
            </button>
            <button
              type="button"
              className={`filter-pill ${pricingFilter === "all" ? "active" : ""}`}
              onClick={() => setPricingFilter("all")}
            >
              All Access
            </button>
            <button
              type="button"
              className={`filter-pill ${pricingFilter === "free" ? "active" : ""}`}
              onClick={() => setPricingFilter("free")}
            >
              Free Access
            </button>
            <button
              type="button"
              className={`filter-pill ${pricingFilter === "demo" ? "active" : ""}`}
              onClick={() => setPricingFilter("demo")}
            >
              Demo Access
            </button>
            <button
              type="button"
              className={`filter-pill ${pricingFilter === "paid" ? "active" : ""}`}
              onClick={() => setPricingFilter("paid")}
            >
              Paid Access
            </button>
          </div>
          <div className="status-filters">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-pill ${statusFilter === status ? "active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "Any Status" : formatStatusLabel(status)}
              </button>
            ))}
          </div>
        </section>

        <section className="category-strip">
          {categoryChips.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`category-chip ${activeCategory === chip ? "active" : ""}`}
              onClick={() => setActiveCategory(chip)}
            >
              {chip}
              {chip !== "All Categories" && (
                <span className="category-count">{categoryCounts.get(chip) ?? 0}</span>
              )}
            </button>
          ))}
        </section>

        <section className="exams-layout">
          <aside className="filters-panel">
            <div className="filters-header">
              <div>
                <h3>Filter Exams</h3>
                <p>Refine by format, duration, and difficulty.</p>
              </div>
              <button
                type="button"
                className="reset-btn"
                onClick={() => {
                  setActiveCategory("All Categories");
                  setSearchQuery("");
                  setPricingFilter("all");
                  setStatusFilter("all");
                  setSortKey("rating");
                  setSortDirection("desc");
                }}
              >
                Reset
              </button>
            </div>

            {filterGroups.map((group) => (
              <div key={group.title} className="filter-group">
                <h4>{group.title}</h4>
                <div className="filter-options">
                  {group.options.map((option) => (
                    <label key={option} className="filter-option">
                      <input type="checkbox" />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="filters-callout">
              <ShieldCheck size={20} />
              <div>
                <strong>Verified &amp; Secure</strong>
                <p>All exams include identity verification and AI monitoring.</p>
              </div>
            </div>
          </aside>

          <div className="exams-grid">
            <div className="grid-header">
              <div>
                <h3>All Exams</h3>
                <p>{sortedTiles.length} curated assessments ready to launch.</p>
              </div>
              <div className="grid-actions">
                <button
                  type="button"
                  className={`sort-btn ${sortKey === "rating" ? "active" : ""}`}
                  onClick={() => toggleSort("rating")}
                >
                  <Star size={16} />
                  Rating
                  {sortKey === "rating"
                    ? sortDirection === "desc"
                      ? " (high to low)"
                      : " (low to high)"
                    : ""}
                </button>
                <button
                  type="button"
                  className={`sort-btn ${sortKey === "duration" ? "active" : ""}`}
                  onClick={() => toggleSort("duration")}
                >
                  <Clock size={16} />
                  Duration
                  {sortKey === "duration"
                    ? sortDirection === "desc"
                      ? " (long to short)"
                      : " (short to long)"
                    : ""}
                </button>
                <button
                  type="button"
                  className={`sort-btn ${sortKey === "price" ? "active" : ""}`}
                  onClick={() => toggleSort("price")}
                >
                  Sort: Price
                  {sortKey === "price"
                    ? sortDirection === "desc"
                      ? " (high to low)"
                      : " (low to high)"
                    : ""}
                </button>
              </div>
            </div>

            <div className="exam-grid">
              {loading ? (
                <div className="exam-tile">
                  <div className="exam-tile-body">
                    <h4>Loading marketplace...</h4>
                    <p>Fetching the latest exam listings.</p>
                  </div>
                </div>
              ) : errorMessage ? (
                <div className="exam-tile">
                  <div className="exam-tile-body">
                    <h4>Unable to load exams</h4>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              ) : sortedTiles.length === 0 ? (
                <div className="exam-tile">
                  <div className="exam-tile-body">
                    <h4>No exams found</h4>
                    <p>Try changing the category or search keyword.</p>
                  </div>
                </div>
              ) : (
                sortedTiles.map((exam) => (
                  <article key={exam.id} className={`exam-tile accent-${exam.accent}`}>
                    <div className="exam-tile-top">
                      <div className="exam-tile-badges">
                        <span className="exam-tag">{exam.tag}</span>
                        <span className={`exam-pill pricing-${exam.pricingLabel.toLowerCase()}`}>
                          {exam.pricingLabel}
                        </span>
                      </div>
                      <div className="exam-rating">
                        <Star size={14} />
                        <span>
                          {exam.rating} ({exam.reviews})
                        </span>
                      </div>
                    </div>
                    {exam.thumbnailUrl && (
                      <div className="exam-tile-image">
                        <img src={exam.thumbnailUrl} alt={exam.title} />
                      </div>
                    )}
                    <div className="exam-tile-body">
                      <h4>{exam.title}</h4>
                      <p>{exam.description}</p>
                      <div className="exam-meta">
                        <span>{exam.duration}</span>
                        <span>{exam.level}</span>
                        <span>{exam.category}</span>
                        <span className={`status-chip status-${exam.status}`}>{exam.statusLabel}</span>
                      </div>
                    </div>
                    <div className="exam-tile-footer">
                      <div>
                        <span className="price-label">From</span>
                        <strong>{exam.price}</strong>
                      </div>
                      <Link to={getAccessUrl(exam.id, exam.pricingLabel)} className="tile-cta">
                        Get Access
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="pricing-band" id="pricing">
          <div>
            <h2>Flexible pricing for every cohort</h2>
            <p>Bundle exams, assign candidates, and pay only for what you use.</p>
          </div>
          <div className="pricing-grid">
            <div className="pricing-card">
              <span className="pricing-tag">Starter</span>
              <h3>$18</h3>
              <p>Per candidate per exam for teams under 50.</p>
              <button type="button" className="btn btn-outline">
                Choose Starter
              </button>
            </div>
            <div className="pricing-card featured">
              <span className="pricing-tag">Growth</span>
              <h3>$15</h3>
              <p>Includes live proctoring and advanced analytics.</p>
              <button type="button" className="btn btn-primary">
                Talk to Sales
              </button>
            </div>
            <div className="pricing-card">
              <span className="pricing-tag">Enterprise</span>
              <h3>Custom</h3>
              <p>Dedicated success support and SLA-backed monitoring.</p>
              <button type="button" className="btn btn-outline">
                Request Quote
              </button>
            </div>
          </div>
        </section>

        <section className="faq-band" id="faq">
          <div className="faq-header">
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know before you launch.</p>
          </div>
          <div className="faq-grid">
            <div className="faq-card">
              <h4>How quickly can I schedule an exam?</h4>
              <p>Most exams are ready in under 10 minutes with instant candidate invites.</p>
            </div>
            <div className="faq-card">
              <h4>Does every exam include live proctoring?</h4>
              <p>Yes. Every exam bundles AI monitoring with a live proctoring option.</p>
            </div>
            <div className="faq-card">
              <h4>Can candidates reschedule?</h4>
              <p>Rescheduling is flexible up to 24 hours before the exam window.</p>
            </div>
          </div>
        </section>

        <footer className="all-exams-footer">
          <div className="footer-brand">
            <LogoMark className="h-8 w-8" />
            <div>
              <strong><BrandText /></strong>
              {footerText ? <span>{footerText}</span> : null}
            </div>
          </div>
          <div className="footer-links">
            {footerItems.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}


