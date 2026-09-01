"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

/**
 * A text input with a styled suggestion dropdown — same visual language as
 * the rest of the app (card panel, hover rows) rather than the browser's own
 * unstyled <datalist> popup. Still free text: picking a suggestion just
 * fills the field, typing anything else is equally valid.
 */
export function ComboboxInput({
  id,
  name,
  defaultValue = "",
  suggestions,
  placeholder,
  required,
  disabled,
  className,
  onSelect,
  onChange,
  onBlur,
}: {
  id?: string;
  /** Optional when the parent tracks the value itself via `onChange` (a
   * controlled grid cell, say) rather than reading it back from FormData. */
  name?: string;
  defaultValue?: string;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Fires when a suggestion (not free-typed text) is picked — lets the
   * parent react, e.g. auto-filling a related field for that suggestion. */
  onSelect?: (value: string) => void;
  /** Fires on every change — typed or picked from suggestions. Only needed
   * by controlled callers that track the value themselves; native-form
   * callers can rely on `name` + defaultValue instead. */
  onChange?: (value: string) => void;
  /** Fires when the field loses focus — for callers that persist free-typed
   * text on blur rather than on every keystroke (a suggestion click doesn't
   * blur the field, since the dropdown's onMouseDown prevents that). */
  onBlur?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const filtered = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.trim().toLowerCase()))
    : suggestions;

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          onChange?.(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => onBlur?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              // Fires before the input's blur/close-on-outside-click handler,
              // so the click registers instead of the dropdown closing first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setValue(s);
                setOpen(false);
                onSelect?.(s);
                onChange?.(s);
              }}
              className={cn(
                "block w-full truncate rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
