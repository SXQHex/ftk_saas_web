"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/access";
import { type ActionResult, dbErrorMessage, fail, ok, parseInput } from "./result";

const uuid = z.string().uuid();
const label = z.string().trim().min(1).max(160);
const resourceSchema = z.object({ name: label });
const centerSchema = z.object({ organization_id: uuid, name: label, address: z.string().trim().max(500).nullable() });
const roomSchema = z.object({ center_id: uuid, name: z.string().trim().min(1).max(120), capacity: z.number().int().min(1).max(500) });
const requestSchema = z.object({
  center_id: uuid,
  room_id: uuid,
  session_type: z.enum(["private", "group"]),
  title: label,
  private_member_id: uuid.nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  expected_attendees: z.number().int().min(1).max(500),
  notes: z.string().trim().max(2000).nullable(),
}).superRefine((v, ctx) => {
  if (Date.parse(v.ends_at) <= Date.parse(v.starts_at)) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Bitiş saati başlangıçtan sonra olmalı." });
  if (v.session_type === "private" && !v.private_member_id) ctx.addIssue({ code: "custom", path: ["private_member_id"], message: "Özel ders için üye seçin." });
  if (v.session_type === "private" && v.expected_attendees !== 1) ctx.addIssue({ code: "custom", path: ["expected_attendees"], message: "Özel ders için katılımcı sayısı 1 olmalıdır." });
  if (v.session_type === "group" && v.private_member_id) ctx.addIssue({ code: "custom", path: ["private_member_id"], message: "Grup dersinde özel üye seçilemez." });
});

function refresh() {
  revalidatePath("/dashboard/session-requests");
  revalidatePath("/dashboard/lessons");
}

export async function createOrganization(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["admin"]);
  const parsed = parseInput(resourceSchema, input);
  if (parsed.failure) return parsed.failure;
  const slug = parsed.data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return fail("Organizasyon adı geçerli bir kısa ad üretemiyor.");
  const { error } = await supabase.from("organizations").insert({ name: parsed.data.name, slug, created_by: userId });
  if (error) return fail(dbErrorMessage(error, "Organizasyon oluşturulamadı."));
  refresh();
  return ok("Organizasyon oluşturuldu.");
}

export async function createCenter(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(centerSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.from("centers").insert(parsed.data);
  if (error) return fail(dbErrorMessage(error, "Merkez oluşturulamadı."));
  refresh();
  return ok("Merkez oluşturuldu.");
}

export async function createRoom(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(roomSchema, input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.from("rooms").insert(parsed.data);
  if (error) return fail(dbErrorMessage(error, "Oda oluşturulamadı."));
  refresh();
  return ok("Oda oluşturuldu.");
}

export async function createSessionRequest(input: unknown): Promise<ActionResult> {
  const { supabase, userId } = await requireRole(["instructor"]);
  const parsed = parseInput(requestSchema, input);
  if (parsed.failure) return parsed.failure;
  const { data: center, error: centerError } = await supabase.from("centers")
    .select("id, organization_id, is_active").eq("id", parsed.data.center_id).maybeSingle();
  if (centerError || !center || !center.is_active) return fail("Merkez bulunamadı veya kullanılamıyor.");
  if (parsed.data.room_id) {
    const { data: room } = await supabase.from("rooms").select("id").eq("id", parsed.data.room_id)
      .eq("center_id", center.id).eq("is_active", true).maybeSingle();
    if (!room) return fail("Seçilen oda bu merkeze ait değil veya kullanılamıyor.");
  }
  const { error } = await supabase.from("session_requests").insert({
    ...parsed.data,
    organization_id: center.organization_id,
    instructor_id: userId,
    requested_by: userId,
    status: "pending",
  });
  if (error) return fail(dbErrorMessage(error, "Seans talebi oluşturulamadı."));
  refresh();
  return ok("Talep yöneticiye iletildi. Onaylanana kadar oda rezerve edilmez.");
}

export async function reviewSessionRequest(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireRole(["admin"]);
  const parsed = parseInput(z.object({ id: uuid, approve: z.boolean(), note: z.string().trim().max(500).nullable() }), input);
  if (parsed.failure) return parsed.failure;
  const { error } = await supabase.rpc("review_session_request", {
    p_request_id: parsed.data.id,
    p_approve: parsed.data.approve,
    p_review_note: parsed.data.note,
  });
  if (error) return fail(dbErrorMessage(error, "Talep değerlendirilemedi. Oda veya eğitmen çakışmasını kontrol edin."));
  refresh();
  return ok(parsed.data.approve ? "Talep onaylandı ve seans rezerve edildi." : "Talep reddedildi.");
}
