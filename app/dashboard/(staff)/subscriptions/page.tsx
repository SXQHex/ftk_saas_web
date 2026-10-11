import { requireRole } from "@/lib/supabase/access";
import { SubscriptionsManager } from "./subscriptions-manager";

export const metadata = { title: "Abonelikler | FTK Studio" };

export default async function SubscriptionsPage() {
  const { supabase, userId } = await requireRole(["admin"]);
  const [subscriptionsResult, membersResult] = await Promise.all([
    supabase.from("subscriptions").select("id, member_id, type, starts_on, ends_on, credits_purchased, credits_remaining, amount, payment_status, paid_at, status, notes").order("created_at", { ascending: false }).limit(500),
    supabase.from("members").select("id, full_name, is_active").order("full_name"),
  ]);

  return (
    <div className="dashboard-content">
      <SubscriptionsManager
        subscriptions={subscriptionsResult.data ?? []}
        members={membersResult.data ?? []}
        userId={userId}
        loadError={Boolean(subscriptionsResult.error || membersResult.error)}
      />
    </div>
  );
}
