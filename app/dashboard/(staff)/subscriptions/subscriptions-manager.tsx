"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CirclePlus, CreditCard, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; full_name: string; is_active: boolean };
type Subscription = {
  id: string;
  member_id: string;
  type: "private_credits" | "group_4_weeks";
  starts_on: string;
  ends_on: string | null;
  credits_purchased: number;
  credits_remaining: number;
  amount: number;
  payment_status: "pending" | "paid" | "refunded";
  paid_at: string | null;
  status: "active" | "expired" | "cancelled";
  notes: string | null;
};

type SubscriptionForm = {
  member_id: string;
  type: "private_credits" | "group_4_weeks";
  starts_on: string;
  ends_on: string;
  credits_purchased: string;
  amount: string;
  payment_status: "pending" | "paid";
  notes: string;
};

const blankForm: SubscriptionForm = {
  member_id: "",
  type: "group_4_weeks",
  starts_on: "",
  ends_on: "",
  credits_purchased: "4",
  amount: "0",
  payment_status: "pending",
  notes: "",
};

const statusLabels: Record<Subscription["status"], string> = {
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
};
const paymentLabels: Record<Subscription["payment_status"], string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  refunded: "İade edildi",
};
const typeLabels: Record<Subscription["type"], string> = {
  private_credits: "Özel ders paketi",
  group_4_weeks: "Grup paketi · 4 ders",
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

export function SubscriptionsManager({
  subscriptions,
  members,
  userId,
  loadError,
}: {
  subscriptions: Subscription[];
  members: Member[];
  userId: string;
  loadError: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const filtered = subscriptions.filter((subscription) => {
    const memberName = memberById.get(subscription.member_id)?.full_name ?? "";
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return (!term || `${memberName} ${typeLabels[subscription.type]}`.toLocaleLowerCase("tr-TR").includes(term))
      && (statusFilter === "all" || subscription.status === statusFilter);
  });

  function openCreate() {
    setForm({ ...blankForm, starts_on: localToday() });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const credits = form.type === "group_4_weeks" ? 4 : Number(form.credits_purchased);
    const amount = Number(form.amount);
    if (!form.member_id || !form.starts_on) {
      setError("Üye ve başlangıç tarihi zorunludur.");
      return;
    }
    if (!Number.isInteger(credits) || credits < 1 || credits > 100) {
      setError("Ders sayısı 1 ile 100 arasında bir tam sayı olmalıdır.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Tutar sıfır veya daha büyük olmalıdır.");
      return;
    }
    if (form.type === "private_credits" && (!form.ends_on || form.ends_on < form.starts_on)) {
      setError("Özel ders paketi için başlangıçtan önce olmayan bir bitiş tarihi girin.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("subscriptions").insert({
        member_id: form.member_id,
        type: form.type,
        starts_on: form.starts_on,
        ends_on: form.type === "group_4_weeks" ? null : form.ends_on,
        credits_purchased: credits,
        credits_remaining: credits,
        amount,
        payment_status: form.payment_status,
        paid_at: form.payment_status === "paid" ? new Date().toISOString() : null,
        notes: form.notes.trim() || null,
        created_by: userId,
      });
      if (insertError) throw insertError;
      setNotice("Abonelik oluşturuldu. İlk kredi hareketi veritabanı tetikleyicisiyle kaydedildi.");
      setFormOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Abonelik oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function updateSubscription(subscription: Subscription, changes: Partial<Pick<Subscription, "payment_status" | "status">>) {
    const label = changes.status ? statusLabels[changes.status] : changes.payment_status ? paymentLabels[changes.payment_status] : "Güncelle";
    if (changes.status && changes.status !== "active" && !window.confirm("Aboneliğin durumu değiştirilsin mi? Bu işlem daha önce tüketilen kredileri geri yüklemez.")) return;
    setPendingId(subscription.id);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const payload = {
        ...changes,
        ...(changes.payment_status ? { paid_at: changes.payment_status === "paid" ? new Date().toISOString() : null } : {}),
      };
      const { error: updateError } = await supabase.from("subscriptions").update(payload).eq("id", subscription.id);
      if (updateError) throw updateError;
      setNotice(`Abonelik güncellendi: ${label}.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Abonelik güncellenemedi.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">PAKET VE ÖDEME TAKİBİ</p><h1>Abonelikler</h1><p className="dashboard-subtitle">Ders paketlerini, ödemeleri ve kalan kredileri izleyin.</p></div>
        <button className="primary-action" type="button" onClick={openCreate}><CirclePlus size={17} /> Abonelik ekle</button>
      </div>
      <div className="stat-strip">
        <div><span>Toplam paket</span><strong>{subscriptions.length}</strong></div>
        <div><span>Aktif paket</span><strong>{subscriptions.filter((s) => s.status === "active").length}</strong></div>
        <div><span>Kalan toplam kredi</span><strong>{subscriptions.reduce((sum, s) => sum + (s.status === "active" ? s.credits_remaining : 0), 0)}</strong></div>
      </div>
      {(error || notice || loadError) && <div className={error || loadError ? "notice error page-notice" : "notice success page-notice"} role={error || loadError ? "alert" : "status"}>{error || (loadError ? "Abonelikler yüklenemedi. RLS politikalarını kontrol edin." : notice)}</div>}

      {formOpen && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2>Yeni abonelik</h2><p>Grup paketi her zaman 4 kredi ve bitiş tarihi olmadan oluşturulur.</p></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Formu kapat"><X size={18} /></button></div>
          <form className="record-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label className="field-wide">Üye *<select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}><option value="">Üye seçin</option>{members.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
              <label>Paket türü *<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SubscriptionForm["type"], credits_purchased: e.target.value === "group_4_weeks" ? "4" : "8", ends_on: "" })}><option value="group_4_weeks">Grup paketi · 4 ders</option><option value="private_credits">Özel ders kredisi</option></select></label>
              <label>Başlangıç tarihi *<input required type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></label>
              {form.type === "private_credits" ? <><label>Ders kredisi *<input type="number" min="1" max="100" step="1" required value={form.credits_purchased} onChange={(e) => setForm({ ...form, credits_purchased: e.target.value })} /></label><label>Bitiş tarihi *<input required type="date" min={form.starts_on || undefined} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></label></> : <label>Ders kredisi<input readOnly value="4 kredi (sabit)" /></label>}
              <label>Paket tutarı (₺) *<input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              <label>Ödeme durumu<select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value as SubscriptionForm["payment_status"] })}><option value="pending">Bekliyor</option><option value="paid">Ödendi</option></select></label>
              <label className="field-wide">Notlar<textarea rows={2} maxLength={1500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="İsteğe bağlı notlar" /></label>
            </div>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Aboneliği oluştur"}</button></div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Paket listesi</h2><p>{filtered.length} kayıt gösteriliyor</p></div><div className="toolbar-filters"><label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye veya paket ara…" aria-label="Abonelik ara" /></label><select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Abonelik durumuna göre filtrele"><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="expired">Süresi doldu</option><option value="cancelled">İptal</option></select></div></div>
        {subscriptions.length === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><CreditCard size={24} /></span><h3>Henüz abonelik yok</h3><p>Üye için ilk ders paketini oluşturarak başlayın.</p><button className="secondary-action" type="button" onClick={openCreate}>Abonelik ekle</button></div>
        ) : filtered.length === 0 ? <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama veya filtre ölçütünü değiştirin.</p></div> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Üye / Paket</th><th>Kredi</th><th>Tutar</th><th>Ödeme</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>
            {filtered.map((subscription) => {
              const member = memberById.get(subscription.member_id);
              const disabled = pendingId === subscription.id;
              return <tr key={subscription.id}>
                <td><div className="person-cell"><span className="person-avatar"><CreditCard size={15} /></span><span><strong>{member?.full_name ?? "Üye kaydı bulunamadı"}</strong><small>{typeLabels[subscription.type]} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(subscription.starts_on))}{subscription.ends_on ? ` – ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(subscription.ends_on))}` : " · Bitiş tarihi yok"}</small></span></div></td>
                <td><div className="credit-cell"><strong>{subscription.credits_remaining} / {subscription.credits_purchased}</strong><span className="credit-bar"><span style={{ width: `${Math.min(100, Math.max(0, subscription.credits_remaining / subscription.credits_purchased * 100))}%` }} /></span></div></td>
                <td><strong className="amount-cell">{money(Number(subscription.amount))}</strong></td>
                <td><select className="inline-select" disabled={disabled || subscription.payment_status === "refunded"} value={subscription.payment_status} onChange={(e) => void updateSubscription(subscription, { payment_status: e.target.value as Subscription["payment_status"] })} aria-label="Ödeme durumunu değiştir"><option value="pending">Bekliyor</option><option value="paid">Ödendi</option>{subscription.payment_status === "refunded" && <option value="refunded">İade edildi</option>}</select></td>
                <td><span className={subscription.status === "active" ? "status-pill active-status" : "status-pill inactive-status"}><span />{statusLabels[subscription.status]}</span></td>
                <td>{subscription.status === "active" ? <select className="inline-select" disabled={disabled} value={subscription.status} onChange={(e) => void updateSubscription(subscription, { status: e.target.value as Subscription["status"] })} aria-label="Abonelik durumunu değiştir"><option value="active">Aktif</option><option value="cancelled">İptal et</option><option value="expired">Süresi doldu</option></select> : <button className="icon-button" type="button" disabled={disabled} onClick={() => void updateSubscription(subscription, { status: "active" })} aria-label="Aboneliği yeniden aktifleştir"><Check size={16} /></button>}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
