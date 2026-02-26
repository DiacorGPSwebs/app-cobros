import type { Metadata } from "next";
import "./globals.css";
import { Search, FileText, Receipt, LayoutDashboard, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: "GPS Collection Center",
  description: "Management system for GPS subscriptions and collections",
};

import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen">
        <div className="flex min-h-screen bg-background">
          <Sidebar />

          <main className="flex-1 flex flex-col">
            <header className="h-16 border-b border-border flex items-center px-8 bg-card/30 backdrop-blur-sm">
              <h2 className="text-lg font-semibold">Panel de Control</h2>
            </header>
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
