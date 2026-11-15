import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { InlineScript } from "@/components/inline-script";
import { AdminTimeZoneProvider } from "@/components/admin-timezone";
import { TZ_COOKIE, resolveTimeZone } from "@/lib/admin-timezone";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HunterX Admin — Habit Gamification Dashboard",
  description: "Admin portal for managing users, tasks, and progression in the HunterX habit gamification ecosystem.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The admin's zone (saved by AdminTimeZoneProvider), so server-rendered
  // dates match the browser's.
  const timeZone = resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript
          id="theme-init"
          html={`(function(){try{var t=localStorage.getItem("theme");if(!t){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark"}document.documentElement.setAttribute("data-theme",t);var a=localStorage.getItem("accentColor");if(a&&a!=="violet")document.documentElement.setAttribute("data-accent",a)}catch(e){}})()`}
        />
      </head>
      <body className="min-h-full flex flex-col bg-app text-ink">
        <AdminTimeZoneProvider timeZone={timeZone}>{children}</AdminTimeZoneProvider>
      </body>
    </html>
  );
}
