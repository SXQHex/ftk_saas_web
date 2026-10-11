"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, CalendarClock, Check, DoorOpen, Plus, X } from "lucide-react";
import { PageNotice } from "@/components/page-notice";
import { useActionRunner } from "@/components/use-action-runner";
import {
  createCenter, createOrganization, createRoom, createSessionRequest, listRequestableMembers, reviewSessionRequest,
} from "@/lib/actions/session-requests";
import type { CenterOption, OrganizationOption, RoomOption, SessionRequestRow } from "@/lib/data/session-requests";

function toIso(value: string) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
const statusText: Record<string, string> = { pending: "Onay bekliyor", approved: "Onaylandı", rejected: "Reddedildi", cancelled: "İptal" };

export function SessionRequestsManager({
  isAdmin, organizations, centers, rooms, requests, loadError,
}: {
  isAdmin: boolean;
  organizations: OrganizationOption[];
  centers: CenterOption[];
  rooms: RoomOption[];
  requests: SessionRequestRow[];
  loadError: boolean;
}) {
  const [orgName, setOrgName] = useState("");
  const [centerOrg, setCenterOrg] = useState(organizations[0]?.id ?? "");
  const [centerName, setCenterName] = useState("");
  const [centerAddress, setCenterAddress] = useState("");
  const [roomCenter, setRoomCenter] = useState(centers[0]?.id ?? "");
  const [roomName, setRoomName] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [sessionType, setSessionType] = useState<"private" | "group">("private");
  const [centerId, setCenterId] = useState(centers[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("Özel ders");
  const [memberId, setMemberId] = useState("");
  const [requestMembers, setRequestMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [attendees, setAttendees] = useState("1");
  const [notes, setNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const { busy, error, notice, setError, reset, run } = useActionRunner();

  useEffect(() => {
    let active = true;
    setRequestMembers([]);
    setMemberId("");
    setMemberLoadError("");
    if (isAdmin || sessionType !== "private" || !centerId) {
      setMemberLoading(false);
      return () => { active = false; };
    }
    setMemberLoading(true);
    void listRequestableMembers(centerId).then((result) => {
      if (!active) return;
      if (result.ok) setRequestMembers(result.rows);
      else setMemberLoadError(result.error);
    }).finally(() => {
      if (active) setMemberLoading(false);
    });
    return () => { active = false; };
  }, [centerId, sessionType, isAdmin]);

  const centerRooms = rooms.filter((room) => room.center_id === centerId);
  const roomSetupRooms = rooms.filter((room) => room.center_id === roomCenter);

  async function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => createOrganization({ name: orgName }), { onSuccess: () => setOrgName("") });
  }
  async function submitCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => createCenter({ organization_id: centerOrg, name: centerName, address: centerAddress || null }), {
      onSuccess: () => { setCenterName(""); setCenterAddress(""); },
    });
  }
  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => createRoom({ center_id: roomCenter, name: roomName, capacity: Number(capacity) }), { onSuccess: () => setRoomName("") });
  }
  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset();
    if (!roomId) { setError("Talep için bir oda seçin."); return; }
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) { setError("Bitiş saati başlangıçtan sonra olmalı."); return; }
    await run(() => createSessionRequest({
      center_id: centerId, room_id: roomId, session_type: sessionType, title,
      private_member_id: sessionType === "private" ? memberId || null : null,
      starts_at: toIso(startsAt), ends_at: toIso(endsAt),
      expected_attendees: Number(attendees), notes: notes || null,
    }), {
      onSuccess: () => { setStartsAt(""); setEndsAt(""); setNotes(""); setMemberId(""); setAttendees(sessionType === "private" ? "1" : "20"); },
    });
  }
  async function review(id: string, approve: boolean) {
    if (approve && !window.confirm("Talep onaylanacak. Oda ve eğitmen uygunluğu veritabanında yeniden kontrol edilecek. Devam edilsin mi?")) return;
    await run(() => reviewSessionRequest({ id, approve, note: reviewNotes[id] || null }), { rowId: id });
  }

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div><p className="eyebrow">SEANS PLANLAMA</p><h1>Seans talepleri ve odalar</h1><p className="dashboard-subtitle">Bekleyen talepler oda rezervasyonu oluşturmaz. Rezervasyon yalnızca yönetici onayında kesinleşir.</p></div>
        <Link className="secondary-action" href="/dashboard/lessons">Ders takvimine dön</Link>
      </div>
      <PageNotice error={error} notice={notice} loadError={loadError} loadErrorMessage="Planlama verileri yüklenemedi. Veritabanı migration'ının uygulanmış olduğunu ve RLS politikalarını kontrol edin." />

      {isAdmin && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2><Building2 size={18} /> Mekân kurulumu</h2><p>Önce organizasyon, ardından merkez ve odaları tanımlayın.</p></div></div>
          <div className="field-grid">
            <form className="record-form" onSubmit={submitOrganization}>
              <label>Yeni organizasyon<input required maxLength={160} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Marka / işletme adı" /></label>
              <button className="secondary-action" disabled={busy || !orgName.trim()}><Plus size={16} /> Organizasyon ekle</button>
            </form>
            <form className="record-form" onSubmit={submitCenter}>
              <label>Organizasyon<select required value={centerOrg} onChange={(e) => setCenterOrg(e.target.value)}><option value="">Organizasyon seçin</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
              <label>Merkez adı<input required maxLength={160} value={centerName} onChange={(e) => setCenterName(e.target.value)} placeholder="Örn. Merkez şube" /></label>
              <label>Adres<input value={centerAddress} onChange={(e) => setCenterAddress(e.target.value)} maxLength={500} placeholder="İsteğe bağlı adres" /></label>
              <button className="secondary-action" disabled={busy || !centerOrg || !centerName.trim()}><Plus size={16} /> Merkez ekle</button>
            </form>
            <form className="record-form" onSubmit={submitRoom}>
              <label>Merkez<select required value={roomCenter} onChange={(e) => setRoomCenter(e.target.value)}><option value="">Merkez seçin</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Oda adı<input required maxLength={120} value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Örn. Salon A" /></label>
              <label>Kapasite<input required type="number" min="1" max="500" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
              <button className="secondary-action" disabled={busy || !roomCenter || !roomName.trim()}><Plus size={16} /> Oda ekle</button>
            </form>
          </div>
          <p className="dashboard-subtitle">Tanımlı: {organizations.length} organizasyon · {centers.length} merkez · {rooms.length} oda</p>
        </section>
      )}

      {!isAdmin && (
        <section className="form-card">
          <div className="form-card-heading"><div><h2><CalendarClock size={18} /> Yeni seans talebi</h2><p>Talep diğer bekleyen talepleri engellemez; seçilen oda yalnızca onayda rezerve edilir.</p></div></div>
          {(!centers.length || !rooms.length) ? <p>Henüz kullanılabilir merkez veya oda tanımlanmamış. Yöneticiden mekânları tanımlamasını isteyin.</p> : (
            <form className="record-form" onSubmit={submitRequest}>
              <div className="field-grid">
                <label>Merkez *<select required value={centerId} onChange={(e) => { setCenterId(e.target.value); setRoomId(""); }}><option value="">Merkez seçin</option>{centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label>İstenen oda *<select required value={roomId} onChange={(e) => setRoomId(e.target.value)}><option value="">Oda seçin</option>{centerRooms.map((r) => <option key={r.id} value={r.id}>{r.name} · kapasite {r.capacity}</option>)}</select></label>
                <label>Seans türü *<select value={sessionType} onChange={(e) => { const type = e.target.value as "private" | "group"; setSessionType(type); setTitle(type === "private" ? "Özel ders" : "Grup dersi"); setAttendees(type === "private" ? "1" : "20"); }}><option value="private">Özel ders</option><option value="group">Grup dersi</option></select></label>
                <label>Seans adı *<input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
                {sessionType === "private" && <label>Üye *<select required disabled={memberLoading || !centerId} value={memberId} onChange={(e) => setMemberId(e.target.value)}><option value="">{memberLoading ? "Üyeler yükleniyor…" : "Üye seçin"}</option>{requestMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>{memberLoadError && <small>{memberLoadError}</small>}</label>}
                <label>Katılımcı sayısı *<input required type="number" min="1" max="500" value={attendees} onChange={(e) => setAttendees(e.target.value)} /></label>
                <label>Başlangıç *<input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
                <label>Bitiş *<input required type="datetime-local" min={startsAt || undefined} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
                <label className="field-wide">Notlar<textarea rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="İsteğe bağlı" /></label>
              </div>
              <div className="form-actions"><button className="primary-action" disabled={busy}>{busy ? "İletiliyor…" : "Onay için talep oluştur"}</button></div>
            </form>
          )}
        </section>
      )}

      <section className="table-card">
        <div className="table-toolbar"><div><h2>{isAdmin ? "Değerlendirilecek ve geçmiş talepler" : "Taleplerim"}</h2><p>{requests.length} kayıt · bekleyen talepler oda ayırmaz</p></div></div>
        {requests.length === 0 ? <div className="empty-state compact"><h3>Henüz talep yok</h3><p>Yeni seans talepleri burada görünür.</p></div> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Seans</th><th>Zaman</th><th>Merkez / oda</th><th>Eğitmen / kapasite</th><th>Durum</th><th>İşlem</th></tr></thead>
            <tbody>{requests.map((r) => (
              <tr key={r.id}>
                <td><div className="lesson-cell"><span className="person-avatar"><DoorOpen size={16} /></span><span><strong>{r.title}</strong><small>{r.session_type === "private" ? `Özel ders · ${r.member_name ?? "Üye"}` : "Grup dersi"}{r.notes ? ` · ${r.notes}` : ""}</small></span></div></td>
                <td><div className="date-cell"><strong>{formatTime(r.starts_at)}</strong><span>– {formatTime(r.ends_at)}</span></div></td>
                <td>{r.center_name}<small className="block">{r.room_name ?? "Oda seçilmedi"}</small></td>
                <td>{r.instructor_name}<small className="block">{r.expected_attendees} kişi</small></td>
                <td><span className={`status-pill lesson-${r.status === "approved" ? "completed" : r.status === "pending" ? "scheduled" : "cancelled"}`}><span />{statusText[r.status] ?? r.status}</span>{r.review_note && <small className="block">{r.review_note}</small>}</td>
                <td>{isAdmin && r.status === "pending" ? <div className="row-actions"><input aria-label="Değerlendirme notu" placeholder="Not (isteğe bağlı)" value={reviewNotes[r.id] ?? ""} onChange={(e) => setReviewNotes({ ...reviewNotes, [r.id]: e.target.value })} /><button className="icon-button" type="button" disabled={busy} onClick={() => void review(r.id, true)} aria-label="Talebi onayla" title="Onayla"><Check size={16} /></button><button className="icon-button" type="button" disabled={busy} onClick={() => void review(r.id, false)} aria-label="Talebi reddet" title="Reddet"><X size={16} /></button></div> : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
