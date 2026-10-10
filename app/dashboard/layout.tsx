import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "./dashboard-shell";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || typeof authData?.claims?.sub !== "string") {
    redirect("/login");
  }

  const userId = authData.claims.sub;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const roleLabel = !profileError && profile?.role
    ? String(profile.role)
    : "Rol doğrulanamadı";

  return (
    <DashboardShell
      email={typeof authData.claims.email === "string" ? authData.claims.email : ""}
      roleLabel={roleLabel}
    >
      {children}
    </DashboardShell>
  );
}
