"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, CirclePlus, Search, UserCheck, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; full_name: string; phone: string | null; email: string | null; is_active: boolean };
type Lesson = { id: string; type: "private" | "group"; title: string; starts_at: string; status: "scheduled" | "completed" | "cancelled" | "postponed" };
type AttendanceRow = { id: string; lesson_id: string; member_id: string; attended: boolean; checked_in_at: string; notes: string | null };

const statusLabels: Record<Lesson["status"], string> = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  postponed: "Ertelendi",
};

export function AttendanceManager({
  lessons,
  members,
  attendance,
  userId,
  loadError,
}: {
  lessons: Lesson[];
  members: Member[];
  attendance: AttendanceRow[];
  userId: string;
  loadError: boolean;
}) {
  const router = useRouter();
  const [lessonId, setLessonId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [attended, setAttended] = useState(true);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId);
  const selectedAttendance = useMemo(() => attendance
    .filter((row) => (!lessonId || row.lesson_id === lessonId))
    .filter((row) => {
      if (!query.trim()) return true;
      const member = members.find((item) => item.id === row.member_id);
      return (member?.full_name ?? "").toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR"));
    })
    .sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime()),
  [attendance, lessonId, members, query]);

  const recordedMemberIds = new Set(attendance.filter((row) => row.lesson_id === lessonId).map((row) => row.member_id));
  const eligibleMembers = members.filter((member) => !recordedMemberIds.has(member.id));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!lessonId || !memberId) {
      setError("Ders ve üye seçmeniz gerekiyor.");
      return;
    }
    if (selectedLesson && (selectedLesson.status === "cancelled" || selectedLesson.status === "postponed")) {
      setError("İptal veya ertelenmiş bir ders için yoklama kaydı eklenemez.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("attendance").insert({
        lesson_id: lessonId,
        member_id: memberId,
        attended,
        notes: notes.trim() || null,
        checked_in_by: userId,
      });
      if (insertError) throw insertError;
      setNotice("Yoklama kaydedildi. Grup dersinde kredi tüketimini veritabanı kuralları yönetir.");
      setMemberId("");
      setNotes("");
      setAttended(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yoklama kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">KATILIM TAKİBİ</p><h1>Yoklama</h1><p className="dashboard-subtitle">Derse katılımı kaydedin. Kredi bakiyesi istemci tarafından değiştirilmez.</p></div>
      </div>

      <div className="stat-strip">
        <div><span>Toplam kayıt</span><strong>{attendance.length}</strong></div>
        <div><span>Katıldı</span><strong>{attendance.filter((row) => row.attended).length}</strong></div>
        <div><span>Katılmadı</span><strong>{attendance.filter((row) => !row.attended).length}</strong></div>
      </div>

      {(error || notice || loadError) && <div className={error || loadError ? "notice error page-notice" : "notice success page-notice"} role={error || loadError ? "alert" : "status"}>{error || (loadError ? "Yoklama listesi yüklenemedi. RLS politikalarını kontrol edin." : notice)}</div>}

      <section className="form-card attendance-entry">
        <div className="form-card-heading"><div><h2>Yoklama ekle</h2><p>Her ders ve üye için tek bir kayıt oluşturun.</p></div><span className="panel-icon"><UserCheck size={19} /></span></div>
        <form className="record-form" onSubmit={handleSubmit}>
          <div className="field-grid">
            <label className="field-wide">Ders *<select required value={lessonId} onChange={(e) => { setLessonId(e.target.value); setMemberId(""); }}><option value="">Ders seçin</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id} disabled={lesson.status === "cancelled" || lesson.status === "postponed"}>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lesson.starts_at))} · {lesson.title} · {lesson.type === "group" ? "Grup" : "Özel"} · {statusLabels[lesson.status]}</option>)}</select></label>
            <label>Üye *<select required value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={!lessonId}><option value="">Üye seçin</option>{eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name}{!member.is_active ? " (pasif)" : ""}</option>)}</select></label>
            <label className="check-field attendance-check"><input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)} /> Katıldı</label>
            <label className="field-wide">Notlar<textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="İsteğe bağlı notlar" /></label>
          </div>
          {selectedLesson?.type === "group" && <p className="inline-info"><CheckCircle2 size={15} /> Grup dersine yoklama eklenmesi dersi tamamlanmış sayar. Aktif grup aboneliklerinden uygun krediler bir kez düşülür; katıldı/katılmadı seçimi bu kuralı değiştirmez.</p>}
          {selectedLesson?.type === "private" && <p className="inline-info"><CheckCircle2 size={15} /> Özel ders kredisi, ders durumu yönetim panelinde “Tamamlandı” yapıldığında tüketilir.</p>}
          <div className="form-actions"><button className="primary-action" type="submit" disabled={busy || !lessonId || !memberId}><CirclePlus size={16} />{busy ? "Kaydediliyor…" : "Yoklamayı kaydet"}</button></div>
        </form>
      </section>

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Yoklama kayıtları</h2><p>{selectedAttendance.length} kayıt gösteriliyor</p></div><div className="toolbar-filters"><label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Üye ara…" aria-label="Yoklamada üye ara" /></label><select className="filter-select" value={lessonId} onChange={(e) => { setLessonId(e.target.value); setMemberId(""); }} aria-label="Derse göre filtrele"><option value="">Tüm dersler</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(new Date(lesson.starts_at))}</option>)}</select></div></div>
        {attendance.length === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><Activity size={24} /></span><h3>Henüz yoklama kaydı yok</h3><p>Yukarıdaki formdan ilk katılım kaydınızı ekleyin.</p></div>
        ) : selectedAttendance.length === 0 ? (
          <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Ders veya arama ölçütünü değiştirin.</p></div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Üye</th><th>Ders</th><th>Kayıt zamanı</th><th>Katılım</th></tr></thead><tbody>{selectedAttendance.map((row) => {
            const member = members.find((item) => item.id === row.member_id);
            const lesson = lessons.find((item) => item.id === row.lesson_id);
            return <tr key={row.id}><td><div className="person-cell"><span className="person-avatar">{(member?.full_name ?? "?").slice(0, 1).toLocaleUpperCase("tr-TR")}</span><span><strong>{member?.full_name ?? "Üye kaydı bulunamadı"}</strong><small>{row.notes || member?.email || member?.phone || "Ek not yok"}</small></span></div></td><td><div className="lesson-cell"><span><strong>{lesson?.title ?? "Ders kaydı bulunamadı"}</strong><small>{lesson ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lesson.starts_at)) : ""}</small></span></div></td><td>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.checked_in_at))}</td><td><span className={row.attended ? "status-pill active-status" : "status-pill inactive-status"}>{row.attended ? <CheckCircle2 size={13} /> : <UserX size={13} />}{row.attended ? "Katıldı" : "Katılmadı"}</span></td></tr>;
          })}</tbody></table></div>
        )}
      </section>
    </>
  );
}
