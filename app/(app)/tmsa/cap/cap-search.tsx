"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Live search box: updates the ?q= param (debounced) so the server filters
 * matching findings. */
export function CapSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  const push = (v: string) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    if (v.trim()) p.set("q", v);
    else p.delete("q");
    router.replace(`${pathname}?${p.toString()}`);
  };

  const onChange = (v: string) => {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v), 250);
  };

  return (
    <div className="relative mb-4 max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search words in observations, TMSA #, source…"
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            clearTimeout(timer.current);
            push("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
