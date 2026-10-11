import { useState } from "react";
import { Outlet } from "react-router-dom";

import { BottomNav } from "@/components/app/bottom-nav";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFarm } from "@/hooks/use-farm";

/** Layout autenticado: sidebar no desktop, drawer + bottom nav no mobile. */
export const AppShell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: farm } = useFarm();

  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      <SidebarNav className="sticky top-0 hidden lg:flex" />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMenuOpen(false)} className="w-full border-0" />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar farmName={farm?.name ?? undefined} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6 lg:px-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
};
