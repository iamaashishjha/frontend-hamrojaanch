import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Clock,
  Globe2,
  Mail,
  MessageSquare,
  Phone,
  Send,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import MarkdownContent from "@/components/MarkdownContent";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { useSiteSeo } from "@/hooks/useSiteSeo";
import { getPublicPageBySlug } from "@/lib/site-pages-api";
import { getSettings } from "@/lib/help-center-api";
import { createTicket } from "@/lib/support-api";
import { toast } from "@/components/ui/use-toast";
import type { SitePage } from "@/lib/site-pages-types";
import type { HelpSupportSettings } from "@/lib/help-center-types";
import "./ContactPage.css";

export default function ContactPage() {
  const { settings } = useSiteSettings();
  const [page, setPage] = useState<SitePage | null>(null);
  const [supportSettings, setSupportSettings] = useState<HelpSupportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const supportEmail = settings.contact.email?.trim() || supportSettings?.supportEmail || "";
  const supportPhone = settings.contact.phone?.trim() || supportSettings?.supportPhone || "";
  const supportAddress = settings.contact.address?.trim() || "Remote-first support team.";
  const supportHours = supportSettings?.supportHours?.trim() || "Mon-Fri, 9:00 AM - 6:00 PM";
  const supportChatLink = settings.support.chatLink?.trim() || supportSettings?.chatLink || "";
  const supportTicketLink = settings.support.ticketLink?.trim() || supportSettings?.ticketLink || "";

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [pageData, helpSettings] = await Promise.all([
          getPublicPageBySlug("contact"),
          getSettings(),
        ]);
        if (!active) return;
        setPage(pageData);
        setSupportSettings(helpSettings);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useSiteSeo({
    title: page?.seo?.metaTitle || page?.title || "Contact",
    description:
      page?.seo?.metaDescription ||
      settings.seoDefaults.defaultDescription ||
      "Contact our support team.",
    ogImage: page?.seo?.ogImage || settings.seoDefaults.defaultOgImage || undefined,
  });

  const formReady = useMemo(
    () => Boolean((email || supportEmail) && message.trim()),
    [email, message, supportEmail]
  );

  const handleSubmit = () => {
    if (!supportEmail) return;
    const subjectLine = subject.trim() || "Support request";
    const body = [
      `Name: ${name.trim() || "Not provided"}`,
      `Email: ${email.trim() || "Not provided"}`,
      "",
      message.trim(),
    ].join("\n");
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
  };

  const handleCreateTicket = async () => {
    const requesterEmail = email.trim();
    if (!requesterEmail || !message.trim()) {
      toast({ variant: "destructive", title: "Email and message are required" });
      return;
    }
    setTicketSubmitting(true);
    try {
      await createTicket({
        requesterEmail,
        requesterName: name.trim() || undefined,
        subject: subject.trim() || "Support request",
        body: message.trim(),
      });
      toast({ title: "Support ticket created", description: "We’ll get back to you soon." });
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Could not create ticket" });
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <div className="contact-page public-page-scale">
      <header className="contact-hero">
        <div className="contact-hero__nav">
          <Link to="/" className="contact-brand">
            <LogoMark className="h-9 w-9" />
            <BrandText />
          </Link>
          <nav className="contact-nav">
            {settings.header.navLinks.map((link) => (
              <a key={`${link.label}-${link.href}`} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <Link to="/all-exams" className="contact-cta">
            Browse Exams
          </Link>
        </div>

        <div className="contact-hero__content">
          <div>
            <p className="contact-pill">Contact</p>
            <h1>{page?.title || "Let’s talk about your next exam session"}</h1>
            <p className="contact-subtitle">
              {page?.seo?.metaDescription ||
                "Reach the team for onboarding, support, or enterprise rollouts."}
            </p>
            <div className="contact-hero__actions">
              {supportChatLink ? (
                <a className="btn btn-primary" href={supportChatLink} target="_blank" rel="noreferrer">
                  Live Chat
                </a>
              ) : (
                <a className="btn btn-primary" href={supportEmail ? `mailto:${supportEmail}` : "#"}>
                  Email Support
                </a>
              )}
              {supportTicketLink ? (
                <a className="btn btn-outline" href={supportTicketLink} target="_blank" rel="noreferrer">
                  Submit Ticket
                </a>
              ) : (
                <Link className="btn btn-outline" to="/pages/faq">
                  View FAQs
                </Link>
              )}
            </div>
          </div>
          <div className="contact-hero__card">
            <div>
              <h2>Support at a glance</h2>
              <p>We respond quickly during business hours and prioritize live exams.</p>
            </div>
            <div className="contact-hero__stats">
              <div>
                <strong>4 hrs</strong>
                <span>Avg response time</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>Monitoring coverage</span>
              </div>
              <div>
                <strong>98%</strong>
                <span>Satisfaction</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="contact-shell">
        <section className="contact-grid">
          <div className="contact-panel contact-form">
            <div className="contact-panel__header">
              <h3>Send a message</h3>
              <p>Tell us about your exam or support request.</p>
              <p className="contact-help-cta">
                Browse our <Link to="/pages/faq">Help Center &amp; FAQs</Link> for quick answers, or open a support ticket below.
              </p>
            </div>
            <div className="contact-form__fields">
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
              </label>
              <label>
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  type="email"
                />
              </label>
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Onboarding, billing, technical support..."
                />
              </label>
              <label>
                Message
                <textarea
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Share as much detail as possible."
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!formReady || !supportEmail}
              >
                <Send className="h-4 w-4" />
                Send Message
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCreateTicket}
                disabled={!email.trim() || !message.trim() || ticketSubmitting}
              >
                {ticketSubmitting ? "Creating…" : "Open a support ticket"}
              </button>
            </div>
            {!supportEmail && (
              <p className="contact-note">Add a support email in Admin → Site Settings to enable this form.</p>
            )}
          </div>

          <div className="contact-panel contact-channels">
            <div className="contact-panel__header">
              <h3>Contact channels</h3>
              <p>Choose the quickest option for your request.</p>
            </div>
            <div className="contact-channel">
              <Mail className="h-5 w-5" />
              <div>
                <span>Email</span>
                <strong>{supportEmail || "Not set"}</strong>
              </div>
            </div>
            <div className="contact-channel">
              <Phone className="h-5 w-5" />
              <div>
                <span>Phone</span>
                <strong>{supportPhone || "Not set"}</strong>
              </div>
            </div>
            <div className="contact-channel">
              <Clock className="h-5 w-5" />
              <div>
                <span>Support hours</span>
                <strong>{supportHours}</strong>
              </div>
            </div>
            <div className="contact-channel">
              <Building2 className="h-5 w-5" />
              <div>
                <span>Address</span>
                <strong>{supportAddress}</strong>
              </div>
            </div>
            <div className="contact-channel">
              <MessageSquare className="h-5 w-5" />
              <div>
                <span>Live chat</span>
                <strong>{supportChatLink ? "Available" : "Not set"}</strong>
              </div>
              {supportChatLink && (
                <a href={supportChatLink} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
            </div>
            <div className="contact-channel">
              <Globe2 className="h-5 w-5" />
              <div>
                <span>Ticket portal</span>
                <strong>{supportTicketLink ? "Available" : "Not set"}</strong>
              </div>
              {supportTicketLink && (
                <a href={supportTicketLink} target="_blank" rel="noreferrer">
                  Submit
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="contact-panel contact-details">
          <div className="contact-panel__header">
            <h3>Additional details</h3>
            <p>Content below is managed in the admin CMS for page_contact.</p>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading contact page...</p>
          ) : page ? (
            <MarkdownContent content={page.content} />
          ) : (
            <p className="text-sm text-muted-foreground">Contact content not found.</p>
          )}
        </section>
      </main>
    </div>
  );
}
