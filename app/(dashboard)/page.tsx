import { cookies } from "next/headers";
import { format, startOfWeek } from "date-fns";
import { getDashboardSnapshot } from "@/lib/services/dashboard-snapshot";
import DashboardClient from "./dashboard-client";
import { LOCATION_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const cookieStore = await cookies();
  const locationCookie = cookieStore.get("skift_location_id")?.value;
  const locationParam =
    typeof searchParams?.location === "string" ? searchParams.location : undefined;
  const locationId = locationParam || locationCookie || LOCATION_ID;

  const todayKey = new Date().toISOString().split("T")[0];
  const weekStart = startOfWeek(new Date(`${todayKey}T00:00:00`), {
    weekStartsOn: 1,
  });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const snapshot = await getDashboardSnapshot(locationId, weekStartStr);

  return (
    <DashboardClient
      initialSnapshot={snapshot}
      initialWeekStartStr={weekStartStr}
    />
  );
}
