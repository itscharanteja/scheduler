"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page failed to load. You can try again or navigate to another section.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error.message}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={reset} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
