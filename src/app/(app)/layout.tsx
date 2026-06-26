import { requireUser } from "@/lib/auth/session";
import { getBranding } from "@/server/settings";
import { AppShell } from "@/components/app-shell/shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, branding] = await Promise.all([requireUser(), getBranding()]);
  return (
    <AppShell email={user.email} branding={branding}>
      {children}
    </AppShell>
  );
}
