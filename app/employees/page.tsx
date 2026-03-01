"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EmployeesPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("nav.employees")}</CardTitle>
          <Button size="sm">{t("button.newEmployee")}</Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("nav.employees")} list will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
