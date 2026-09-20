import type { Role } from "@/lib/roles";

// Public demo identities. Passwords live only in the server action that signs in.
export const DEMO_ACCOUNTS: Record<Role, { email: string; name: string }> = {
  customer: { email: "customer@harborline.app", name: "Maya Okafor" },
  agent: { email: "agent@harborline.app", name: "Tomás Reyes" },
  admin: { email: "admin@harborline.app", name: "Priya Raman" },
};

export const DEMO_ROLES: Role[] = ["customer", "agent", "admin"];
