import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "danger" | "success" | "warning" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-ring",
  outline:
    "border border-input bg-transparent hover:bg-muted focus-visible:ring-ring",
  ghost: "bg-transparent hover:bg-muted focus-visible:ring-ring",
  danger:
    "bg-danger text-white hover:opacity-90 focus-visible:ring-danger",
  success:
    "bg-success text-white hover:opacity-90 focus-visible:ring-success",
  // Solid amber — reserved for KPI dashboard entry points so they stand out
  // consistently from every module's other outline-styled actions.
  warning:
    "bg-warning text-white hover:opacity-90 focus-visible:ring-warning",
  // Solid blue — same hue as --accent (links/highlights), for a primary
  // action that isn't the page's single "most important" button (that's
  // `default`) but still needs to read as filled/prominent, not outline.
  accent:
    "bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm",
  icon: "h-9 w-9",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
