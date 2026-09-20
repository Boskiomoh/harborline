import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/auth";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const viewer = await requireRole(["customer"]);
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
