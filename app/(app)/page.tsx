import Link from "next/link";
import {
  BookText,
  Ship,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();

  const [smsTotal, smsApproved, vesselCount, openIncidents] = await Promise.all([
    prisma.smsDocument.count({
      where: { companyId: user.companyId, deletedAt: null },
    }),
    prisma.smsDocument.count({
      where: { companyId: user.companyId, deletedAt: null, status: "APPROVED" },
    }),
    prisma.vessel.count({
      where: { companyId: user.companyId, deletedAt: null, status: "ACTIVE" },
    }),
    prisma.incident.count({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: { not: "CLOSED" },
      },
    }),
  ]);

  // Shipboard accounts are named after the vessel itself (e.g. "Swan
  // Aquarius"), not a person — truncating to the first word would read as a
  // cut-off name ("Welcome, Swan"), so show the full name for those.
  const firstName = user.department === "SHIPBOARD" ? user.fullName : user.fullName.split(" ")[0];
  const dept = user.department
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

  const stats = [
    {
      label: "Active Vessels",
      value: vesselCount,
      icon: Ship,
      href: undefined,
    },
    {
      label: "SMS Documents",
      value: smsTotal,
      icon: BookText,
      href: "/sms-manual",
    },
    {
      label: "Approved & In Force",
      value: smsApproved,
      icon: ClipboardCheck,
      href: "/sms-manual",
    },
    {
      label: "Open Incidents",
      value: openIncidents,
      icon: AlertTriangle,
      href: can(user, "incident:read") ? "/incidents" : undefined,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={`${dept} Department · ${user.roles.join(", ") || "No role assigned"}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const body = (
            <Card className="transition-colors hover:border-accent/40">
              <CardContent className="flex items-center justify-between pt-5">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {s.value}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {s.label}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
              </CardContent>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-start gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Ship Management System (SMS) Manual</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The governing document set. Every controlled procedure, versioned
              and approval-tracked — the foundation the whole platform enforces.
            </p>
          </div>
          <Link
            href="/sms-manual"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Open SMS Manual <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
