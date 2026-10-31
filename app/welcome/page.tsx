import type { Metadata } from "next";
import WelcomePage from "./welcome-page";

export const metadata: Metadata = {
  title: "Skift — Your restaurant. One AI workspace.",
  description:
    "A shared workspace for restaurant teams: scheduling, communication, tasks, attendance, alerts, achievements, and insights. Explore Skift and its vision for AI assistance across the working day.",
};

export default function Page() {
  return <WelcomePage />;
}
