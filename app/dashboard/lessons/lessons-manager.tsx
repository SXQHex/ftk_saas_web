"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, CirclePlus, Clock3, Edit2, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MemberOption = { id: string; full_name: string };
type InstructorOption = { id: string; full_name: string; role: string };
type Lesson = {
  id: string;
  type: "private" | "group";
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: "scheduled" | "completed" | "cancelled" | "postponed";
  instructor_id: string | null;
  private_member_id: string | null;
  notes: string | null;
};

type LessonForm = {
  type: "private" | "group";
  title: string;
  starts_at: string;
  ends_at: string;
  instructor_id: string;
  private_member_id: string;
  notes: string;
};

const emptyForm: LessonForm = {
  type: "group",
  title: "Grup dersi",
  starts_at: "",
  ends_at: "",
  instructor_id: "",
  private_member_id: "",
  notes: "",
};

const statusLabels: Record<Lesson["status"], string> = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  postponed: "Ertelendi",
};

function localDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LessonsManager({
  lessons,
  members,
  instructors,
  loadError,
  canManage,
}: {
  lessons: Lesson[];
  members: MemberOption[];
  instructors: InstructorOption[];
  loadError: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return lessons.filter((lesson) => {
      const textMatches = !term || [lesson.title, lesson.notes ?? ""].some((value) => value.toLocaleLowerCase("tr-TR").includes(term));
      return textMatches && (statusFilter === "all" || lesson.status === statusFilter);
    });
  }, [lessons, query, statusFilter]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEdit(lesson: Lesson) {
    setEditingId(lesson.id);
    setForm({
      type: lesson.type,
      title: lesson.title,
      starts_at: localDateTime(lesson.starts_at),
      ends_at: lesson.ends_at ? localDateTime(lesson.ends_at) : "",
      instructor_id: lesson.instructor_id ?? "",
      private_member_id: lesson.private_member_id ?? "",
      notes: lesson.notes ?? "",
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.title.trim() || !form.starts_at) {
      setError("Ders adı ve başlangıç zamanı zorunludur.");
      return;
    }
    if (form.type === "private" && !form.private_member_id) {
      setError("Özel ders için bir üye seçin.");
      return;
    }
    const startsAt = new Date(form.starts_at);
    const endsAt = form.ends_at ? new Date(form.ends_at) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))) {
      setError("Bitiş zamanı başlangıçtan sonra olmalıdır.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const payload = {
        type: form.type,
        title: form.title.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        instructor_id: form.instructor_id || null,
        private_member_id: form.type === "private" ? form.private_member_id : null,
        notes: form.notes.trim() || null,
      };
      const result = editingId
        ? await supabase.from("lessons").update(payload).eq("id", editingId)
        : await supabase.from("lessons").insert({ ...payload, status: "scheduled" });
      if (result.error) throw result.error;

      setNotice(editingId ? "Ders bilgileri güncellendi." : "Ders planlandı.");
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ders kaydedilemedi. Yetkinizi kontrol edin.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(lesson: Lesson, nextStatus: Lesson["status"]) {
    if (nextStatus === lesson.status) return;
    if (lesson.status === "completed") {
      setError("Tamamlanan dersin durumu değiştirilemez; krediler işlenmiş olabilir.");
      return;
    }
    if (nextStatus === "completed" && !window.confirm("Dersi tamamlandı olarak işaretlemek, uygun aboneliklerden kredileri otomatik düşürür. Devam edilsin mi?")) {
      return;
    }
    if ((nextStatus === "cancelled" || nextStatus === "postponed") && !window.confirm("Ders durumu güncellensin mi? İptal veya erteleme kredi tüketimini engeller.")) return;

    setPendingId(lesson.id);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from("lessons").update({ status: nextStatus }).eq("id", lesson.id);
      if (updateError) throw updateError;
      setNotice(`Ders durumu “${statusLabels[nextStatus]}” olarak güncellendi.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ders durumu değiştirilemedi.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">PLANLAMA</p><h1>Ders takvimi</h1><p className="dashboard-subtitle">Özel ve grup derslerini planlayın, tamamlanma durumunu yönetin.</p></div>
        {canManage && <button className="primary-action" type="button" onClick={openCreate}><CirclePlus size={17} /> Ders planla</button>}
      </div>

      <div className="stat-strip">
        <div><span>Toplam ders</span><strong>{lessons.length}</strong></div>
        <div><span>Planlandı</span><strong>{lessons.filter((lesson) => lesson.status === "scheduled").length}</strong></div>
        <div><span>Tamamlandı</span><strong>{lessons.filter((lesson) => lesson.status === "completed").length}</strong></div>
      </div>
      {(error || notice || loadError) && <div className={error || loadError ? "notice error page-notice" : "notice success page-notice"} role={error || loadError ? "alert" : "status"}>{error || (loadError ? "Dersler yüklenemedi. RLS politikalarını kontrol edin." : notice)}</div>}

      {canManage && formOpen && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2>{editingId ? "Dersi düzenle" : "Yeni ders planla"}</h2><p>Ders tamamlanınca kredi tüketimi veritabanında yönetilir.</p></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Formu kapat"><X size={18} /></button></div>
          <form className="record-form" onSubmit={handleSubmit}>
            <div className="field-grid">
              <label>Ders türü *<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LessonForm["type"], title: e.target.value === "group" ? "Grup dersi" : "Özel ders", private_member_id: "" })}><option value="group">Grup dersi</option><option value="private">Özel ders</option></select></label>
              <label>Ders adı *<input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Dersin adı" /></label>
              <label>Başlangıç *<input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
              <label>Bitiş<input type="datetime-local" value={form.ends_at} min={form.starts_at || undefined} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></label>
              <label>Eğitmen<select value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}><option value="">Eğitmen seçilmedi</option>{instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.full_name || instructor.role}</option>)}</select></label>
              {form.type === "private" && <label>Üye *<select required value={form.private_member_id} onChange={(e) => setForm({ ...form, private_member_id: e.target.value })}><option value="">Üye seçin</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>}
              <label className="field-wide">Notlar<textarea rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="İsteğe bağlı ders notları" /></label>
            </div>
            <div className="form-actions"><button className="secondary-action" type="button" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : editingId ? "Değişiklikleri kaydet" : "Dersi planla"}</button></div>
          </form>
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>Ders listesi</h2><p>{filtered.length} kayıt gösteriliyor</p></div><div className="toolbar-filters"><label className="search-box"><CalendarDays size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ders ara…" aria-label="Ders ara" /></label><select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Duruma göre filtrele"><option value="all">Tüm durumlar</option><option value="scheduled">Planlandı</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option><option value="postponed">Ertelendi</option></select></div></div>
        {lessons.length === 0 && !loadError ? (
          <div className="empty-state"><span className="empty-icon"><CalendarDays size={24} /></span><h3>Henüz ders planlanmadı</h3><p>İlk dersi oluşturarak takviminizi hazırlayın.</p>{canManage && <button className="secondary-action" type="button" onClick={openCreate}>Ders planla</button>}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state compact"><h3>Sonuç bulunamadı</h3><p>Arama veya filtre ölçütünü değiştirin.</p></div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Ders</th><th>Tarih ve saat</th><th>Tür</th><th>Durum</th><th className="actions-head">İşlem</th></tr></thead>
            <tbody>{filtered.map((lesson) => (
              <tr key={lesson.id}>
                <td><div className="lesson-cell"><span className="person-avatar"><UserRound size={16} /></span><span><strong>{lesson.title}</strong><small>{lesson.type === "private" ? members.find((m) => m.id === lesson.private_member_id)?.full_name ?? "Üye kaydı bulunamadı" : "Grup dersi"}{lesson.notes ? ` · ${lesson.notes}` : ""}</small></span></div></td>
                <td><div className="date-cell"><strong>{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(lesson.starts_at))}</strong><span><Clock3 size={13} />{new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(lesson.starts_at))}{lesson.ends_at ? ` – ${new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(lesson.ends_at))}` : ""}</span></div></td>
                <td><span className="type-pill">{lesson.type === "private" ? "Özel" : "Grup"}</span></td>
                <td><span className={`status-pill lesson-${lesson.status}`}><span />{statusLabels[lesson.status]}</span></td>
                <td><div className="row-actions">{canManage && lesson.status !== "completed" && <><button className="icon-button" type="button" onClick={() => openEdit(lesson)} aria-label="Dersi düzenle"><Edit2 size={16} /></button><select className="status-select" disabled={pendingId === lesson.id} value={lesson.status} onChange={(e) => void changeStatus(lesson, e.target.value as Lesson["status"])} aria-label="Ders durumunu değiştir"><option value="scheduled">Planlandı</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option><option value="postponed">Ertelendi</option></select></>}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
