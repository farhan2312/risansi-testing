"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./DashboardLayout.css";
import { canAssignRetest, clearSession, getCurrentUser, isAdmin, updateCurrentUser } from "@/services/session";
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

interface Crumb {
  label: string;
  /** Omitted on the last crumb (the current page) -- everything before it
   * is a real link back up the page's own hierarchy, not just to Dashboard. */
  href?: string;
}

/** Full breadcrumb trail for the top bar, most-specific pattern checked
 * first (an edit/curve/report sub-route before its bare [id] parent) so
 * every route in the app resolves to something meaningful. Nested pages
 * (report/requisition sub-routes) get their immediate parent as a real
 * clickable link, not just "Risansi" -- previously the only clickable
 * crumb from anywhere was the Dashboard link itself. */
const pageTrail = (pathname: string): Crumb[] => {
  if (pathname === "/overview") return [{ label: "Dashboard" }];
  if (pathname === "/dashboard") return [{ label: "Testing Summary" }];
  if (pathname === "/pumps") return [{ label: "Report Compilation" }];
  if (pathname.startsWith("/pumps/")) {
    return [{ label: "Report Compilation", href: "/pumps" }, { label: "Pump Detail" }];
  }
  if (pathname === "/reports") return [{ label: "Report Archive" }];
  if (pathname === "/reports/new/observation") {
    return [{ label: "Report Archive", href: "/reports" }, { label: "New Observation Sheet" }];
  }
  if (pathname === "/reports/new/viscosity-chart") {
    return [{ label: "Report Archive", href: "/reports" }, { label: "New Viscosity Correction Chart" }];
  }
  if (pathname === "/reports/new") {
    return [{ label: "Report Archive", href: "/reports" }, { label: "New Report" }];
  }
  let m = pathname.match(/^\/reports\/([^/]+)\/edit$/);
  if (m) {
    return [
      { label: "Report Archive", href: "/reports" },
      { label: "Report Detail", href: `/reports/${m[1]}` },
      { label: "Edit Report" },
    ];
  }
  m = pathname.match(/^\/reports\/([^/]+)\/curve$/);
  if (m) {
    return [
      { label: "Report Archive", href: "/reports" },
      { label: "Report Detail", href: `/reports/${m[1]}` },
      { label: "Performance Curve" },
    ];
  }
  if (/^\/reports\/[^/]+$/.test(pathname)) {
    return [{ label: "Report Archive", href: "/reports" }, { label: "Report Detail" }];
  }
  if (pathname === "/requisitions/new") return [{ label: "New Requisition" }];
  m = pathname.match(/^\/requisitions\/([^/]+)\/edit$/);
  if (m) {
    return [
      { label: "Testing Summary", href: "/dashboard" },
      { label: "Requisition Detail", href: `/requisitions/${m[1]}` },
      { label: "Edit Requisition" },
    ];
  }
  m = pathname.match(/^\/requisitions\/([^/]+)\/report\/observation$/);
  if (m) {
    return [
      { label: "Testing Summary", href: "/dashboard" },
      { label: "Requisition Detail", href: `/requisitions/${m[1]}` },
      { label: "Fill Observation Sheet" },
    ];
  }
  m = pathname.match(/^\/requisitions\/([^/]+)\/report\/viscosity-chart$/);
  if (m) {
    return [
      { label: "Testing Summary", href: "/dashboard" },
      { label: "Requisition Detail", href: `/requisitions/${m[1]}` },
      { label: "Fill Viscosity Correction Chart" },
    ];
  }
  m = pathname.match(/^\/requisitions\/([^/]+)\/report$/);
  if (m) {
    return [
      { label: "Testing Summary", href: "/dashboard" },
      { label: "Requisition Detail", href: `/requisitions/${m[1]}` },
      { label: "Fill Test Report" },
    ];
  }
  if (/^\/requisitions\/[^/]+$/.test(pathname)) {
    return [{ label: "Testing Summary", href: "/dashboard" }, { label: "Requisition Detail" }];
  }
  if (pathname === "/admin/access-requests") return [{ label: "Access Requests" }];
  if (pathname === "/admin/users") return [{ label: "Manage Users" }];
  if (pathname === "/admin/bug-reports") return [{ label: "Bug Reports" }];
  if (pathname === "/admin/audit-log") return [{ label: "Audit Log" }];
  if (pathname === "/admin/action-registry") return [{ label: "Action Registry" }];
  return [{ label: "Pump Testing Portal" }];
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

          {/* Lives in the Testing group, not Admin -- Action Registry entries
           * come out of Testing's own Assign Retest flow, and Central Admin
           * (who doesn't get the rest of the Admin section, see CLAUDE.md)
           * still needs a way in since they can Assign Retest too. */}
          {canAssignRetest() && (
            <Link
              href="/admin/action-registry"
              className={pathname === "/admin/action-registry" ? "active" : ""}
            >
              Action Registry
            </Link>
          )}

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
            {pageTrail(pathname).map((crumb, i, trail) => (
              <Fragment key={crumb.href ?? crumb.label}>
                <span className="topbar-breadcrumb-sep">&rsaquo;</span>
                {crumb.href && i < trail.length - 1 ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span className="topbar-breadcrumb-current">{crumb.label}</span>
                )}
              </Fragment>
            ))}
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
