"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LEGENDS: { code: string; label: string; formula?: string }[] = [
  { code: "FAT", label: "Fatality" },
  { code: "PTD", label: "Permanent Total Disability" },
  { code: "PPD", label: "Permanent Partial Disability" },
  { code: "LWC", label: "Lost Workday Case" },
  { code: "RWC", label: "Restricted Workday Case" },
  { code: "MTC", label: "Medical Treatment Case" },
  { code: "LTI", label: "Lost Time Injury", formula: "FAT + PTD + PPD + LWC" },
  { code: "TRC", label: "Total Recordable Case", formula: "LTI + RWC + MTC" },
  { code: "LTIF", label: "Lost Time Injury Frequency", formula: "LTI × 1,000,000 ÷ Total Hours" },
  { code: "TRCF", label: "Total Recordable Case Frequency", formula: "TRC × 1,000,000 ÷ Total Hours" },
];

export function LegendsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
        <Eye className="h-4 w-4" /> Legends
      </Button>
      {open && (
        <Card className="absolute right-0 top-full z-10 mt-2 w-80 shadow-lg">
          <CardContent className="pt-4">
            <dl className="space-y-2 text-sm">
              {LEGENDS.map((l) => (
                <div key={l.code}>
                  <dt className="font-semibold">{l.code} — {l.label}</dt>
                  {l.formula && <dd className="text-xs text-muted-foreground">{l.formula}</dd>}
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
