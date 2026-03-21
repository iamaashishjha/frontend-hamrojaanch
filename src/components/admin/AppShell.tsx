import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileCheck,
  FileText,
  Flag,
  Headphones,
  LayoutDashboard,
  Mail,
  Menu,
  Newspaper,
  PlugZap,
  Scale,
  Search,
  Send,
  Settings,
  Settings2,
  Shield,
  ShieldAlert,
  Star,
  Ticket,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { logout, getStoredUser } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import "./AppShell.css";

type NavLinkItem = {
  label: string;
  to: string;
  icon: typeof CircleHelp;
  badge?: string;
};
type NavGroupItem = {
  label: string;
  icon: typeof CircleHelp;
  children: NavLinkItem[];
};
type NavItem = NavLinkItem | NavGroupItem;

function isNavGroup(item: NavItem): item is NavGroupItem {
  return "children" in item && Array.isArray((item as NavGroupItem).children);
}

// Full nav for admin only. Teachers see teacherNav only (governance: Admin = final authority).
const primaryNav: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Organization", to: "/org", icon: Building2 },
  { label: "Exams", to: "/admin/exams", icon: FileText },
  { label: "Exam Setup", to: "/admin/exams/settings", icon: Settings2 },
  { label: "Question Bank", to: "/admin/question-bank", icon: BookOpen },
  { label: "Candidates", to: "/candidates", icon: Users },
  { label: "Teachers", to: "/admin/teachers", icon: Users },
  { label: "Evaluate", to: "/admin/section/evaluate", icon: FileText, badge: "2" },
  { label: "Reports", to: "/admin/section/reports", icon: FileText },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Notification Templates", to: "/admin/notification-templates", icon: Mail },
  { label: "Integrations", to: "/admin/integrations", icon: PlugZap },
  { label: "Webhook Simulator", to: "/admin/webhook-simulator", icon: Send },
  { label: "Plans", to: "/admin/subscription-plans", icon: Star },
  { label: "Revenue", to: "/admin/revenue", icon: TrendingUp },
  { label: "Payments Reconciliation", to: "/admin/payments-reconciliation", icon: CreditCard },
  { label: "Coupons", to: "/admin/coupons", icon: Ticket },
  { label: "Site Settings", to: "/admin/site-settings", icon: Settings },
  { label: "Pages", to: "/admin/site-pages", icon: FileText },
  { label: "Settings", to: "/settings", icon: Settings },
  {
    label: "Help & Support",
    icon: CircleHelp,
    children: [
      { label: "Help Center", to: "/admin/help-center", icon: BookOpen },
      { label: "Support Tickets", to: "/admin/support-tickets", icon: Headphones },
      { label: "Support Settings", to: "/admin/support-settings", icon: Settings },
    ],
  },
  { label: "Evidence Audit", to: "/admin/evidence-audit", icon: ShieldAlert },
  { label: "Abuse Log", to: "/admin/abuse-logs", icon: ShieldAlert },
  { label: "Security Events", to: "/admin/security-events", icon: Shield },
  { label: "File Vault", to: "/admin/file-vault", icon: FileCheck },
  { label: "Proctor Assignments", to: "/admin/proctor-assignments", icon: UserPlus },
  { label: "Proctor Scheduling", to: "/admin/proctor-scheduling", icon: Calendar },
  { label: "Proctor Incidents", to: "/admin/proctor-incidents", icon: ShieldAlert },
  { label: "Tenants & Institutions", to: "/admin/institutions", icon: Building2 },
  { label: "Policies", to: "/admin/policies", icon: FileCheck },
  { label: "Feature Flags", to: "/admin/feature-flags", icon: Flag },
  { label: "Review queue", to: "/admin/review-queue", icon: ClipboardList },
  { label: "Appeals", to: "/admin/appeals", icon: Scale },
  { label: "Certificates", to: "/admin/certificates", icon: Award },
];

// Approved teacher dashboard structure only. No direct publish, no platform config, no user management.
const teacherNav: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Organization", to: "/org", icon: Building2 },
  { label: "My Exams", to: "/admin/exams", icon: FileText },
  { label: "Question Bank", to: "/admin/question-bank", icon: BookOpen },
  { label: "Students", to: "/candidates", icon: Users },
  { label: "Proctor Monitoring", to: "/admin/proctor-assignments", icon: UserPlus },
  { label: "Proctor Scheduling", to: "/admin/proctor-scheduling", icon: Calendar },
  { label: "Results & Analytics", to: "/admin/section/reports", icon: BarChart3 },
  { label: "Revenue & Sales", to: "/admin/revenue", icon: TrendingUp },
  { label: "Blog & Articles", to: "/admin/section/blog", icon: Newspaper },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Submissions & Approvals", to: "/admin/section/submissions", icon: ClipboardList },
  { label: "Settings", to: "/settings", icon: Settings },
  {
    label: "Help & Support",
    icon: CircleHelp,
    children: [
      { label: "Help Center", to: "/admin/help-center", icon: BookOpen },
      { label: "Support Tickets", to: "/admin/support-tickets", icon: Headphones },
      { label: "Support Settings", to: "/admin/support-settings", icon: Settings },
    ],
  },
];

