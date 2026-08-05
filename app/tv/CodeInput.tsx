"use client";

import { useEffect, useRef } from "react";

// /tv self-refreshes every few seconds; a half-typed code must survive that.
const DRAFT_KEY = "tv-code-draft";

function saveDraft(code: string) {
  try {
    if (code) sessionStorage.setItem(DRAFT_KEY, code);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}

// Enhancement only: uppercases as you type, auto-submits the surrounding form
// on the 4th character, and restores an in-progress code after the page's
// self-refresh. The form itself is a plain GET to /tv/go, so if this never
// hydrates (old TV browsers), typing + the submit button still work — those
// TVs just lose any half-typed code when the refresh lands.
export default function CodeInput({ initialCode }: { initialCode: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.value) return;
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) {
        el.value = draft;
        el.focus();
        el.setSelectionRange(draft.length, draft.length);
      }
    } catch {}
  }, []);
  return (
    <input
      ref={ref}
      name="code"
      defaultValue={initialCode}
      onChange={(e) => {
        const c = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        e.target.value = c;
        if (c.length === 4) {
          saveDraft("");
          e.target.form?.requestSubmit();
        } else {
          saveDraft(c);
        }
      }}
      placeholder="CODE"
      maxLength={4}
      autoFocus
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      className="rounded-xl border-2 border-glow bg-card px-4 py-5 text-center text-4xl font-mono tracking-[0.3em] uppercase placeholder:text-fog/40 w-64"
    />
  );
}
