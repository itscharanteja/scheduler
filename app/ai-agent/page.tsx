"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AIAgentPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.aiAgent")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder={t("placeholder.aiPrompt")} />
          <Button size="sm">{t("button.submit")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
