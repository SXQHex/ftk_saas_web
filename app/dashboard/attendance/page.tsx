import { requireRole } from "@/lib/supabase/access";
import { AttendanceManager } from "./attendance-manager";

export const metadata = { title: "Yoklama | FTK Studio" };

export default async function AttendancePage() {
  const { supabase, userId } = await requireRole(["admin", "instructor"]);
  const [lessonsResult, membersResult, attendanceResult] = await Promise.all([
    supabase.from("lessons").select("id, type, title, starts_at, status").order("starts_at", { ascending: false }).limit(300),
    supabase.from("members").select("id, full_name, phone, email, is_active").order("full_name"),
    supabase.from("attendance").select("id, lesson_id, member_id, attended, checked_in_at, notes").order("checked_in_at", { ascending: false }).limit(500),
  ]);

  return (
    <div className="dashboard-content">
      <AttendanceManager
        lessons={lessonsResult.data ?? []}
        members={membersResult.data ?? []}
        attendance={attendanceResult.data ?? []}
        userId={userId}
        loadError={Boolean(lessonsResult.error || membersResult.error || attendanceResult.error)}
      />
    </div>
  );
}
