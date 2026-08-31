"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./DashboardLayout.css";
import { clearSession, getCurrentUser, isAdmin, updateCurrentUser } from "@/services/session";
import { useTheme } from "@/contexts/ThemeContext";
import EditPasswordModal from "@/components/ui/EditPasswordModal";
import ReportBugModal from "@/components/ui/ReportBugModal";
import { listPendingUsers } from "@/services/adminService";
import { logout as logoutRequest } from "@/services/authService";
import { recordPageView } from "@/services/auditService";

const PENDING_REQUESTS_POLL_MS = 30000;

const NAV_ITEMS: { href: string; label: string; hideFor?: string[] }[] = [
  { href: "/overview", label: "Dashboard" },
  { href: "/requisitions/new", label: "New Requisition" },
  { href: "/dashboard", label: "Testing Summary" },
  { href: "/pumps", label: "Report Compilation" },
  { href: "/reports", label: "Report Archive" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  "central-admin": "Central Admin",
  source: "Source Team",
  testing: "Testing Team",
};

/** Current page's label for the top breadcrumb bar -- checked most-specific
 * pattern first (an edit/curve/report sub-route before its bare [id] parent)
 * so every route in the app resolves to something meaningful. */
const pageLabel = (pathname: string): string => {
  if (pathname === "/overview") return "Dashboard";
  if (pathname === "/dashboard") return "Testing Summary";
  if (pathname === "/pumps") return "Report Compilation";
  if (pathname.startsWith("/pumps/")) return "Report Compilation";
  if (pathname === "/reports") return "Report Archive";
  if (pathname === "/reports/new/observation") return "New Observation Sheet";
  if (pathname === "/reports/new/viscosity-chart") return "New Viscosity Correction Chart";
  if (pathname === "/reports/new") return "New Report";
  if (/^\/reports\/[^/]+\/edit$/.test(pathname)) return "Edit Report";
  if (/^\/reports\/[^/]+\/curve$/.test(pathname)) return "Performance Curve";
  if (/^\/reports\/[^/]+$/.test(pathname)) return "Report Detail";
  if (pathname === "/requisitions/new") return "New Requisition";
  if (/^\/requisitions\/[^/]+\/edit$/.test(pathname)) return "Edit Requisition";
  if (/^\/requisitions\/[^/]+\/report\/observation$/.test(pathname)) return "Fill Observation Sheet";
  if (/^\/requisitions\/[^/]+\/report\/viscosity-chart$/.test(pathname)) return "Fill Viscosity Correction Chart";
  if (/^\/requisitions\/[^/]+\/report$/.test(pathname)) return "Fill Test Report";
  if (/^\/requisitions\/[^/]+$/.test(pathname)) return "Requisition Detail";
  if (pathname === "/admin/access-requests") return "Access Requests";
  if (pathname === "/admin/users") return "Manage Users";
  if (pathname === "/admin/bug-reports") return "Bug Reports";
  if (pathname === "/admin/audit-log") return "Audit Log";
  return "Pump Testing Portal";
};

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const user = getCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const role = user?.role ?? "testing";
  const navItems = NAV_ITEMS.filter((item) => !item.hideFor?.includes(role));

  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showReportBug, setShowReportBug] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(user?.must_change_password ?? false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Polls for pending access requests so admins see a live badge on the nav
  // item without having to open the Access Requests page to find out.
  useEffect(() => {
    if (!isAdmin()) return;

    let cancelled = false;
    const poll = () => {
      listPendingUsers()
        .then((rows) => {
          if (!cancelled) setPendingRequestCount(rows.length);
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, PENDING_REQUESTS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The useState initializer above only runs on this component's very first
  // render. AuthGuard (the parent) renders null until its own auth check
  // resolves, and by the time DashboardLayout first mounts the session
  // should already be in localStorage -- but re-checking explicitly on mount
  // removes any dependency on exact render timing, so a stale/false initial
  // value can never get permanently stuck.
  useEffect(() => {
    const current = getCurrentUser();
    if (current && current.must_change_password && !mustChangePassword) {
      setMustChangePassword(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Records a page view on every route change, for the Audit Log's Usage &
  // Time tab -- fire-and-forget, never blocks navigation.
  useEffect(() => {
    if (pathname) recordPageView(pathname);
  }, [pathname]);

  const handleLogout = async () => {
    await logoutRequest();
    clearSession();
    router.push("/");
  };

  const displayName = user?.name ?? user?.email ?? "Tester";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="testing-layout">
      <aside className="testing-sidebar">
        <div className="testing-sidebar-logo">
          <img src="/logo.png" alt="Risansi Industries" />
        </div>

        <nav className="testing-nav">
          <p className="testing-nav-group-label">Testing</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}

          {isAdmin() && (
            <>
              <p className="testing-nav-group-label">Admin</p>
              <Link
                href="/admin/access-requests"
                className={pathname === "/admin/access-requests" ? "active" : ""}
              >
                Access Requests
                {pendingRequestCount > 0 && (
                  <span className="nav-badge">{pendingRequestCount}</span>
                )}
              </Link>
              <Link
                href="/admin/users"
                className={pathname === "/admin/users" ? "active" : ""}
              >
                Manage Users
              </Link>
              <Link
                href="/admin/bug-reports"
                className={pathname === "/admin/bug-reports" ? "active" : ""}
              >
                Bug Reports
              </Link>
              <Link
                href="/admin/audit-log"
                className={pathname === "/admin/audit-log" ? "active" : ""}
              >
                Audit Log
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-profile" ref={menuRef}>
          {menuOpen && (
            <div className="sidebar-profile-menu">
              <div className="sidebar-profile-menu-header">
                <strong>{user?.name ?? "Tester"}</strong>
                <span>{user?.email ?? ""}</span>
              </div>

              <button type="button" className="sidebar-profile-menu-item" onClick={toggleTheme}>
                <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
                <span className={`theme-switch ${theme === "dark" ? "on" : ""}`}>
                  <span className="theme-switch-knob" />
                </span>
              </button>

              <button
                type="button"
                className="sidebar-profile-menu-item"
                onClick={() => {
                  setShowEditPassword(true);
                  setMenuOpen(false);
                }}
              >
                Change Password
              </button>

              <button type="button" className="sidebar-profile-menu-item danger" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}

          <button type="button" className="sidebar-profile-trigger" onClick={() => setMenuOpen((v) => !v)}>
            <span className="sidebar-avatar">{initial}</span>
            <span className="sidebar-profile-text">
              <strong>{displayName}</strong>
              <span>{ROLE_LABELS[user?.role ?? "testing"] ?? "Tester"}</span>
            </span>
            <span className={`sidebar-chevron ${menuOpen ? "open" : ""}`}>&#9662;</span>
          </button>
        </div>
      </aside>

      <div className="testing-content">
        <div className="testing-topbar">
          <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
            <Link href="/overview">Risansi</Link>
            <span className="topbar-breadcrumb-sep">&rsaquo;</span>
            <span className="topbar-breadcrumb-current">{pageLabel(pathname)}</span>
          </nav>
          <button type="button" className="topbar-report-bug-btn" onClick={() => setShowReportBug(true)}>
            🐛 Report a Bug
          </button>
        </div>
        <main className="testing-main">{children}</main>
      </div>

      {showReportBug && <ReportBugModal onClose={() => setShowReportBug(false)} />}

      {mustChangePassword ? (
        <EditPasswordModal
          mandatory
          onClose={() => {}}
          onSuccess={() => {
            updateCurrentUser({ must_change_password: false });
            setMustChangePassword(false);
          }}
        />
      ) : (
        showEditPassword && <EditPasswordModal onClose={() => setShowEditPassword(false)} />
      )}
    </div>
  );
};

export default DashboardLayout;
