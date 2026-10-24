import { useState } from "react";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { navGroups } from "@/components/app/nav-config";
import { useAuth } from "@/hooks/use-auth";
import { useFarm } from "@/hooks/use-farm";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SidebarNavProps = { onNavigate?: () => void; className?: string };
const preferenceKey="liben:sidebar-collapsed";

export const SidebarNav = ({ onNavigate, className }: SidebarNavProps) => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();
  const { data: farm } = useFarm();
  const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem(preferenceKey)==="1";}catch{return false;}});
  const compact=!onNavigate&&collapsed;
  const toggle=()=>{const next=!collapsed;setCollapsed(next);try{localStorage.setItem(preferenceKey,next?"1":"0");}catch{/* A navegação continua funcionando sem armazenamento. */}};

  const collapseControl=!onNavigate&&<button type="button" aria-label={compact?"Expandir menu":"Recolher menu"} aria-expanded={!compact} onClick={toggle} className="absolute -right-3.5 top-1/2 z-40 flex h-15 w-5 -translate-y-1/2 items-center justify-center rounded-[50%] border border-sidebar-border bg-sidebar text-sidebar-foreground/70 shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" title={compact?"Expandir menu":"Recolher menu"}>{compact?<ChevronRight className="size-3.5"/>:<ChevronLeft className="size-3.5"/>}</button>;

  return <TooltipProvider delayDuration={150}><aside aria-label="Menu principal" className={cn(
    "relative z-30 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-500 ease-in-out motion-reduce:transition-none",
    compact?"w-20":"w-64",className,
  )}>
    <div className={cn("flex shrink-0 items-center gap-3 p-3",compact&&"justify-center px-2 py-4")} title={compact?farm?.name??t("common.appName"):undefined}>
      <img src="/logo-liben-2.webp" alt="LiBen Agronegócios" className={cn("shrink-0 rounded-md object-contain dark:hidden",compact?"size-10":"size-14")}/>
      <img src="/logo-liben-dark.webp" alt="LiBen Agronegócios" className={cn("hidden shrink-0 rounded-md object-contain dark:block",compact?"size-10":"size-14")}/>
      {!compact&&<div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-semibold tracking-tight">{t("common.appName")}</p><p className="min-h-4 truncate text-xs text-sidebar-foreground/70" title={farm?.name}>{farm===undefined?" ":farm?.name??t("common.appSubtitle")}</p></div>}
    </div>
    {collapseControl}
    <nav aria-label="Páginas da plataforma" className="scrollbar-thin min-h-0 pt-6 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
      {navGroups.map(group=>{
        const items=group.items.filter(item=>!item.gestorOnly||isGestor);
        if(!items.length)return null;
        return <div key={group.labelKey} className={compact?"mt-2 border-t border-sidebar-border pt-2 first:mt-0 first:border-t-0 first:pt-0":undefined}>
          <p className={compact?"sr-only":"px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55"}>{t(group.labelKey)}</p>
          <ul className="space-y-0.5">{items.map(item=>{
            const label=t(item.sidebarLabelKey??item.labelKey);
            const link=<NavLink to={item.to} end={item.end} onClick={onNavigate} aria-label={label} className={({isActive})=>cn(
              "flex h-11 items-center gap-3 rounded-md text-sm font-medium text-sidebar-foreground/90 transition-colors duration-150 hover:bg-white/5 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring lg:h-9",
              compact?"justify-center px-0":"px-3",
              isActive&&"bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary dark:hover:text-primary-foreground",
            )}><item.icon aria-hidden="true" className="size-5 shrink-0"/><span className={compact?"sr-only":"truncate"}>{label}</span></NavLink>;
            return <li key={item.to}>{compact?<Tooltip><TooltipTrigger asChild><span className="block">{link}</span></TooltipTrigger><TooltipPortal><TooltipContent side="right" sideOffset={12}>{label}</TooltipContent></TooltipPortal></Tooltip>:link}</li>;
          })}</ul>
        </div>;
      })}
    </nav>
    <div className={cn("shrink-0 border-t border-sidebar-border px-3 py-2 text-[10px] text-sidebar-foreground/55",compact&&"text-center")} title="LiBen AGRO - Gestão de Fazendas">{compact?"LiBen AGRO":"LiBen AGRO | Gestão de Fazendas"}</div>
  </aside></TooltipProvider>;
};
