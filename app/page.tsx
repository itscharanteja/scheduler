"use client";

import { useLanguage } from "@/context/LanguageContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("app.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t("nav.schedule")} and {t("nav.employees")} management app.
          </p>
          <div className="flex gap-3">
            <Button size="sm" asChild>
              <Link href="/dashboard">{t("nav.dashboard")}</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/schedule">{t("nav.schedule")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
