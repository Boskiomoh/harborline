import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type Role } from "@/lib/roles";

export type Viewer = {
  id: string;
  fullName: string;
  role: Role;
  email: string | null;
};

// Verified identity (getClaims validates the JWT) plus the role from profiles.
// Cached per request so layouts and pages can both call it.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

export async function requireRole(allowed: Role[]) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!allowed.includes(viewer.role)) redirect(homeForRole(viewer.role));
  return viewer;
}
