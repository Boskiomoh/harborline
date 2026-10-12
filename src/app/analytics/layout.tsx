import AppShell from "@/components/app/app-shell";
import { requireRole } from "@/lib/auth";

const AnalyticsLayout = async ({ children }: LayoutProps<"/analytics">) => {
  const viewer = await requireRole(["admin"]);

  return <AppShell viewer={viewer}>{children}</AppShell>;
};

export default AnalyticsLayout;
