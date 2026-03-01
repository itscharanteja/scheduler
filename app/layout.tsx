import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { LanguageAppShell } from "@/components/app-shell";
import { Toaster } from "sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Scheduling app for employees and shifts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${dmMono.variable} antialiased bg-[#0a0a0a] text-[#f0f0f0] transition-colors duration-300`}
      >
        <LanguageAppShell>{children}</LanguageAppShell>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#141414",
              border: "1px solid #2a2a2a",
              color: "#f0f0f0",
            },
          }}
        />
      </body>
    </html>
  );
}
