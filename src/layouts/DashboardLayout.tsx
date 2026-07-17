"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./DashboardLayout.css";
import { clearSession, getCurrentUser } from "@/services/session";

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

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

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
        </nav>
      </aside>

      <div className="testing-content">
        <header className="testing-topbar">
          <span className="testing-user">{user?.name ?? user?.email ?? "Tester"}</span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <main className="testing-main">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
