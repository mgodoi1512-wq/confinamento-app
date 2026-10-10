"use client";

import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  return (
    <html lang="pt-BR">
      <body>
        {isLoginPage ? (
          children
        ) : (
          <div className="flex">
            <Sidebar />

            <main className="flex-1">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}