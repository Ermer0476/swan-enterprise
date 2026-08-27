import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookText,
  AlertTriangle,
  ShieldAlert,
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
  Flag,
  Award,
  Umbrella,
  Building2,
  Archive,
  Activity,
  Target,
  FileQuestion,
  Recycle,
  Gauge,
  Ruler,
  Layers,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export type NavChild = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see the item; undefined = visible to all. */
  permission?: PermissionKey;
  /** Not yet implemented — shown as a roadmap placeholder. */
  soon?: boolean;
  /** Flyout submenu (Searchgear-style CRM pattern) — the parent item still
   * links to its own page; the chevron opens a floating list of shortcuts
   * next to it, same shape as filtering the parent page by a query param. */
  children?: NavChild[];
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
      { label: "TMSA Hub", href: "/tmsa", icon: Gauge, permission: "tmsa:read" },
    ],
  },
  {
    title: "Safety & Quality (Phase 1)",
    items: [
      { label: "SMS Manual", href: "/sms-manual", icon: BookText, permission: "sms:read" },
      { label: "Incidents", href: "/incidents", icon: AlertTriangle, permission: "incident:read" },
      { label: "Near Miss/HOR", href: "/near-miss", icon: ShieldAlert, permission: "nm:read" },
      { label: "Non-Conformities", href: "/non-conformities", icon: FileWarning, permission: "ncr:read" },
      { label: "SIRE Inspections", href: "/sire", icon: ClipboardCheck, permission: "sire:read" },
      { label: "PSC Inspections", href: "/psc", icon: Anchor, permission: "psc:read" },
      { label: "CDI Inspections", href: "/cdi", icon: FlaskConical, permission: "cdi:read" },
      { label: "Internal Audits", href: "/internal-audits", icon: ShieldCheck, permission: "iaudit:read" },
      { label: "External Audits", href: "/external-audits", icon: ShieldCheck, permission: "eaudit:read" },
      { label: "Company Inspections", href: "/company-inspections", icon: Building2, permission: "cinsp:read" },
      { label: "Exposure Hours", href: "/exposure-hours", icon: Activity, permission: "exposure:read" },
      { label: "Committee Meetings", href: "/meetings", icon: CalendarClock, permission: "meeting:read" },
      { label: "Emergency Drills", href: "/drills", icon: Flame, permission: "drill:read" },
      {
        label: "Documents",
        href: "/documents",
        icon: FolderOpen,
        permission: "doc:read",
        children: [
          { label: "Controlled Documents", href: "/documents", icon: FolderOpen },
          { label: "Vessel Documentation", href: "/documents/vessel", icon: Ship },
          { label: "Company Documents", href: "/documents/company", icon: Building2 },
        ],
      },
      {
        label: "Circulars",
        href: "/circulars",
        icon: Megaphone,
        permission: "circular:read",
        children: [
          { label: "Flag State", href: "/circulars?source=FLAG", icon: Flag },
          { label: "Classification Society", href: "/circulars?source=CLASS", icon: Award },
          { label: "Insurance / P&I Club", href: "/circulars?source=INSURANCE", icon: Umbrella },
          { label: "Company Circulars", href: "/circulars?source=COMPANY", icon: Building2 },
          { label: "Archive", href: "/circulars?archive=1", icon: Archive },
        ],
      },
      { label: "Risk Assessments", href: "/risk", icon: ShieldCheck, permission: "risk-doc:read" },
      { label: "Defect List", href: "/defects", icon: ListChecks, permission: "defect:read" },
    ],
  },
  {
    title: "Operations (Phase 2)",
    items: [
      { label: "Planned Maintenance", href: "/pms", icon: Wrench, soon: true },
      { label: "Procurement", href: "/procurement", icon: ShoppingCart, permission: "procurement:read" },
      { label: "Crewing", href: "/crewing", icon: Users, soon: true },
    ],
  },
  {
    title: "Analytics (Phase 3)",
    items: [
      { label: "Vessel Tracker", href: "/vessel-tracker", icon: Ship, permission: "vtracker:read" },
      { label: "Environment Records", href: "/environment", icon: Recycle, permission: "environment:read" },
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
      {
        label: "Exposure KPI Targets",
        href: "/settings/exposure-kpi",
        icon: Target,
        permission: "exposure:manage-targets",
      },
      {
        label: "SIRE KPI Target",
        href: "/settings/sire-kpi",
        icon: Target,
        permission: "sire:manage-targets",
      },
      {
        label: "Company Inspection KPI Target",
        href: "/settings/company-inspections-kpi",
        icon: Target,
        permission: "cinsp:manage-targets",
      },
      {
        label: "SIRE 2.0 Questionnaire",
        href: "/settings/sire-questionnaire",
        icon: FileQuestion,
        permission: "sire-questionnaire:manage",
      },
      {
        label: "Environmental Unit Master",
        href: "/settings/environment-units",
        icon: Ruler,
        permission: "environment:manage-units",
      },
      {
        label: "Access Levels",
        href: "/settings/access-levels",
        icon: Layers,
        permission: "access-level:manage",
      },
      {
        label: "Departments",
        href: "/settings/departments",
        icon: Building2,
        permission: "department:manage",
      },
      {
        label: "Reference Lists",
        href: "/settings/reference-lists",
        icon: ListChecks,
        permission: "reference:manage",
      },
      {
        label: "Operational Windows",
        href: "/settings/operational-windows",
        icon: CalendarClock,
        permission: "settings:manage-windows",
      },
    ],
  },
];
