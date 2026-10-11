"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, History, PlusCircle, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; full_name: string };
type Subscription = {
  id: string;
  member_id: string;
  type: "private_credits" | "group_4_weeks";
  credits_purchased: number;
  credits_remaining: number;
  status: "active" | "expired" | "cancelled";
};
type Transaction = {
  id: string;
  subscription_id: string;
  member_id: string;
  lesson_id: string | null;
  amount: number;
  reason: "purchase" | "lesson_use" | "admin_adjustment" | "refund";
  note: string | null;
  created_at: string;
};

const reasonLabels: Record<Transaction["reason"], string> = {
  purchase: "Paket alımı",
  lesson_use: "Ders kullanımı",
  admin_adjustment: "Yönetici düzeltmesi",
  refund: "İade",
};
const typeLabels: Record<Subscription["type"], string> = {
  private_credits: "Özel ders",
  group_4_weeks: "Grup paketi",
};

export function CreditsManager({
  transactions,
  subscriptions,
  members,
  userId,
  loadError,
}: {
  transactions: Transaction[];
  subscriptions: Subscription[];
  members: Member[];
  userId: string;
  loadError: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member.full_name])), [members]);
  const subscriptionMap = useMemo(() => new Map(subscriptions.map((subscription) => [subscription.id, subscription])), [subscriptions]);
  const filtered = transactions.filter((transaction) => {
    const memberName = memberMap.get(transaction.member_id) ?? "";
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return !term || `${memberName} ${transaction.note ?? ""} ${reasonLabels[transaction.reason]}`.toLocaleLowerCase("tr-TR").includes(term);
  });
  const selectedSubscription = subscriptions.find((subscription) => subscription.id === subscriptionId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const delta = Number(amount);
    if (!selectedSubscription) {
      setError("Kredi düzeltmesi için bir aktif abonelik seçin.");
      return;
    }
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) {
      setError("Değişim miktarı -100 ile 100 arasında sıfır olmayan bir tam sayı olmalı.");
      return;
    }
    if (selectedSubscription.credits_remaining + delta < 0 || selectedSubscription.credits_remaining + delta > selectedSubscription.credits_purchased) {
      setError("Bu değişiklik kredi bakiyesini 0 ile satın alınan kredi sayısı aralığının dışına çıkarıyor.");
      return;
    }
    if (!note.trim()) {
      setError("Düzeltme açıklaması zorunludur.");
      return;
    }
    if (!window.confirm(`${memberMap.get(selectedSubscription.member_id) ?? "Üye"} için kredi bakiyesi ${delta > 0 ? "+" : ""}${delta} değiştirilecek. Devam edilsin mi?`)) return;

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("credit_transactions").insert({
        subscription_id: selectedSubscription.id,
        member_id: selectedSubscription.member_id,
        amount: delta,
        reason: "admin_adjustment",
        note: note.trim(),
        created_by: userId,
      });
      if (insertError) throw insertError;
      setNotice("Kredi düzeltmesi kaydedildi. Bakiye veritabanı tetikleyicisiyle güncellendi.");
      setAmount("1");
      setNote("");
      setFormOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kredi düzeltmesi yapılamadı. Bakiye ve yetkiyi kontrol edin.");
    } finally {
      setBusy(false);
    }
  }

  const positiveTotal = transactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const negativeTotal = transactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">BAKİYE VE HAREKETLER</p><h1>Kredi hareketleri</h1><p className="dashboard-subtitle">Tüm kredi değişikliklerini izleyin; manuel düzeltmeleri açıklama ile kaydedin.</p></div>
        <button className="primary-action" type="button" onClick={() => { setFormOpen((value) => !value); setError(""); setNotice(""); }}><PlusCircle size={17} /> Kredi düzelt</button>
      </div>

      <div className="stat-strip">
        <div><span>İşlem kaydı</span><strong>{transactions.length}</strong></div>
        <div><span>Eklenen kredi</span><strong className="positive-number">+{positiveTotal}</strong></div>
        <div><span>Kullanılan kredi</span><strong className="negative-number">−{negativeTotal}</strong></div>
      </div>

      {(error || notice || loadError) && <div className={error || loadError ? "notice error page-notice" : "notice success page-notice"} role={error || loadError ? "alert" : "status"}>{error || (loadError ? "Kredi hareketleri yüklenemedi. RLS politikalarını kontrol edin." : notice)}</div>}

      {formOpen && <section className="form-card">
        <div className="form-card-heading"><div><h2>Manuel kredi düzeltmesi</h2><p>Pozitif değer kredi ekler, negatif değer kredi düşer. Geçmiş kayıtlar silinmez.</p></div><span className="panel-icon"><History size={19} /></span></div>
        <form className="record-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field-wide">Üye paketi *<select required value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)}><option value="">Aktif abonelik seçin</option>{subscriptions.filter((s) => s.status === "active").map((subscription) => <option key={subscription.id} value={subscription.id}>{memberMap.get(subscription.member_id) ?? "Üye"} · {typeLabels[subscription.type]} · {subscription.credits_remaining}/{subscription.credits_purchased} kredi</option>)}</select></label>
            <label>Kredi değişimi *<input required type="number" step="1" min="-100" max="100" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="field-wide">Açıklama *<textarea required rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Düzeltme nedeni" /></label>
          </div>
          {selectedSubscription && <p className="inline-info"><History size={15} /> Mevcut bakiye: {selectedSubscription.credits_remaining}. İşlem sonrası bakiye {selectedSubscription.credits_remaining + (Number(amount) || 0)} olacak.</p>}
          <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy || !subscriptions.some((s) => s.status === "active")}>{busy ? "Kaydediliyor…" : "Düzeltmeyi kaydet"}</button></div>
        </form>
      </section>}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Hareket geçmişi</h2><p>{filtered.length} işlem gösteriliyor</p></div><label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye veya açıklama ara…" aria-label="Kredi hareketlerinde ara" /></label></div>
        {transactions.length === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><History size={24} /></span><h3>Henüz kredi hareketi yok</h3><p>Abonelik oluşturulduğunda satın alma hareketi otomatik kaydedilir.</p></div>
        ) : filtered.length === 0 ? <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama ölçütünü değiştirin.</p></div> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Tarih</th><th>Üye / Paket</th><th>İşlem</th><th>Değişim</th><th>Açıklama</th></tr></thead><tbody>
            {filtered.map((transaction) => {
              const sub = subscriptionMap.get(transaction.subscription_id);
              return <tr key={transaction.id}>
                <td>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.created_at))}</td>
                <td><div className="person-cell"><span className="person-avatar"><History size={15} /></span><span><strong>{memberMap.get(transaction.member_id) ?? "Üye"}</strong><small>{sub ? typeLabels[sub.type] : "Paket kaydı yok"}</small></span></div></td>
                <td><span className="reason-pill">{reasonLabels[transaction.reason]}</span></td>
                <td><strong className={transaction.amount > 0 ? "positive-number" : "negative-number"}>{transaction.amount > 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{transaction.amount > 0 ? "+" : ""}{transaction.amount}</strong></td>
                <td>{transaction.note || "—"}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </>
  );
}
