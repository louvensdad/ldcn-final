import {
  Home, FolderOpen, Rocket, Store, BookOpen, Plus,
  Sparkles, Bot, BarChart3, Settings,
  CheckSquare, Play, Package, FileCheck, Shield,
  Building2, Globe, Users, Key, Lock, FileText,
  CreditCard, Bell, Wrench, type LucideIcon,
} from "lucide-react";

export interface NavItemDef {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroupDef {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: NavItemDef[];
  /** Groups collapsed by default carry the app's technical surface — see Fase 9/19 in the
   *  redesign brief. Full opt-in "Engineering Mode" gating is Fase H; for now this group is just
   *  visually de-emphasized and closed by default so it doesn't compete with the everyday flow. */
  defaultOpen?: boolean;
}

/** Single source of truth for the sidebar, the topbar breadcrumb, and the command palette. */
export const NAV_MAIN: NavItemDef[] = [{ path: "/", labelKey: "nav.home", icon: Home, end: true }];

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "create",
    labelKey: "nav.create",
    icon: Plus,
    defaultOpen: true,
    items: [
      { path: "/wizard", labelKey: "nav.newMission", icon: Sparkles },
      { path: "/projects", labelKey: "nav.projects", icon: FolderOpen },
      { path: "/marketplace", labelKey: "nav.marketplace", icon: Store },
    ],
  },
  {
    id: "follow",
    labelKey: "nav.follow",
    icon: Rocket,
    defaultOpen: true,
    items: [
      { path: "/missions", labelKey: "nav.missions", icon: Rocket },
      { path: "/ai-decisions", labelKey: "nav.aiDecisions", icon: Sparkles },
    ],
  },
  {
    id: "learn",
    labelKey: "nav.learn",
    icon: BookOpen,
    defaultOpen: true,
    items: [{ path: "/academy", labelKey: "nav.academy", icon: BookOpen }],
  },
  {
    id: "company",
    labelKey: "nav.company",
    icon: Building2,
    defaultOpen: true,
    items: [
      { path: "/organization", labelKey: "nav.organization", icon: Globe },
      { path: "/members", labelKey: "nav.members", icon: Users },
      { path: "/billing", labelKey: "nav.billing", icon: CreditCard },
    ],
  },
  {
    id: "advanced",
    labelKey: "nav.advanced",
    icon: Wrench,
    defaultOpen: false,
    items: [
      { path: "/tasks", labelKey: "nav.tasks", icon: CheckSquare },
      { path: "/executions", labelKey: "nav.executions", icon: Play },
      { path: "/artifacts", labelKey: "nav.artifacts", icon: Package },
      { path: "/reviews", labelKey: "nav.reviews", icon: FileCheck },
      { path: "/gates", labelKey: "nav.gates", icon: Shield },
      { path: "/ai-usage", labelKey: "nav.aiUsage", icon: BarChart3 },
      { path: "/agents", labelKey: "nav.agents", icon: Bot },
      { path: "/notifications", labelKey: "nav.notifications", icon: Bell },
      { path: "/roles", labelKey: "nav.roles", icon: Key },
      { path: "/security", labelKey: "nav.security", icon: Lock },
      { path: "/audit", labelKey: "nav.audit", icon: FileText },
    ],
  },
];

export const NAV_BOTTOM: NavItemDef[] = [{ path: "/settings", labelKey: "nav.settings", icon: Settings }];

export const ALL_NAV_ITEMS: NavItemDef[] = [...NAV_MAIN, ...NAV_GROUPS.flatMap((g) => g.items), ...NAV_BOTTOM];

/** Breadcrumb label for the topbar: matches the current pathname's first segment. */
export function pageLabelKeyFor(pathname: string): string | undefined {
  if (pathname === "/") return "nav.home";
  const first = "/" + pathname.split("/").filter(Boolean)[0];
  return ALL_NAV_ITEMS.find((item) => item.path === first)?.labelKey;
}
