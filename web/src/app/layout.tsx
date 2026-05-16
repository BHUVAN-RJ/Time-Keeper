import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Time Keeper",
  description: "Personal time tracking and productivity",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon",
    apple: "/icon",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Time Keeper",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
