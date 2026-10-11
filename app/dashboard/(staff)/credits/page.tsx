import { requireRole } from "@/lib/supabase/access";
import { CreditsManager } from "./credits-manager";

export const metadata = { title: "Kredi Hareketleri | FTK Studio" };

export default async function CreditsPage() {
  const { supabase, userId } = await requireRole(["admin"]);
  const [transactionsResult, subscriptionsResult, membersResult] = await Promise.all([
    supabase.from("credit_transactions").select("id, subscription_id, member_id, lesson_id, amount, reason, note, created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("subscriptions").select("id, member_id, type, credits_purchased, credits_remaining, status").order("created_at", { ascending: false }),
    supabase.from("members").select("id, full_name").order("full_name"),
  ]);

  return (
    <div className="dashboard-content">
      <CreditsManager
        transactions={transactionsResult.data ?? []}
        subscriptions={subscriptionsResult.data ?? []}
        members={membersResult.data ?? []}
        userId={userId}
        loadError={Boolean(transactionsResult.error || subscriptionsResult.error || membersResult.error)}
      />
    </div>
  );
}
