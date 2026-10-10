import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Genel Bakış | FTK Studio",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || typeof authData?.claims?.sub !== "string") {
    redirect("/login");
  }

  const [membersResult, lessonsResult, subscriptionsResult, upcomingResult] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("starts_at", new Date().toISOString()),
  ]);

  const metrics = [
    { label: "Üyeler", value: membersResult.error ? "—" : String(membersResult.count ?? 0), description: membersResult.error ? "Veri alınamadı" : "Kayıtlı üye", icon: Users, href: "/dashboard/members" },
    { label: "Dersler", value: lessonsResult.error ? "—" : String(lessonsResult.count ?? 0), description: lessonsResult.error ? "Veri alınamadı" : "Tüm ders kayıtları", icon: CalendarDays, href: "/dashboard/lessons" },
    { label: "Abonelikler", value: subscriptionsResult.error ? "—" : String(subscriptionsResult.count ?? 0), description: subscriptionsResult.error ? "Veri alınamadı" : "Tüm abonelik kayıtları", icon: CreditCard, href: "/dashboard/subscriptions" },
    { label: "Yaklaşan dersler", value: upcomingResult.error ? "—" : String(upcomingResult.count ?? 0), description: upcomingResult.error ? "Veri alınamadı" : "Planlanmış gelecek ders", icon: Activity, href: "/dashboard/lessons" },
  ];

  return (
    <div className="dashboard-content">
      <div className="welcome-row">
        <div><p className="eyebrow">STÜDYO ÖZETİ</p><h1>Genel bakış</h1><p className="dashboard-subtitle">Stüdyonuzun günlük akışı ve temel kayıtları.</p></div>
        <span className="today-pill">FTK Studio</span>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link className="metric-card metric-card-link" href={metric.href} key={metric.label}>
              <div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon size={19} aria-hidden="true" /></span></div>
              <strong className="metric-value">{metric.value}</strong>
              <p>{metric.description}</p>
              <span className="metric-action">Detayları aç <ArrowUpRight size={13} aria-hidden="true" /></span>
            </Link>
          );
        })}
      </div>

      <section className="overview-panel">
        <div className="panel-heading"><div><h2>Yönetim modülleri</h2><p>Üyeleri, dersleri ve kredi hareketlerini buradan yönetin.</p></div></div>
        <div className="module-grid">
          <Link className="module-card" href="/dashboard/members"><span className="metric-icon"><Users size={19} /></span><span><strong>Üye yönetimi</strong><small>İletişim bilgileri ve üyelik durumu</small></span><ArrowUpRight size={16} /></Link>
          <Link className="module-card" href="/dashboard/lessons"><span className="metric-icon"><CalendarDays size={19} /></span><span><strong>Ders takvimi</strong><small>Özel ve grup derslerini planla</small></span><ArrowUpRight size={16} /></Link>
          <Link className="module-card" href="/dashboard/attendance"><span className="metric-icon"><Activity size={19} /></span><span><strong>Yoklama</strong><small>Katılımı kaydet, kredi tetiklerini uygula</small></span><ArrowUpRight size={16} /></Link>
          <Link className="module-card" href="/dashboard/subscriptions"><span className="metric-icon"><CreditCard size={19} /></span><span><strong>Abonelikler</strong><small>Paketleri, ödemeleri ve kalan dersleri izle</small></span><ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <p className="dashboard-footnote">Özet sayıları, giriş yapan hesabın Supabase RLS politikalarıyla erişebildiği kayıtları gösterir.</p>
    </div>
  );
}
