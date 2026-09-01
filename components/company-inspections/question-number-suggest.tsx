"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { QuestionnaireSuggestItem } from "@/features/sire-questionnaire/queries";

const STOPWORDS = new Set([
  "the", "was", "were", "and", "for", "with", "that", "this", "did", "does",
  "have", "has", "had", "not", "are", "from", "been", "being", "onboard",
  "vessel", "ship", "any", "all", "there", "their", "when", "what", "which",
  // Defect-report boilerplate — describes HOW a finding reads, not WHAT it's
  // about, so it carries no VIQ-topic signal and only adds noise (a single
  // one-off use of one of these elsewhere in the questionnaire can otherwise
  // outweigh a real subject-matter match like "ecdis" — see the IDF weighting
  // below, which rewards rare words on the assumption rarity means relevance).
  "outdated", "updated", "update", "latest", "current", "version", "versions",
  "release", "found", "noted", "observed", "identified", "line", "date",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

function haystackTokens(item: QuestionnaireSuggestItem): Set<string> {
  return new Set(tokenize(`${item.question} ${item.shortText ?? ""}`));
}

/** How many items a token appears in — used to weight rare, specific words
 * ("ecdis", appearing in only 3 of 273 questions) far above generic ones
 * ("updated", "system", appearing in dozens) that would otherwise swamp the
 * match on raw word-overlap count alone. */
function buildDocFrequency(items: QuestionnaireSuggestItem[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const item of items) {
    for (const t of haystackTokens(item)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return df;
}

/** Deterministic keyword-overlap scoring — no AI/API call, works offline.
 * Weights each matched word by rarity (fewer questions it appears in = more
 * specific = higher weight), so "ecdis" in a finding outranks generic
 * maintenance-adjacent words shared across many questions. A hint, not an
 * authority: the Supt still picks and can ignore every suggestion. */
export function suggestQuestions(
  observationText: string,
  items: QuestionnaireSuggestItem[],
  limit = 5,
): QuestionnaireSuggestItem[] {
  const tokens = tokenize(observationText);
  if (tokens.length === 0 || items.length === 0) return [];
  const df = buildDocFrequency(items);
  const totalItems = items.length;

  const scored = items
    .map((item) => {
      const haystack = haystackTokens(item);
      let score = 0;
      for (const t of tokens) {
        if (haystack.has(t)) score += Math.log(1 + totalItems / (df.get(t) ?? totalItems));
      }
      return { item, score };
    })
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

export function QuestionNumberSuggest({
  observationText,
  items,
  onPick,
}: {
  observationText: string;
  items: QuestionnaireSuggestItem[];
  onPick: (item: QuestionnaireSuggestItem) => void;
}) {
  const suggestions = useMemo(
    () => suggestQuestions(observationText, items),
    [observationText, items],
  );

  // Once the Supt picks a suggestion (or dismisses the box), stop showing it
  // for this text — reopens only if they keep editing the observation.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [observationText]);

  if (items.length === 0 || observationText.trim().length < 8 || suggestions.length === 0 || dismissed) return null;

  return (
    <div className="space-y-1.5 rounded-md border border-accent/20 bg-accent/[0.03] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Suggested SIRE 2.0 questions, based on your finding text — click one to fill Chapter/Question number:
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss suggestions"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s.no}
            type="button"
            onClick={() => {
              onPick(s);
              setDismissed(true);
            }}
            className="block w-full rounded-md border border-accent/30 bg-background px-2.5 py-1.5 text-left text-xs hover:bg-accent/10"
          >
            <span className="font-mono font-semibold text-accent">{s.no}</span>{" "}
            <span className="text-foreground">{s.question}</span>
            {s.shortText && <span className="block text-muted-foreground">{s.shortText}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
