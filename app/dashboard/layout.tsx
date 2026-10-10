import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || typeof authData?.claims?.sub !== "string") {
    redirect("/login");
  }

  const userId = authData.claims.sub;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (
    <DashboardShell
      email={typeof authData.claims.email === "string" ? authData.claims.email : ""}
      roleLabel={profile?.role ? String(profile.role) : "Rol doğrulanamadı"}
    >
      {children}
    </DashboardShell>
  );
}
