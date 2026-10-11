import { LogOut, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { routeTitles } from "@/components/app/nav-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

const initials = (name: string | null | undefined, email: string | null | undefined) => {
  const source = name?.trim() || email || "";
  const parts = source.split(/[\s.@]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "U").concat(parts[1]?.[0] ?? "").toUpperCase();
};

export const Topbar = ({
  farmName,
  onOpenMenu,
}: {
  farmName?: string;
  onOpenMenu: () => void;
}) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { profile, role, user, signOut } = useAuth();

  const titleKey =
    routeTitles.find((route) => route.pattern.test(pathname))?.labelKey ?? "nav.dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={t("nav.openMenu")}
          onClick={onOpenMenu}
        >
          <Menu />
        </Button>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold tracking-tight">
            {t(titleKey)}
          </p>
          {farmName ? (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{farmName}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={profile?.full_name ?? "Usuário"}>
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials(profile?.full_name, user?.email)}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <span className="block truncate text-sm font-semibold">
                {profile?.full_name ?? t("field.fullName")}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {role ? t(`status.role.${role}`) : ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} className="gap-2">
              <LogOut className="size-4" />
              {t("action.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
