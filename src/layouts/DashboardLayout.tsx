"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./DashboardLayout.css";
import { clearSession, getCurrentUser, isAdmin, updateCurrentUser } from "@/services/session";
import { useTheme } from "@/contexts/ThemeContext";
import EditPasswordModal from "@/components/ui/EditPasswordModal";
import { listPendingUsers } from "@/services/adminService";

const PENDING_REQUESTS_POLL_MS = 30000;

const NAV_ITEMS = [
  { href: "/dashboard", label: "Testing Summary" },
  { href: "/requisitions/new", label: "New Requisition", hideFor: ["testing"] },
  { href: "/reports", label: "Report Archive" },
  { href: "/pumps", label: "Pump Dashboard" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  "central-admin": "Central Admin",
  source: "Source Team",
  testing: "Testing Team",
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

  const handleLogout = () => {
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
        <main className="testing-main">{children}</main>
      </div>

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
