import { CattleNavIcon, FloorPlanIcon } from "./navigation-icons";
import {
  BarChart3,
  TrendingUp,
  Wallet,
  MapPin,
  Cog,
  LayoutDashboard,
  Settings2,
  Sprout,
  ShieldAlert,
  Syringe,
  Users,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import {
  HeartPulse,
  // demais ícones...
} from "lucide-react";

import { WeightKgIcon } from "./weight-kg-icon";

export type NavItem = {
  to: string;
  labelKey: string;
  sidebarLabelKey?: string;
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
      { to: "/currais", labelKey: "nav.pens", icon: MapPin },
      { to: "/lotes", labelKey: "nav.lots", icon: FloorPlanIcon },
      { to: "/animais", labelKey: "nav.animals", icon: CattleNavIcon },
      { to: "/pesagens", labelKey: "nav.weighings", icon: WeightKgIcon },
    ],
  },
  {
    labelKey: "nav.group.nutrition",
    items: [
      { to: "/trato", labelKey: "nav.feed", icon: UtensilsCrossed, end: true },
      { to: "/trato/leitura", labelKey: "nav.reading", icon: Wheat },
      { to: "/nutricao/adaptacao", labelKey: "nav.adaptation", icon: Sprout },
      { to: "/config/dietas", labelKey: "nav.diets", icon: BarChart3, gestorOnly: true },
    ],
  },
  {
    labelKey: "nav.group.health",
    items: [
      { to: "/sanidade/protocolos", labelKey: "nav.protocols", icon: Syringe, gestorOnly: true },
      { to: "/sanidade/tratamentos", labelKey: "nav.treatments", icon: HeartPulse },
      { to: "/sanidade/ocorrencias", labelKey: "nav.occurrences", icon: ShieldAlert },
    ],
  },
  {
    labelKey: "nav.group.management",
    items: [
      { to: "/gestao/mercado", labelKey: "nav.market", sidebarLabelKey: "Mercado", icon: TrendingUp },
      { to: "/gestao/financeiro", labelKey: "nav.finance", icon: Wallet, gestorOnly: true },
      { to: "/config/currais", labelKey: "Cadastro de locais", icon: Settings2, gestorOnly: true },
      { to: "/config/usuarios", labelKey: "nav.users", icon: Users, gestorOnly: true },
      { to: "/config", labelKey: "nav.settings", icon: Cog, end: true },
    ],
  },
];

/** Título da página exibido na barra superior no mobile. */
export const routeTitles: { pattern: RegExp; labelKey: string }[] = [
  { pattern: /^\/gestao\/mercado/, labelKey: "nav.market" },
  { pattern: /^\/gestao\/financeiro\/alimentacao/, labelKey: "nav.feedingCosts" },
  { pattern: /^\/gestao\/financeiro\/fluxo-de-caixa/, labelKey: "nav.cashFlow" },
  { pattern: /^\/gestao\/financeiro\/estoque/, labelKey: "nav.inventory" },
  { pattern: /^\/gestao\/financeiro/, labelKey: "nav.finance" },
  { pattern: /^\/$/, labelKey: "nav.dashboard" },
  { pattern: /^\/currais/, labelKey: "nav.pens" },
  { pattern: /^\/lotes/, labelKey: "nav.lots" },
  { pattern: /^\/animais/, labelKey: "nav.animals" },
  { pattern: /^\/pesagens/, labelKey: "nav.weighings" },
  { pattern: /^\/nutricao\/adaptacao/, labelKey: "nav.adaptation" },
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
  { to: "/gestao/financeiro", labelKey: "nav.finance", icon: Wallet },
  { to: "/trato", labelKey: "nav.feed", icon: UtensilsCrossed },
  { to: "/pesagens", labelKey: "nav.weighings", icon: WeightKgIcon },
];
