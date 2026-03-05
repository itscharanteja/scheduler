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
  title: "Skift",
  description: "Skift – premium scheduling for teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${dmMono.variable} antialiased bg-background text-foreground transition-colors duration-300`}
      >
        <LanguageAppShell>{children}</LanguageAppShell>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(255,255,255,0.45)",
              color: "#0a0a0a",
              backdropFilter: "blur(16px)",
            },
          }}
        />
      </body>
    </html>
  );
}
