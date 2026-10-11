"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CirclePlus, Edit2, Mail, Phone, Search, UserRound, UserRoundX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

const emptyForm = { full_name: "", phone: "", email: "", notes: "", is_active: true };

export function MembersManager({ members, loadError }: { members: Member[]; loadError: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filteredMembers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    if (!term) return members;
    return members.filter((member) =>
      [member.full_name, member.phone ?? "", member.email ?? ""]
        .some((value) => value.toLocaleLowerCase("tr-TR").includes(term))
    );
  }, [members, query]);

  const activeCount = members.filter((member) => member.is_active).length;
  const inactiveCount = members.length - activeCount;

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setForm({
      full_name: member.full_name,
      phone: member.phone ?? "",
      email: member.email ?? "",
      notes: member.notes ?? "",
      is_active: member.is_active,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };

    if (!payload.full_name) {
      setError("Üye adı zorunludur.");
      setBusy(false);
      return;
    }

    try {
      const supabase = createClient();
      const result = editingId
        ? await supabase.from("members").update(payload).eq("id", editingId)
        : await supabase.from("members").insert(payload);
      if (result.error) throw result.error;

      setNotice(editingId ? "Üye bilgileri güncellendi." : "Yeni üye kaydedildi.");
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Üye kaydedilemedi. Yetkinizi kontrol edin.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(member: Member) {
    setPendingId(member.id);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("members")
        .update({ is_active: !member.is_active })
        .eq("id", member.id);
      if (updateError) throw updateError;
      setNotice(member.is_active ? "Üye pasife alındı." : "Üye yeniden aktifleştirildi.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Üye durumu güncellenemedi.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">ÜYE KAYITLARI</p><h1>Üyeler</h1><p className="dashboard-subtitle">Üye bilgilerini ve aktiflik durumunu yönetin.</p></div>
        <button className="primary-action" type="button" onClick={startCreate}><CirclePlus size={17} /> Yeni üye</button>
      </div>

      <div className="stat-strip">
        <div><span>Toplam üye</span><strong>{members.length}</strong></div>
        <div><span>Aktif</span><strong>{activeCount}</strong></div>
        <div><span>Pasif</span><strong>{inactiveCount}</strong></div>
      </div>

      {(error || notice || loadError) && <div className={error || loadError ? "notice error page-notice" : "notice success page-notice"} role={error || loadError ? "alert" : "status"}>{error || (loadError ? "Üyeler yüklenemedi. RLS politikalarını ve yönetici rolünü kontrol edin." : notice)}</div>}

      {formOpen && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2>{editingId ? "Üye bilgilerini düzenle" : "Yeni üye kaydı"}</h2><p>Yıldızlı alanlar zorunludur.</p></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Formu kapat"><X size={18} /></button></div>
          <form className="record-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label>Ad soyad *<input required maxLength={160} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Üyenin adı soyadı" /></label>
              <label>Telefon<input type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+90 5xx xxx xx xx" /></label>
              <label>E-posta<input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="uye@ornek.com" /></label>
              <label className="field-wide">Notlar<textarea maxLength={2000} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="İsteğe bağlı notlar" /></label>
              <label className="check-field"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Üye aktif</label>
            </div>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : editingId ? "Değişiklikleri kaydet" : "Üyeyi kaydet"}</button></div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Üye listesi</h2><p>{filteredMembers.length} kayıt gösteriliyor</p></div><label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye ara…" aria-label="Üye ara" /></label></div>
        {members.length === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><UserRound size={24} /></span><h3>Henüz üye yok</h3><p>İlk üye kaydınızı oluşturarak başlayın.</p><button className="secondary-action" onClick={startCreate} type="button">Üye ekle</button></div>
        ) : filteredMembers.length === 0 ? (
          <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama ölçütünü değiştirin.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Üye</th><th>İletişim</th><th>Durum</th><th className="actions-head">İşlem</th></tr></thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td><div className="person-cell"><span className="person-avatar">{member.full_name.trim().slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span><strong>{member.full_name}</strong><small>Eklenme: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(member.created_at))}</small></span></div></td>
                    <td><div className="contact-cell">{member.phone && <span><Phone size={13} />{member.phone}</span>}{member.email && <span><Mail size={13} />{member.email}</span>}{!member.phone && !member.email && <span className="subtle">Bilgi girilmedi</span>}</div></td>
                    <td><span className={member.is_active ? "status-pill active-status" : "status-pill inactive-status"}><span />{member.is_active ? "Aktif" : "Pasif"}</span></td>
                    <td><div className="row-actions"><button className="icon-button" type="button" onClick={() => startEdit(member)} aria-label={`${member.full_name} bilgilerini düzenle`}><Edit2 size={16} /></button><button className="icon-button" type="button" disabled={pendingId === member.id} onClick={() => void toggleActive(member)} aria-label={member.is_active ? "Üyeyi pasife al" : "Üyeyi aktifleştir"}>{member.is_active ? <UserRoundX size={16} /> : <Check size={16} />}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
