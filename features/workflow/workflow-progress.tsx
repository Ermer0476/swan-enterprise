import { Check, X, Circle, Clock } from "lucide-react";
import { stepApproverLabel, type ActiveInstance } from "./engine";
import { formatDate } from "@/lib/utils";

/**
 * Renders the ordered approval chain with each step's status: decided
 * (approve/reject with actor + comment), current (awaiting), or pending.
 */
export function WorkflowProgress({ instance }: { instance: ActiveInstance }) {
  const actionByStep = new Map(instance.actions.map((a) => [a.stepId, a]));

  return (
    <ol className="space-y-3">
      {instance.steps.map((step) => {
        const action = actionByStep.get(step.id);
        const isCurrent =
          !action && step.order === instance.currentOrder;

        let Icon = Circle;
        let ring = "text-muted-foreground";
        if (action?.decision === "APPROVE") {
          Icon = Check;
          ring = "text-success";
        } else if (action?.decision === "REJECT") {
          Icon = X;
          ring = "text-danger";
        } else if (isCurrent) {
          Icon = Clock;
          ring = "text-accent";
        }

        return (
          <li key={step.id} className="flex gap-3">
            <div className={`mt-0.5 ${ring}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                <span>
                  {step.order}. {step.name}
                </span>
                {isCurrent && (
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                    Awaiting
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {stepApproverLabel(step)}
              </div>
              {action && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {action.decision === "APPROVE" ? "Approved" : "Rejected"} by{" "}
                  {action.actorName} · {formatDate(action.createdAt)}
                  {action.comment ? ` — “${action.comment}”` : ""}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
