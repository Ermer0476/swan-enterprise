"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

type Item = { code: string; title: string };

/** Jump straight to any TMSA element (code + description) without returning
 * to the Score Matrix. */
export function ElementSelect({ current, items }: { current: string; items: Item[] }) {
  const router = useRouter();

  return (
    <Select
      key={current}
      defaultValue={current}
      onChange={(e) => router.push(`/tmsa/element/${encodeURIComponent(e.target.value)}`)}
      className="max-w-md"
      aria-label="Jump to element"
    >
      {items.map((it) => (
        <option key={it.code} value={it.code}>
          {it.code} — {it.title}
        </option>
      ))}
    </Select>
  );
}
