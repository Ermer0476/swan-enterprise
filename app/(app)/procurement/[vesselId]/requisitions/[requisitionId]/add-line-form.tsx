"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addRequisitionLineAction, type ActionResult } from "@/features/procurement/actions";
import { Input, AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CatalogueOption = {
  itemType: "STORES" | "SPARES";
  itemId: string;
  label: string;
  unit: string;
  rob: number;
  impaCode: string | null;
};

const initial: ActionResult = { ok: false, error: null };
const MAX_SUGGESTIONS = 30;

// Laid out to match the real paper requisition form's columns (Item /
// Unit / ROB / IMPA / Remarks / Required Qty). The Item field is a
// type-to-search combobox rather than a plain <select> — the catalogue runs
// into the hundreds of items per vessel, so narrowing by typing (matching
// name or IMPA code) is how the crew will actually find anything. Typing
// something that never matches a suggestion is still accepted — it's
// submitted as a Non-Catalogue request, same as explicitly free text on the
// paper form.
export function AddLineForm({ revisionId, options }: { revisionId: string; options: CatalogueOption[] }) {
  const [state, action, pending] = useActionState(addRequisitionLineAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogueOption | null>(null);
  const [open, setOpen] = useState(false); // combobox suggestions dropdown
  const [expanded, setExpanded] = useState(false); // the add-line toolbar itself, collapsed by default
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setQuery("");
      setSelected(null);
      setExpanded(false);
    }
    // Depend on the whole state object, not state.ok — useActionState hands
    // back a new object on every dispatch, but `ok` itself stays `true`
    // across a second, third, etc. successful add in the same session, so
    // keying on just the boolean would only fire this once.
  }, [state]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // The suggestion list is portaled to <body> — this table sits inside an
  // overflow-x-auto wrapper (for horizontal scroll on the Excel-style row),
  // which also clips content vertically, so an absolutely-positioned dropdown
  // nested inside it gets cut off / covered by whatever renders below (e.g.
  // the Lines table). Fixed-position + real viewport coords sidesteps that.
  useEffect(() => {
    if (!open) return;
    function updateCoords() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.impaCode?.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [options, query]);

  const isNonCatalogue = !selected;

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="text-sm text-muted-foreground hover:text-foreground">
        + Add Item
      </button>
    );
  }

  return (
    <div className="mb-4 overflow-x-auto rounded-md border border-border">
      <form ref={formRef} action={action}>
        <input type="hidden" name="revisionId" value={revisionId} />
        <input type="hidden" name="itemType" value={selected ? selected.itemType : "NON_CATALOGUE"} />
        {selected && <input type="hidden" name="itemId" value={selected.itemId} />}
        {isNonCatalogue && <input type="hidden" name="nonCatalogueDescription" value={query} />}

        <table className="w-full table-fixed text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">Item Description</th>
              <th className="w-16 px-2 py-2 font-medium">Unit</th>
              <th className="w-12 px-2 py-2 font-medium">ROB</th>
              <th className="w-16 px-2 py-2 font-medium">IMPA</th>
              <th className="w-28 px-2 py-2 font-medium">Remarks</th>
              <th className="w-16 px-2 py-2 font-medium">Req.</th>
              <th className="w-14 px-2 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-2 align-top">
                <div ref={containerRef} className="relative">
                  <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(null);
                      setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="Type to search the catalogue…"
                    required
                    autoComplete="off"
                  />
                  {open &&
                    query.trim() &&
                    coords &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <div
                        ref={dropdownRef}
                        style={{ position: "fixed", top: coords.top, left: coords.left, width: Math.max(coords.width, 448), maxWidth: "80vw" }}
                        className="z-50 max-h-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
                      >
                        {filtered.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No catalogue match — will be added as a Non-Catalogue request.</div>
                        ) : (
                          filtered.map((o) => (
                            <button
                              key={`${o.itemType}:${o.itemId}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelected(o);
                                setQuery(o.label);
                                setOpen(false);
                              }}
                              className={cn("block w-full truncate rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted")}
                            >
                              {o.label}
                              {o.impaCode && <span className="ml-1.5 text-xs text-muted-foreground">({o.impaCode})</span>}
                            </button>
                          ))
                        )}
                      </div>,
                      document.body
                    )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected ? <Badge tone="accent">Catalogue item</Badge> : query.trim() ? <Badge tone="warning">Non-catalogue</Badge> : null}
                </p>
              </td>
              <td className="px-2 py-2 align-top">
                {selected ? (
                  <span className="block truncate text-muted-foreground">{selected.unit}</span>
                ) : (
                  <Input name="unit" placeholder="pc, ltr…" className="w-full px-1.5" />
                )}
              </td>
              <td className="px-2 py-2 align-top tabular-nums text-muted-foreground">{selected ? selected.rob : "—"}</td>
              <td className="px-2 py-2 align-top">
                {selected && selected.impaCode ? (
                  <span className="block truncate font-mono text-xs text-muted-foreground">{selected.impaCode}</span>
                ) : (
                  <Input name="impaCode" placeholder="if known" className="w-full px-1.5 font-mono text-xs" />
                )}
              </td>
              <td className="px-2 py-2 align-top">
                <AutoGrowInput name="remarks" placeholder="Why it's needed…" className="w-full px-1.5" />
              </td>
              <td className="px-2 py-2 align-top">
                <Input name="qtyRequested" type="number" step="any" min={0} required className="w-full px-1.5" />
              </td>
              <td className="px-2 py-2 align-top text-right">
                <Button type="submit" size="icon" disabled={pending} aria-label="Add line" title="Add line" className="text-lg leading-none">
                  {pending ? "…" : "+"}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : <span />}
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}
