import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { bottomNavItems } from "@/components/app/nav-config";
import { cn } from "@/lib/utils";

export const BottomNav = () => {
  const { t } = useTranslation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {bottomNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
              isActive && "text-primary",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-md transition-colors",
                  isActive && "bg-primary/10",
                )}
              >
                <item.icon className="size-4" />
              </span>
              {t(item.labelKey)}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
