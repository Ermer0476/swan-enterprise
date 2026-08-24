"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DATE_LIKE_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => {
  const innerRef = React.useRef<HTMLInputElement | null>(null);

  // Force the native calendar/time picker open on any click in the field —
  // this input's own flex-based layout can make the browser's built-in
  // picker-indicator icon unreliable to hit precisely, so clicking anywhere
  // should work instead of leaving the user to type the date by hand.
  // showPicker() needs a live user gesture to succeed; wiring it through a
  // native addEventListener (rather than React's synthetic onClick) is the
  // reliable way to get that — React's synthetic dispatch has been observed
  // to lose the gesture window for showPicker() in some browsers, causing it
  // to silently no-op.
  React.useEffect(() => {
    const el = innerRef.current;
    if (!el || !DATE_LIKE_TYPES.has(type as string)) return;
    const openPicker = () => {
      try {
        (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        // Ignore — e.g. browsers without showPicker(), or a stale gesture.
      }
    };
    el.addEventListener("click", openPicker);
    return () => el.removeEventListener("click", openPicker);
  }, [type]);

  return (
    <input
      ref={(el) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
      }}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

/**
 * A single-line-looking text field that grows downward as content wraps,
 * instead of scrolling sideways. It's a <textarea> under the hood, so Enter
 * inserts a newline rather than submitting the form — the same native
 * behavior as any multi-line Textarea, just visually sized like Input at
 * rest. Drop-in replacement for Input wherever free text is typed (not for
 * dates, emails, passwords, or single-line filters that should submit on
 * Enter).
 */
export const AutoGrowInput = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, onInput, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Re-measure after every render so value changes coming from outside
  // (controlled resets, defaultValue on mount) also resize the box.
  React.useEffect(() => {
    resize(innerRef.current);
  });

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }}
      rows={1}
      onInput={(e) => {
        resize(e.currentTarget);
        onInput?.(e);
      }}
      className={cn(
        "flex min-h-9 w-full resize-none overflow-y-hidden rounded-md border border-input bg-background px-3 py-1.5 text-sm leading-[1.375rem] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
AutoGrowInput.displayName = "AutoGrowInput";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none text-foreground",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
