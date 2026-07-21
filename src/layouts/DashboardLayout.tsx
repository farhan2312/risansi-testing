"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./DashboardLayout.css";
import { clearSession, getCurrentUser, isAdmin } from "@/services/session";
import { useTheme } from "@/contexts/ThemeContext";
import EditPasswordModal from "@/components/ui/EditPasswordModal";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Requisitions" },
  { href: "/requisitions/new", label: "New Requisition", hideFor: ["testing"] },
  { href: "/reports/new", label: "Test Report", hideFor: ["source"] },
  { href: "/reports", label: "Report Archive" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "System Admin",
  source: "Source Team",
  testing: "Testing Team",
  user: "Tester",
};

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const user = getCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const role = user?.role ?? "user";
  const navItems = NAV_ITEMS.filter((item) => !item.hideFor?.includes(role));

  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
              <span>{ROLE_LABELS[user?.role ?? "user"] ?? "Tester"}</span>
            </span>
            <span className={`sidebar-chevron ${menuOpen ? "open" : ""}`}>&#9662;</span>
          </button>
        </div>
      </aside>

      <div className="testing-content">
        <main className="testing-main">{children}</main>
      </div>

      {showEditPassword && <EditPasswordModal onClose={() => setShowEditPassword(false)} />}
    </div>
  );
};

export default DashboardLayout;
