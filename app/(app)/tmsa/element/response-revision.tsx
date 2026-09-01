"use client";

import { useTransition } from "react";
import { markUploadedToOcimfAction } from "@/features/tmsa/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TmsaResponseStateValue } from "@/features/tmsa/schema";

/** Shows the Company Response revision state (On OCIMF / Revised) + rev
 * number, with a button to mark a revision as uploaded to the OCIMF website. */
export function ResponseRevision({ id, revision, responseState }: { id: string; revision: number; responseState: TmsaResponseStateValue }) {
  const [pending, start] = useTransition();
  const revised = responseState === "REVISED";

  return (
    <div className="flex items-center gap-2">
      <Badge
        tone={revised ? "warning" : "success"}
        title={revised ? "Edited locally — a new revision pending upload to the OCIMF website" : "This response is the version currently uploaded on the OCIMF website"}
      >
        {revised ? "● Revised" : "✓ On OCIMF"} · Rev {revision}
      </Badge>
      {revised && (
        <Button type="button" size="sm" disabled={pending} onClick={() => start(() => markUploadedToOcimfAction(id))}>
          {pending ? "…" : "Mark uploaded to OCIMF"}
        </Button>
      )}
    </div>
  );
}
