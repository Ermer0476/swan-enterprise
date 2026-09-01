"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Ship } from "lucide-react";
import { setViewAsModeAction } from "@/lib/view-as";
import { cn } from "@/lib/utils";

/**
 * Administrator-only dev convenience — swaps the current session's
 * department/vesselId between "office" and "a ship" so both sides of every
 * Draft/Report/Review workflow can be exercised without a second login. See
 * lib/view-as.ts for the actual cookie-backed override.
 */
export function ViewAsToggle({ active, vesselName }: { active: boolean; vesselName: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setMode(mode: "OFFICE" | "VESSEL") {
    startTransition(async () => {
      await setViewAsModeAction(mode);
      router.refresh();
    });
  }

  const tab = "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5" title="Testing only — switches this session's Office/Vessel perspective">
      <button
        type="button"
        onClick={() => setMode("OFFICE")}
        disabled={pending}
        className={cn(tab, !active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        <Building2 className="h-3.5 w-3.5" /> Office
      </button>
      <button
        type="button"
        onClick={() => setMode("VESSEL")}
        disabled={pending}
        className={cn(tab, active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        <Ship className="h-3.5 w-3.5" /> Vessel{active && vesselName ? ` · ${vesselName}` : ""}
      </button>
    </div>
  );
}
