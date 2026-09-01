"use client";

import { useEffect } from "react";

// Native <details> dropdowns only close when their summary is clicked again.
// This closes any open <details> when the user clicks outside it (or presses
// Escape) — the expected dropdown behaviour. Also gives one-open-at-a-time.
export default function DetailsAutoClose() {
  useEffect(() => {
    // `data-persist` <details> are content collapses (not dropdowns) — never
    // auto-close them.
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      // Picking a choice (a link inside the dropdown) closes that dropdown.
      const anchor = target.closest?.("a");
      if (anchor) {
        const d = anchor.closest("details");
        if (d && !d.hasAttribute("data-persist")) d.removeAttribute("open");
      }
      // Clicking outside an open dropdown closes it (one-open-at-a-time).
      document.querySelectorAll("details[open]:not([data-persist])").forEach((d) => {
        if (!d.contains(target)) d.removeAttribute("open");
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.querySelectorAll("details[open]:not([data-persist])").forEach((d) => d.removeAttribute("open"));
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
