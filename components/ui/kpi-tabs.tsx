"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function KpiTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active);
  // Selecting a tab scrolls its content into view — the button row can sit
  // well above the fold on a long page, so switching tabs would otherwise
  // change what's rendered below without the screen actually moving there.
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            variant={t.key === active ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActive(t.key);
              contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div ref={contentRef}>
        <Card>
          <CardContent className="pt-4">{current?.content}</CardContent>
        </Card>
      </div>
    </div>
  );
}
