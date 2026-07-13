import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MediCare Hub — Unified Healthcare Platform",
  description: "Connect patients, doctors and hospitals on one secure, AI-powered healthcare platform. Manage appointments, encrypted records, referrals and insights.",
  keywords: ["healthcare", "MediCare", "appointments", "medical records", "AI health", "telemedicine"],
  authors: [{ name: "MediCare Hub" }],
  manifest: "/manifest.json",
  applicationName: "MediCare Hub",
  appleWebApp: {
    capable: true,
    title: "MediCare Hub",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/icon-192.png"],
  },
  openGraph: {
    title: "MediCare Hub — Unified Healthcare Platform",
    description: "AI-powered healthcare for patients, doctors & hospitals.",
    siteName: "MediCare Hub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MediCare Hub",
    description: "AI-powered healthcare for patients, doctors & hospitals.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-center" richColors closeButton />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
