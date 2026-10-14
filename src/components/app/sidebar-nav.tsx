import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { navGroups } from "@/components/app/nav-config";
import { useAuth } from "@/hooks/use-auth";
import { useFarm } from "@/hooks/use-farm";
import { cn } from "@/lib/utils";

export type SidebarNavProps = {
  onNavigate?: () => void;
  className?: string;
};

export const SidebarNav = ({ onNavigate, className }: SidebarNavProps) => {
  const { t } = useTranslation();
  const { isGestor, tenant } = useAuth();
  const { data: farm } = useFarm();

  return (
    <aside
      className={cn(
        "flex h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <>
  <img
    src="/logo-liben-2.png"
    alt="LiBen Agronegócios"
    className="size-20 shrink-0 rounded-md object-contain dark:hidden"
  />

  <img
    src="/logo-liben-dark.png"
    alt="LiBen Agronegócios"
    className="hidden size-20 shrink-0 rounded-md object-contain dark:block"
  />
</>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight">
            {t("common.appName")}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {farm === undefined
  ? "Carregando..."
  : farm?.name ?? t("common.appSubtitle")}
          </p>
        </div>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {tenant?.isAdmin ? <NavLink to="/admin" onClick={onNavigate} className="mb-2 block rounded-lg border border-sidebar-border px-3 py-3 text-sm font-semibold">Administração do sistema</NavLink> : null}
        {navGroups.map((group) => {
          const items = group.items.filter((item) => !item.gestorOnly || isGestor);
          if (items.length === 0) return null;

          return (
            <div key={group.labelKey}>
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t(group.labelKey)}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isActive &&
                            "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/50">
  LiBen Agronegócios - V.1 - BETA - 2026
      </div>
    </aside>
  );
};
