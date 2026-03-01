"use client";

import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type React from "react";
import { Calendar, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { addDays, format, getISOWeek, setISOWeek, setISOWeekYear, startOfWeek } from "date-fns";

function parseWeekParam(weekParam: string | null): Date {
  const match = weekParam?.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeek(new Date(), { weekStartsOn: 1 });
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const withYear = setISOWeekYear(new Date(), year);
  const withWeek = setISOWeek(withYear, week);
  return startOfWeek(withWeek, { weekStartsOn: 1 });
}

function getPageInfo(pathname: string, t: (key: any) => string) {
  if (pathname.startsWith("/schedule") || pathname.startsWith("/dashboard/schedule")) {
    return { title: t("nav.schedule"), showPublish: true };
  }
  if (pathname.startsWith("/employees") || pathname.startsWith("/dashboard/employees")) {
    return { title: t("nav.employees"), showPublish: false };
  }
  if (pathname.startsWith("/ai-agent") || pathname.startsWith("/dashboard/ai-agent")) {
    return { title: t("nav.aiAgent"), showPublish: false };
  }
  return { title: t("nav.dashboard"), showPublish: false };
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { title, showPublish } = getPageInfo(pathname, t);

  const sidebarWeekDate = (() => {
    const dateParam = searchParams.get("date");
    if (pathname.startsWith("/dashboard/schedule/day") && dateParam) {
      const d = new Date(`${dateParam}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }
    const weekParam = searchParams.get("week");
    if (weekParam) return parseWeekParam(weekParam);
    return new Date();
  })();
  const sidebarWeekStart = startOfWeek(sidebarWeekDate, { weekStartsOn: 1 });
  const sidebarWeekEnd = addDays(sidebarWeekStart, 6);
  const sidebarWeekLabel = `Week ${getISOWeek(sidebarWeekStart)} • ${format(
    sidebarWeekStart,
    "MMM d"
  )}–${format(sidebarWeekEnd, "d")}`;

  const navItems = [
    {
      href: "/dashboard/schedule",
      label: t("nav.schedule"),
      icon: Calendar,
    },
    {
      href: "/dashboard/employees",
      label: t("nav.employees"),
      icon: Users,
    },
    {
      href: "/dashboard/ai-agent",
      label: t("nav.aiAgent"),
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] flex transition-colors duration-300">
      {/* Sidebar */}
      <aside className="flex h-screen w-20 flex-col border-r border-[#2a2a2a] bg-[#141414] transition-all duration-300 lg:w-[240px]">
        <div className="flex items-center justify-center gap-2 px-2 py-4 border-b border-[#2a2a2a] lg:justify-start lg:px-5">
          <div className="hidden text-2xl font-mono tracking-[0.3em] lg:block">YORK</div>
          <span aria-hidden="true">🍔</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 text-sm lg:px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-center gap-3 rounded-md px-3 py-2 text-[#888888] hover:bg-[#1c1c1c] lg:justify-start"
                style={
                  isActive
                    ? {
                        borderLeft: "3px solid #e8b84b",
                        color: "#e8b84b",
                        paddingLeft: "0.5rem",
                      }
                    : { borderLeft: "3px solid transparent" }
                }
              >
                <Icon
                  className="h-4 w-4"
                  color={isActive ? "#e8b84b" : "#888888"}
                />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 pb-4 pt-2 border-t border-[#2a2a2a] text-xs text-[#888888] space-y-2 lg:px-4">
          <div className="hidden text-[11px] uppercase tracking-[0.2em] text-[#555555] lg:block">
            CURRENT WEEK
          </div>
          <div className="hidden text-sm text-[#f0f0f0] lg:block">
            {sidebarWeekLabel}
          </div>

          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "sv" : "en")}
            className="mt-3 flex w-full items-center justify-center rounded-md border border-[#2a2a2a] bg-[#141414] px-2 py-2 text-xs text-[#f0f0f0] hover:bg-[#1c1c1c] lg:justify-between lg:px-3"
          >
            <span className="hidden lg:inline">
              {lang === "en" ? "Language: EN" : "Språk: SV"}
            </span>
            <span className="text-[#e8b84b]">
              {lang === "en" ? "SV" : "EN"}
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 bg-[#0f0f0f]" style={{ marginLeft: 0 }}>
        <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#0f0f0f] px-6 py-4">
          <div className="space-y-1">
            <h1 className="text-lg font-medium text-[#f0f0f0] font-mono">
              {title}
            </h1>
            <div className="inline-flex items-center rounded-full border border-[#2a2a2a] bg-[#141414] px-3 py-1 text-xs text-[#888888]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8b84b] mr-2" />
              <span>Mister York — Göteborg</span>
            </div>
          </div>

          {showPublish && (
            <button
              type="button"
              onClick={() => toast.success("Schedule published")}
              className="rounded-md bg-[#e8b84b] px-4 py-2 text-xs font-semibold text-black shadow-sm hover:bg-[#f0c75c]"
            >
              Publish Week
            </button>
          )}
        </header>

        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

export function LanguageAppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ShellLayout>{children}</ShellLayout>
    </LanguageProvider>
  );
}
