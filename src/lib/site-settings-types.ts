export interface NavLink {
  label: string;
  href: string;
}

export interface SiteSettings {
  branding: {
    siteName: string;
    tagline?: string | null;
    logoLight?: string | null;
    logoDark?: string | null;
    favicon?: string | null;
  };
  contact: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  socials: {
    facebook?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
  };
  support: {
    chatLink?: string | null;
    ticketLink?: string | null;
  };
  seoDefaults: {
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    defaultOgImage?: string | null;
    keywords: string[];
  };
  header: {
    navLinks: NavLink[];
  };
  footer: {
    footerText?: string | null;
    copyright?: string | null;
    links: NavLink[];
  };
  analytics: {
    trackingIds?: Record<string, string>;
  };
  updatedAt: string;
}

export interface SiteSettingsSeed {
  settings: SiteSettings;
}

export type SiteSettingsUpdate = Partial<SiteSettings>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  branding: {
    siteName: "HamroJaanch",
    tagline: "Secure online proctored exams",
    logoLight: "/hamrojaanch-logo.png",
    logoDark: "/hamrojaanch-logo.png",
    favicon: "/favicon.ico",
  },
  contact: {
    email: "support@hamrojaanch.com",
    phone: "+977-01-555-0101",
    address: "Kathmandu, Nepal",
  },
  socials: {
    facebook: "https://facebook.com/hamrojaanch",
    instagram: null,
    youtube: null,
    tiktok: null,
    linkedin: "https://linkedin.com/company/hamrojaanch",
    twitter: "https://x.com/hamrojaanch",
  },
  support: {
    chatLink: "https://chat.hamrojaanch.com",
    ticketLink: "https://support.hamrojaanch.com/tickets",
  },
  seoDefaults: {
    titleTemplate: "%s | HamroJaanch",
    defaultTitle: "HamroJaanch",
    defaultDescription: "HamroJaanch Exam Platform",
    defaultOgImage: "/hamrojaanch-logo.png",
    keywords: ["exam", "proctoring", "ecommerce"],
  },
  header: {
    navLinks: [
      { label: "How it Works", href: "#how-it-works" },
      { label: "Pricing", href: "#cta" },
      { label: "For Institutions", href: "#how-it-works" },
      { label: "For Candidates", href: "#how-it-works" },
    ],
  },
  footer: {
    footerText: "Built for secure online exams.",
    copyright: "© 2026 HamroJaanch",
    links: [
      { label: "About", href: "/pages/about" },
      { label: "Privacy Policy", href: "/pages/privacy" },
      { label: "Terms", href: "/pages/terms" },
      { label: "Contact", href: "/pages/contact" },
    ],
  },
  analytics: {
    trackingIds: {},
  },
  updatedAt: new Date().toISOString(),
};

