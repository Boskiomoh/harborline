"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { homeForRole, type Role } from "@/lib/roles";
import { safeNext } from "@/lib/safe-next";

// Shared by the three public demo accounts; published in the README.
const DEMO_PASSWORD = "harborline-demo-2026";

export type SignInState =
  | {
      error?: "invalid" | "generic";
      fieldErrors?: { email?: boolean; password?: boolean };
      email?: string;
    }
  | undefined;

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

async function signInAndRoute(email: string, password: string, next: string | null): Promise<SignInState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: error?.code === "invalid_credentials" ? "invalid" : "generic", email };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

  redirect(next ?? homeForRole(profile?.role ?? "customer"));
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: { email: Boolean(fields.email), password: Boolean(fields.password) },
      email: typeof formData.get("email") === "string" ? String(formData.get("email")) : undefined,
    };
  }

  return signInAndRoute(parsed.data.email, parsed.data.password, safeNext(formData.get("next")));
}

export async function signInAsDemo(role: Role, formData: FormData) {
  const account = DEMO_ACCOUNTS[role];
  const result = await signInAndRoute(account.email, DEMO_PASSWORD, safeNext(formData.get("next")));
  if (result?.error) {
    redirect(`/sign-in?error=${result.error}`);
  }
}

export async function signOut() {
  const supabase = await createClient();
  // Local: the default global sign-out would end every visitor's session on a shared demo account.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
