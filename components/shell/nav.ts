import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookText,
  AlertTriangle,
  ShieldAlert,
  Eye,
  ClipboardCheck,
  Anchor,
  FlaskConical,
  ShieldCheck,
  FileWarning,
  CalendarClock,
  Flame,
  FolderOpen,
  Megaphone,
  ListChecks,
  Wrench,
  ShoppingCart,
  Users,
  Ship,
  BarChart3,
  GitBranch,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see the item; undefined = visible to all. */
  permission?: PermissionKey;
  /** Not yet implemented — shown as a roadmap placeholder. */
  soon?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

// Navigation reflects the full product roadmap. Implemented items link to live
// pages; `soon` items are shown disabled so the platform vision is visible.
export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Vessels", href: "/vessels", icon: Ship, permission: "vessel:read" },
    ],
  },
  {
    title: "Safety & Quality (Phase 1)",
    items: [
      { label: "SMS Manual", href: "/sms-manual", icon: BookText, permission: "sms:read" },
      { label: "Incidents", href: "/incidents", icon: AlertTriangle, permission: "incident:read" },
      { label: "Near Miss", href: "/near-miss", icon: ShieldAlert, permission: "nm:read" },
      { label: "Hazard Observations", href: "/hazards", icon: Eye, permission: "hazard:read" },
      { label: "Non-Conformities", href: "/non-conformities", icon: FileWarning, permission: "ncr:read" },
      { label: "SIRE Inspections", href: "/sire", icon: ClipboardCheck, permission: "sire:read" },
      { label: "PSC Inspections", href: "/psc", icon: Anchor, permission: "psc:read" },
      { label: "CDI Inspections", href: "/cdi", icon: FlaskConical, permission: "cdi:read" },
      { label: "Internal Audits", href: "/internal-audits", icon: ShieldCheck, permission: "iaudit:read" },
      { label: "External Audits", href: "/external-audits", icon: ShieldCheck, permission: "eaudit:read" },
      { label: "Safety Meetings", href: "/meetings", icon: CalendarClock, soon: true },
      { label: "Emergency Drills", href: "/drills", icon: Flame, soon: true },
      { label: "Documents", href: "/documents", icon: FolderOpen, soon: true },
      { label: "Circulars", href: "/circulars", icon: Megaphone, soon: true },
      { label: "Risk Assessments", href: "/risk", icon: ShieldCheck, soon: true },
      { label: "Defect List", href: "/defects", icon: ListChecks, soon: true },
    ],
  },
  {
    title: "Operations (Phase 2)",
    items: [
      { label: "Planned Maintenance", href: "/pms", icon: Wrench, soon: true },
      { label: "Procurement", href: "/procurement", icon: ShoppingCart, soon: true },
      { label: "Crewing", href: "/crewing", icon: Users, soon: true },
    ],
  },
  {
    title: "Analytics (Phase 3)",
    items: [
      { label: "Fleet Tracking", href: "/tracking", icon: Ship, soon: true },
      { label: "KPI & TMSA", href: "/kpi", icon: BarChart3, soon: true },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Workflows",
        href: "/settings/workflows",
        icon: GitBranch,
        permission: "admin:manage-workflows",
      },
    ],
  },
];