interface AppShellProps {
  children: ReactNode;
}

const HELP_SUPPORT_PATHS = ["/admin/help-center", "/admin/support-tickets"];

const SidebarNav = ({
  items,
  onNavigate,
  helpSupportOpen,
  onHelpSupportToggle,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  helpSupportOpen: boolean;
  onHelpSupportToggle: () => void;
}) => {
  const location = useLocation();
  const isOpen = helpSupportOpen;

  return (
    <nav className="admin-sidebar-nav">
      {items.map((item, idx) => {
        if (isNavGroup(item)) {
          const Icon = item.icon;
          const isGroupActive = item.children.some((c) =>
            location.pathname === c.to || location.pathname.startsWith(c.to + "/")
          );
          return (
            <div key={`group-${idx}`} className="admin-nav-group">
              <button
                type="button"
                className={cn(
                  "admin-nav-group-trigger",
                  isGroupActive && "active"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onHelpSupportToggle();
                }}
                aria-expanded={isOpen}
                aria-controls="admin-nav-help-support-menu"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 admin-nav-chevron" />
                ) : (
                  <ChevronRight className="h-4 w-4 admin-nav-chevron" />
                )}
              </button>
              <div
                id="admin-nav-help-support-menu"
                className={cn(
                  "admin-nav-group-dropdown",
                  isOpen && "admin-nav-group-dropdown--open"
                )}
                role="region"
                aria-label="Help & Support submenu"
              >
                <div className="admin-nav-group-dropdown-inner">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn("admin-nav-link admin-nav-link--child", isActive && "active")
                        }
                      >
                        <ChildIcon className="h-4 w-4" />
                        <span>{child.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn("admin-nav-link", isActive && "active")
            }
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.badge && <em className="admin-nav-badge">{item.badge}</em>}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const searchPlaceholder = "Search exams, candidates, teachers...";

  const location = useLocation();
  const isOnHelpSupportPath = useMemo(
    () =>
      HELP_SUPPORT_PATHS.some(
        (p) => location.pathname === p || location.pathname.startsWith(p + "/")
      ),
    [location.pathname]
  );
  const [helpSupportOpen, setHelpSupportOpen] = useState(isOnHelpSupportPath);
  useEffect(() => {
    if (isOnHelpSupportPath) setHelpSupportOpen(true);
  }, [isOnHelpSupportPath]);

  const handleHelpSupportToggle = () => setHelpSupportOpen((prev) => !prev);

  const currentUser = getStoredUser();
  // Teacher sees only approved nav; admin sees full nav. Governance: Admin = final authority.
  const isTeacherOnly = currentUser?.role?.toLowerCase() === "teacher";
  const navItems = isTeacherOnly ? teacherNav : primaryNav;

  const handleLogout = () => {
    // WHY: Use auth-api logout to clear JWT + all legacy flags
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand-wrap">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="admin-menu-btn" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="admin-mobile-panel">
                  <div className="admin-brand">
                    <LogoMark className="h-9 w-9" />
                    <BrandText />
                  </div>
                  <SidebarNav
                  items={navItems}
                  onNavigate={() => setMobileOpen(false)}
                  helpSupportOpen={helpSupportOpen}
                  onHelpSupportToggle={handleHelpSupportToggle}
                />
                </div>
              </SheetContent>
            </Sheet>
          <NavLink to="/admin/dashboard" className="admin-brand">
              <LogoMark className="h-10 w-10" />
              <BrandText />
            </NavLink>
          </div>

          <label className="admin-search">
            <Search className="h-5 w-5" />
            <input
              type="text"
              placeholder={searchPlaceholder}
            />
          </label>

          <div className="admin-top-actions">
            <button className="admin-bell-btn" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <span className="admin-dot">2</span>
            </button>
            <button
              className="admin-bell-btn"
              aria-label="Help"
              onClick={() => navigate("/admin/help-center")}
            >
              <CircleHelp className="h-5 w-5" />
            </button>
            <div className="admin-credit">84</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="admin-profile-trigger">
                  <span>{currentUser?.name || "Admin"}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <NavLink to="/admin/account">My Account</NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/admin/billing">Billing/Plan</NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <SidebarNav
            items={navItems}
            helpSupportOpen={helpSupportOpen}
            onHelpSupportToggle={handleHelpSupportToggle}
          />
        </aside>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

