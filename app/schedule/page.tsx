"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SchedulePage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.schedule")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="week" className="w-full">
            <TabsList>
              <TabsTrigger value="week">{t("tabs.week")}</TabsTrigger>
              <TabsTrigger value="day">{t("tabs.day")}</TabsTrigger>
            </TabsList>
            <TabsContent value="week" className="mt-4 text-sm text-muted-foreground">
              Weekly schedule view will appear here.
            </TabsContent>
            <TabsContent value="day" className="mt-4 text-sm text-muted-foreground">
              Daily schedule view will appear here.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
