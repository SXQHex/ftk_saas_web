import { requireRole } from "@/lib/supabase/access";
import { MembersManager } from "./members-manager";

export const metadata = { title: "Üyeler | FTK Studio" };

export default async function MembersPage() {
  const { supabase } = await requireRole(["admin"]);
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, phone, email, notes, is_active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="dashboard-content">
      <MembersManager members={data ?? []} loadError={Boolean(error)} />
    </div>
  );
}
