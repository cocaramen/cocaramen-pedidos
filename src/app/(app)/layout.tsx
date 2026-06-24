import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell/shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <AppShell email={user.email}>{children}</AppShell>;
}
