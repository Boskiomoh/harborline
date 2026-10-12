import AppShell from "@/components/app/app-shell";
import { requireRole } from "@/lib/auth";

const PortalLayout = async ({ children }: LayoutProps<"/portal">) => {
  const viewer = await requireRole(["customer"]);

  return <AppShell viewer={viewer}>{children}</AppShell>;
};

export default PortalLayout;
