import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "instructor" | "student";

export async function requireRole(allowedRoles: AppRole[]) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (authError || typeof userId !== "string") {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/login?error=profile");
  }

  if (!allowedRoles.includes(profile.role as AppRole)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    userId,
    email: typeof authData?.claims?.email === "string" ? authData.claims.email : "",
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? "",
      role: profile.role as AppRole,
    },
  };
}
