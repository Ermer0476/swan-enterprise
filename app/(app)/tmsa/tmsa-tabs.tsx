import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Sub-navigation within the TMSA Hub. Real routes (not client-state tabs)
 * since the Score Matrix and CAP tracker are separate server-rendered pages. */
export function TmsaTabs({ active }: { active: "matrix" | "cap" }) {
  const tabs = [
    { key: "matrix", label: "Score Matrix", href: "/tmsa" },
    { key: "cap", label: "Audit Findings (CAP)", href: "/tmsa/cap" },
  ] as const;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href}>
          <Button type="button" variant={t.key === active ? "default" : "outline"} size="sm">
            {t.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
