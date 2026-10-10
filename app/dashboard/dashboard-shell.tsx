"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Music2,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "@/app/dashboard/sign-out-button";

const navigation = [
  { href: "/dashboard", label: "Genel bakış", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/members", label: "Üyeler", icon: Users },
  { href: "/dashboard/lessons", label: "Ders takvimi", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Yoklama", icon: Activity },
  { href: "/dashboard/subscriptions", label: "Abonelikler", icon: CreditCard },
  { href: "/dashboard/credits", label: "Kredi hareketleri", icon: Wallet },
];

export function DashboardShell({
  children,
  email,
  roleLabel,
}: {
  children: ReactNode;
  email: string;
  roleLabel: string;
}) {
  const pathname = usePathname();

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="dashboard-brand" aria-label="FTK Studio genel bakış">
          <span className="brand-mark small">FTK</span>
          <span><strong>FTK Studio</strong><small>YÖNETİM PANELİ</small></span>
        </Link>
        <p className="nav-label">ÇALIŞMA ALANI</p>
        <nav className="side-nav" aria-label="Ana menü">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} className={`side-link${active ? " active" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
                <Icon size={18} aria-hidden="true" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /> Güvenli oturum</div>
          <SignOutButton />
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="mobile-dashboard-brand"><Music2 size={19} /> FTK Studio</div>
          <div className="breadcrumbs">Çalışma alanı <span>/</span> {navigation.find((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href))?.label ?? "Panel"}</div>
          <div className="account-chip"><span className="avatar">{email.slice(0, 1).toLocaleUpperCase("tr-TR") || "S"}</span><span><strong>{email || "Hesap"}</strong><small>{roleLabel}</small></span></div>
        </header>
        {children}
      </section>
    </main>
  );
}
