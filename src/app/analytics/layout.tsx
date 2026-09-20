import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/auth";

export default async function AnalyticsLayout({ children }: LayoutProps<"/analytics">) {
  const viewer = await requireRole(["admin"]);
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
