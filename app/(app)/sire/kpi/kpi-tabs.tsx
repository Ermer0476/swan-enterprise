"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function KpiTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            variant={t.key === active ? "default" : "outline"}
            size="sm"
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="pt-4">{current?.content}</CardContent>
      </Card>
    </div>
  );
}
