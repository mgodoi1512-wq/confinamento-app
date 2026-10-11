import {
  BarChart3,
  ClipboardList,
  Cog,
  LayoutDashboard,
  Leaf,
  Package,
  Scale,
  ShieldAlert,
  Syringe,
  Users,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  gestorOnly?: boolean;
  end?: boolean;
};

export type NavGroup = {
  labelKey: string;
  items: NavItem[];
  gestorOnly?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    labelKey: "nav.group.operation",
    items: [
      { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
      { to: "/currais", labelKey: "nav.pens", icon: Package },
      { to: "/lotes", labelKey: "nav.lots", icon: Leaf },
      { to: "/animais", labelKey: "nav.animals", icon: ClipboardList },
      { to: "/pesagens", labelKey: "nav.weighings", icon: Scale },
    ],
  },
  {
    labelKey: "nav.group.nutrition",
    items: [
      { to: "/trato", labelKey: "nav.feed", icon: UtensilsCrossed, end: true },
      { to: "/trato/leitura", labelKey: "nav.reading", icon: Wheat },
      { to: "/config/dietas", labelKey: "nav.diets", icon: BarChart3, gestorOnly: true },
    ],
  },
  {
    labelKey: "nav.group.health",
    items: [
      { to: "/sanidade/protocolos", labelKey: "nav.protocols", icon: Syringe, gestorOnly: true },
      { to: "/sanidade/tratamentos", labelKey: "nav.treatments", icon: ShieldAlert },
      { to: "/sanidade/ocorrencias", labelKey: "nav.occurrences", icon: ShieldAlert },
    ],
  },
  {
    labelKey: "nav.group.management",
    items: [
      { to: "/config/currais", labelKey: "nav.pens", icon: Package, gestorOnly: true },
      { to: "/config/usuarios", labelKey: "nav.users", icon: Users, gestorOnly: true },
      { to: "/config", labelKey: "nav.settings", icon: Cog, end: true },
    ],
  },
];

/** Título da página exibido na barra superior no mobile. */
export const routeTitles: { pattern: RegExp; labelKey: string }[] = [
  { pattern: /^\/$/, labelKey: "nav.dashboard" },
  { pattern: /^\/currais/, labelKey: "nav.pens" },
  { pattern: /^\/lotes/, labelKey: "nav.lots" },
  { pattern: /^\/animais/, labelKey: "nav.animals" },
  { pattern: /^\/pesagens/, labelKey: "nav.weighings" },
  { pattern: /^\/trato\/leitura/, labelKey: "nav.reading" },
  { pattern: /^\/trato/, labelKey: "nav.feed" },
  { pattern: /^\/sanidade\/protocolos/, labelKey: "nav.protocols" },
  { pattern: /^\/sanidade\/tratamentos/, labelKey: "nav.treatments" },
  { pattern: /^\/sanidade\/ocorrencias/, labelKey: "nav.occurrences" },
  { pattern: /^\/config\/usuarios/, labelKey: "nav.users" },
  { pattern: /^\/config\/currais/, labelKey: "nav.pens" },
  { pattern: /^\/config\/dietas/, labelKey: "nav.diets" },
  { pattern: /^\/config/, labelKey: "nav.settings" },
];

export const bottomNavItems: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/currais", labelKey: "nav.pens", icon: Package },
  { to: "/trato", labelKey: "nav.feed", icon: UtensilsCrossed },
  { to: "/pesagens", labelKey: "nav.weighings", icon: Scale },
];
