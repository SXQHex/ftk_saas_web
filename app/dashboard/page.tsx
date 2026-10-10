import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Music2,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export const metadata = {
  title: "Genel Bakış | FTK Studio",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims?.sub) {
    redirect("/login");
  }

  const userId = authData!.claims!.sub;
  const email = typeof authData!.claims!.email === "string" ? authData!.claims!.email : "Hesap";
  const [profileResult, membersResult, lessonsResult, subscriptionsResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }),
  ]);

  const profileMissing = Boolean(profileResult.error) || !profileResult.data;
  const roleLabel = profileResult.data?.role
    ? String(profileResult.data.role)
    : "Rol doğrulanamadı";

  const metrics = [
    {
      label: "Üyeler",
      value: membersResult.error ? "—" : String(membersResult.count ?? 0),
      description: membersResult.error ? "Veri alınamadı" : "Kayıtlı üye",
      icon: Users,
    },
    {
      label: "Dersler",
      value: lessonsResult.error ? "—" : String(lessonsResult.count ?? 0),
      description: lessonsResult.error ? "Veri alınamadı" : "Planlanan ve geçmiş ders",
      icon: CalendarDays,
    },
    {
      label: "Abonelikler",
      value: subscriptionsResult.error ? "—" : String(subscriptionsResult.count ?? 0),
      description: subscriptionsResult.error ? "Veri alınamadı" : "Kayıtlı abonelik",
      icon: CreditCard,
    },
  ];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="dashboard-brand" aria-label="FTK Studio genel bakış">
          <span className="brand-mark small">FTK</span>
          <span><strong>FTK Studio</strong><small>YÖNETİM PANELİ</small></span>
        </Link>
        <p className="nav-label">ÇALIŞMA ALANI</p>
        <nav className="side-nav" aria-label="Ana menü">
          <Link className="side-link active" href="/dashboard">
            <LayoutDashboard size={18} aria-hidden="true" /> Genel bakış
          </Link>
          <div className="side-link muted" aria-disabled="true"><Users size={18} aria-hidden="true" /> Üyeler <span>Yakında</span></div>
          <div className="side-link muted" aria-disabled="true"><CalendarDays size={18} aria-hidden="true" /> Ders takvimi <span>Yakında</span></div>
          <div className="side-link muted" aria-disabled="true"><Activity size={18} aria-hidden="true" /> Yoklama <span>Yakında</span></div>
          <div className="side-link muted" aria-disabled="true"><CreditCard size={18} aria-hidden="true" /> Abonelikler <span>Yakında</span></div>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /> Güvenli oturum</div>
          <SignOutButton />
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="mobile-dashboard-brand"><Music2 size={19} /> FTK Studio</div>
          <div className="breadcrumbs">Çalışma alanı <span>/</span> Genel bakış</div>
          <div className="account-chip"><span className="avatar">{email.slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span><strong>{email}</strong><small>{roleLabel}</small></span></div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row">
            <div><p className="eyebrow">STÜDYO ÖZETİ</p><h1>Genel bakış</h1><p className="dashboard-subtitle">Stüdyonuzun temel kayıtları tek yerde.</p></div>
            <span className="today-pill">FTK Studio</span>
          </div>

          {profileMissing && (
            <div className="notice dashboard-warning" role="status">
              Hesabınız doğrulandı ancak profil rolü okunamadı. Yetki gerektiren işlemler için profil kaydını ve RLS politikalarını kontrol edin.
            </div>
          )}

          <div className="metric-grid">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <article className="metric-card" key={metric.label}>
                  <div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon size={19} aria-hidden="true" /></span></div>
                  <strong className="metric-value">{metric.value}</strong>
                  <p>{metric.description}</p>
                </article>
              );
            })}
          </div>

          <section className="overview-panel">
            <div className="panel-heading"><div><h2>Başlangıç durumu</h2><p>Kurulum tamamlandıkça bu alanda stüdyo akışı görünecek.</p></div><span className="panel-icon"><Activity size={19} /></span></div>
            <div className="setup-list">
              <div className="setup-item"><span className="setup-number">01</span><div><strong>Supabase bağlantısı</strong><p>{profileMissing ? "Profil tablosu veya erişim politikası kontrol edilmeli." : "Oturum doğrulandı ve profil kaydı okundu."}</p></div><span className={profileMissing ? "setup-state pending" : "setup-state done"}>{profileMissing ? "Kontrol et" : "Bağlandı"}</span></div>
              <div className="setup-item"><span className="setup-number">02</span><div><strong>Üye ve ders modülleri</strong><p>Bir sonraki geliştirme adımında gerçek kayıt ekranları eklenecek.</p></div><span className="setup-state pending">Sırada</span></div>
              <div className="setup-item"><span className="setup-number">03</span><div><strong>Rol ve erişim kontrolleri</strong><p>Veri erişimi Supabase RLS politikalarıyla sınırlandırılmalıdır.</p></div><span className="setup-state pending">Doğrula</span></div>
            </div>
          </section>
          <p className="dashboard-footnote">Görünen sayılar, oturum açmış kullanıcının RLS politikalarıyla erişebildiği kayıtları yansıtır.</p>
        </div>
      </section>
    </main>
  );
}
