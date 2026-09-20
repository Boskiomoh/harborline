import type { Enums } from "@/lib/supabase/database.types";

export type Role = Enums<"user_role">;

export function homeForRole(role: Role) {
  switch (role) {
    case "customer":
      return "/portal";
    case "agent":
      return "/inbox";
    case "admin":
      return "/analytics";
  }
}

export function isStaff(role: Role) {
  return role === "agent" || role === "admin";
}
