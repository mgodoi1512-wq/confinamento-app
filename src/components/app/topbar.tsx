import { toast } from "sonner";
import { ChevronDown, CreditCard, LogOut, MapPin, Menu, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { TutorialLauncher } from "@/components/tutorial/tutorial-launcher";
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-lg lg:hidden"
          aria-label={t("nav.openMenu")}
          onClick={onOpenMenu}
        >
          <Menu />
        </Button>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight">
            {t(titleKey)}
          </p>
          <div className="flex min-h-4 min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground"><MapPin aria-hidden="true" className="size-3 shrink-0" /><p className="truncate" title={farmName}>{farmName || "Fazenda"}</p></div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 [&_button]:rounded-lg">
        <ThemeToggle />
        <TutorialLauncher currentPath={pathname} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 shrink-0 gap-1 px-1.5 sm:px-2" aria-label={`Abrir menu do perfil de ${profile?.full_name ?? "usuário"}`}>
              <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials(profile?.full_name, user?.email)}
              </span>
              <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
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
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/config/plano">
                <CreditCard className="size-4" />
                Meu Plano
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/config"><Settings className="size-4" />Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut().catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível sair."))} className="gap-2 text-red-700 focus:bg-red-500/10 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300">
              <LogOut className="size-4" />
              {t("action.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
