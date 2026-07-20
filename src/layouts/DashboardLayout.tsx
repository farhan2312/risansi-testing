"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./DashboardLayout.css";
import { clearSession, getCurrentUser, isAdmin } from "@/services/session";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Requisitions" },
  { href: "/requisitions/new", label: "New Requisition" },
  { href: "/reports/new", label: "Test Report" },
  { href: "/reports", label: "Report Archive" },
];

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const user = getCurrentUser();
  const { theme, toggleTheme } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
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
        <div className="testing-sidebar-brand">
          <img src="/logo.png" alt="Risansi Industries" />
          <span>Pump Testing Portal</span>
        </div>

        <nav className="testing-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin() && (
            <Link
              href="/admin/access-requests"
              className={pathname === "/admin/access-requests" ? "active" : ""}
            >
              Access Requests
            </Link>
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

              <button type="button" className="sidebar-profile-menu-item danger" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}

          <button type="button" className="sidebar-profile-trigger" onClick={() => setMenuOpen((v) => !v)}>
            <span className="sidebar-avatar">{initial}</span>
            <span className="sidebar-profile-text">
              <strong>{displayName}</strong>
              <span>{user?.role === "admin" ? "System Admin" : "Tester"}</span>
            </span>
            <span className={`sidebar-chevron ${menuOpen ? "open" : ""}`}>&#9662;</span>
          </button>
        </div>
      </aside>

      <div className="testing-content">
        <main className="testing-main">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
