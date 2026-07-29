"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/features/vessels/actions";
import { Button } from "@/components/ui/button";

export function DeleteVesselButton({
  vesselId,
  action,
}: {
  vesselId: string;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!confirm("Remove this vessel from the fleet?")) return;
    setError(null);
    const fd = new FormData();
    fd.set("vesselId", vesselId);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={run} disabled={pending}>
        <Trash2 className="h-4 w-4" /> Delete vessel
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
