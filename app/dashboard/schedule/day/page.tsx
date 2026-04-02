import { redirect } from "next/navigation";

export default function DaySchedulePage() {
  redirect("/dashboard/schedule?tab=day");
}
