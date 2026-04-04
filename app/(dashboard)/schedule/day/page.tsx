import { redirect } from "next/navigation";

export default function DaySchedulePage() {
  redirect("/schedule?tab=day");
}
