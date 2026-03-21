import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  Globe,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { StudentNavUser } from "@/components/StudentNavUser";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { getStoredUser, getMe, updateMe } from "@/lib/auth-api";
import { toast } from "sonner";
import "./StudentProfile.css";

const activity = [
  { title: "IT Certification Exam", date: "May 12, 2024", status: "Passed", score: "92%" },
  { title: "Language Proficiency Test", date: "May 20, 2024", status: "Scheduled", score: "--" },
  { title: "Cybersecurity Test", date: "Apr 15, 2024", status: "Passed", score: "92%" },
];

const credentials = [
  { label: "Identity Verified", value: "Government ID" },
  { label: "Proctoring Level", value: "AI + Live" },
  { label: "Last Login", value: "Today, 9:24 AM" },
];

export default function StudentProfile() {
  const storedUser = getStoredUser();
  const [profile, setProfile] = useState({
    name: storedUser?.name || "",
    email: storedUser?.email || "",
    phone: storedUser?.phone || "",
    location: "Kathmandu, NP",
    country: "Nepal",
    program: "Computer Science",
    education: "BSc Computer Science",
    language: "English",
    timeZone: "Asia/Kathmandu (GMT+5:45)",
  });
  const [saved, setSaved] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { settings } = useSiteSettings();
  const footerLinks = settings.footer.links.filter((link) => link.label && link.href);

  // Hydrate profile from backend + any locally stored student profile extras
  useEffect(() => {
    const extrasKey = storedUser ? `hj_student_profile_${storedUser.id}` : null;
    const load = async () => {
      try {
        const base = await getMe();
        const extras =
          extrasKey && typeof window !== "undefined"
            ? (JSON.parse(localStorage.getItem(extrasKey) || "null") as Partial<typeof profile> | null)
            : null;
        setProfile((prev) => ({
          ...prev,
          name: base.name || prev.name,
          email: base.email || prev.email,
          phone: base.phone || prev.phone || "",
          ...(extras || {}),
        }));
      } catch (err) {
        // If backend is unreachable, keep using storedUser / defaults
      }
    };
    void load();
  }, [storedUser?.id]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateMe({ name: profile.name, phone: profile.phone });
      const extrasKey = storedUser ? `hj_student_profile_${storedUser.id}` : null;
      if (extrasKey && typeof window !== "undefined") {
        const { name, email, phone, ...extras } = profile;
        localStorage.setItem(extrasKey, JSON.stringify(extras));
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      toast.success("Profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update profile.";
      toast.error(message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadedFile(file ? file.name : null);
  };

  return (
    <div className="student-profile-page public-page-scale">
      <div className="student-profile-shell">
        <header className="student-profile-nav">
          <Link to="/" className="brand">
            <LogoMark className="h-9 w-9" />
            <BrandText />
          </Link>
          <nav className="profile-nav-links" aria-label="Student navigation">
            <Link to="/student-dashboard">Dashboard</Link>
            <Link to="/all-exams">My Exams</Link>
            <a href="#results">Results</a>
            <a href="#support">Support</a>
          </nav>
          <div className="profile-actions">
            <StudentNavUser />
            <button type="button" className="profile-bell">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <section className="profile-hero">
          <div className="hero-card">
            <div className="hero-avatar">
              <span>SM</span>
            </div>
            <div className="hero-info">
              <p className="eyebrow">Student Profile</p>
              <h1>{profile.name}</h1>
              <p className="sub">
                {profile.program} · {profile.location.split(",")[0]}
              </p>
              <div className="hero-meta">
                <span>
                  <Mail size={14} /> {profile.email}
                </span>
                <span>
                  <Phone size={14} /> {profile.phone}
                </span>
                <span>
                  <MapPin size={14} /> {profile.location}
                </span>
              </div>
              <div className="hero-actions">
                <a href="#edit-profile" className="btn btn-primary">
                  Edit Profile
                </a>
                <button type="button" className="btn btn-outline" onClick={handleUploadClick}>
                  Upload ID
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="file-input"
              />
              {uploadedFile && <p className="upload-note">Selected: {uploadedFile}</p>}
            </div>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <strong>6</strong>
              <span>Exams Attempted</span>
            </div>
            <div className="stat-card">
              <strong>88%</strong>
              <span>Average Score</span>
            </div>
            <div className="stat-card">
              <strong>2</strong>
              <span>Upcoming Exams</span>
            </div>
          </div>
        </section>

        <section className="profile-grid">
          <div className="panel info" id="edit-profile">
            <h2>Personal Information</h2>
            <div className="info-grid">
              <div>
                <label>Full Name</label>
                <p>{profile.name}</p>
              </div>
              <div>
                <label>Email</label>
                <p>{profile.email}</p>
              </div>
              <div>
                <label>Phone</label>
                <p>{profile.phone}</p>
              </div>
              <div>
                <label>Country</label>
                <p>{profile.country}</p>
              </div>
              <div>
                <label>Education</label>
                <p>{profile.education}</p>
              </div>
              <div>
                <label>Preferred Language</label>
                <p>{profile.language}</p>
              </div>
            </div>
          </div>

          <div className="panel credentials">
            <h2>Verification</h2>
            <div className="credential-list">
              {credentials.map((item) => (
                <div key={item.label} className="credential-row">
                  <div>
                    <label>{item.label}</label>
                    <p>{item.value}</p>
                  </div>
                  <CheckCircle2 size={18} />
                </div>
              ))}
            </div>
            <div className="badge-strip">
              <span>
                <ShieldCheck size={14} /> AI + Live Proctoring
              </span>
              <span>
                <BadgeCheck size={14} /> GDPR Compliant
              </span>
            </div>
          </div>

          <div className="panel preferences">
            <h2>Preferences</h2>
            <div className="pref-row">
              <Globe size={18} />
              <div>
                <label>Time Zone</label>
                <p>{profile.timeZone}</p>
              </div>
            </div>
            <div className="pref-row">
              <CalendarDays size={18} />
              <div>
                <label>Exam Reminders</label>
                <p>Email + In-app notifications</p>
              </div>
            </div>
            <div className="pref-row">
              <Lock size={18} />
              <div>
                <label>Security</label>
                <p>Two-factor authentication enabled</p>
              </div>
            </div>
            <button type="button" className="btn btn-light full">
              Update Preferences
            </button>
          </div>

          <div className="panel edit">
            <div className="panel-header">
              <h2>Edit Profile</h2>
              {saved && <span className="save-pill">Saved</span>}
            </div>
            <form className="edit-form" onSubmit={handleSave}>
              <div className="edit-grid">
                <label>
                  Full Name
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input type="email" value={profile.email} disabled />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, location: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Education
                  <input
                    type="text"
                    value={profile.education}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, education: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Preferred Language
                  <input
                    type="text"
                    value={profile.language}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, language: event.target.value }))
                    }
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-primary full">
                Save Changes
              </button>
            </form>
          </div>

          <div className="panel activity" id="results">
            <div className="panel-header">
              <h2>Recent Activity</h2>
              <Link to="/student-results">
                View All <FileText size={14} />
              </Link>
            </div>
            <div className="activity-list">
              {activity.map((item) => (
                <div key={item.title} className="activity-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.date}</span>
                  </div>
                  <div className="activity-meta">
                    <em>{item.status}</em>
                    <span>{item.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="profile-footer" id="support">
          <div className="footer-strip">
            <span>
              <ShieldCheck size={16} /> AI &amp; Live Proctoring
            </span>
            <span>
              <BadgeCheck size={16} /> Secure &amp; Private
            </span>
            <span>
              <CalendarDays size={16} /> 24/7 Support
            </span>
            <span>
              <Lock size={16} /> GDPR Compliant
            </span>
          </div>
          <div className="footer-links">
            {footerLinks.map((item) => (
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


