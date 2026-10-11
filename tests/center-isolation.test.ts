import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261011210000_complete_center_isolation.sql", "utf8");
const tenancy = readFileSync("supabase/migrations/20261011200000_center_level_tenancy.sql", "utf8");
const booking = readFileSync("supabase/migrations/20261011190000_session_rooms_and_requests.sql", "utf8");

describe("center-level isolation migration contract", () => {
  it("limits instructor member lookups to members in assigned scheduled/completed sessions", () => {
    expect(migration).toContain("app_private.instructor_can_access_member_center(p_center_id, m.id)");
    expect(migration).toContain("l.status in ('scheduled'::public.lesson_status, 'completed'::public.lesson_status)");
    expect(migration).toContain("a.center_id = l.center_id");
  });

  it("does not let a pending private request grant member-data access", () => {
    const policy = migration.match(/create policy members_read_own_or_assigned_session[\s\S]*?\);/i)?.[0] ?? "";
    expect(policy).toContain("instructor_can_access_member_center(center_id, id)");
    expect(policy).not.toContain("session_requests");
  });

  it("enforces instructor member authorization inside the database RPC", () => {
    const rpc = migration.match(/create or replace function public\.create_session_request\([\s\S]*?\$function\$;/i)?.[0] ?? "";
    expect(rpc).toContain("instructor_can_access_member_center(p_center_id, p_private_member_id)");
    expect(rpc).toContain("security definer");
    expect(rpc).toContain("revoke all on function public.create_session_request");
  });

  it("keeps center isolation on members, subscriptions, lessons, attendance and credits", () => {
    for (const table of ["members", "subscriptions", "lessons", "attendance", "credit_transactions"]) {
      expect(tenancy).toContain(`app_private.is_center_admin(center_id)`);
      expect(tenancy).toContain(`public.${table}`);
    }
    expect(tenancy).toContain("subscriptions_member_center_fkey");
    expect(tenancy).toContain("attendance_lesson_center_fkey");
    expect(tenancy).toContain("credit_transactions_subscription_center_fkey");
  });

  it("filters credit consumption to the lesson's center", () => {
    const fn = tenancy.match(/create or replace function app_private\.consume_lesson_credit[\s\S]*?\$function\$;/i)?.[0] ?? "";
    expect(fn).toContain("where center_id = v_lesson.center_id and member_id = v_lesson.private_member_id");
    expect(fn).toContain("where center_id = v_lesson.center_id and type = 'group_4_weeks'");
  });

  it("keeps overlapping requests as proposals and prevents overlapping confirmed bookings", () => {
    expect(booking).toContain("where status = 'pending'");
    expect(booking).toContain("exclude using gist (room_id with =");
    expect(booking).toContain("exclude using gist (instructor_id with =");
  });
});
