import { LanguageAppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LanguageAppShell>{children}</LanguageAppShell>;
}
