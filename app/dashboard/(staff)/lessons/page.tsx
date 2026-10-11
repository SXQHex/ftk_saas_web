import { requireRole } from "@/lib/supabase/access";
import { LessonsManager } from "./lessons-manager";

export const metadata = { title: "Ders Takvimi | FTK Studio" };

export default async function LessonsPage() {
  const { supabase, profile } = await requireRole(["admin", "instructor"]);
  const [lessonsResult, membersResult, profilesResult] = await Promise.all([
    supabase.from("lessons").select("id, type, title, starts_at, ends_at, status, instructor_id, private_member_id, notes").order("starts_at", { ascending: false }).limit(200),
    supabase.from("members").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("profiles").select("id, full_name, role").in("role", ["instructor", "admin"]).order("full_name"),
  ]);

  return (
    <div className="dashboard-content">
      <LessonsManager
        canManage={profile.role === "admin"}
        lessons={lessonsResult.data ?? []}
        members={membersResult.data ?? []}
        instructors={profilesResult.data ?? []}
        loadError={Boolean(lessonsResult.error)}
      />
    </div>
  );
}
