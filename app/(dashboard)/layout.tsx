import { LanguageAppShell } from "@/components/app-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LanguageAppShell>{children}</LanguageAppShell>;
}
