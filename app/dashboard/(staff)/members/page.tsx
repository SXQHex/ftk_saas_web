import { listMembers, memberStats } from "@/lib/data/members";
import { parsePage, sanitizeSearchTerm, type SearchParams } from "@/lib/data/pagination";
import { requireRole } from "@/lib/supabase/access";
import { MembersManager } from "./members-manager";

export const metadata = { title: "Üyeler | FTK Studio" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { supabase } = await requireRole(["admin"]);
  const params = await searchParams;
  const q = sanitizeSearchTerm(params.q);
  const page = parsePage(params.page);

  const [list, stats] = await Promise.all([listMembers(supabase, { q, page }), memberStats(supabase)]);

  return (
    <div className="dashboard-content">
      <MembersManager
        members={list.rows}
        total={list.total}
        stats={stats}
        query={q}
        page={page}
        loadError={list.error || stats.error}
      />
    </div>
  );
}
