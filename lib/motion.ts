"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FX } from "./fx";

// --- reduced motion -------------------------------------------------------

// True when the OS asks for less motion, or the page was opened with
// ?motion=reduce (app/layout.tsx adds html.fx-rm for QA on any device).
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (document.documentElement.classList.contains("fx-rm")) return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// --- staging ---------------------------------------------------------------

// Should this screen play the staged version of the current phase? Yes when it
// watched the phase change happen (within 8s, covering the 5s backstop poll),
// or when it first loads within 4s of the phase starting. A refreshed phone or
// a TV that joins late gets the final screen at once instead of a replay.
// phaseKey: `${room.round_idx}:${room.phase}`, or "" while the room loads.
export function useStaged(phaseKey: string, startedAt?: string | null): boolean {
  const [s, setS] = useState(() => ({ key: phaseKey, staged: decide(false, startedAt) }));
  if (s.key !== phaseKey) {
    const next = { key: phaseKey, staged: decide(s.key !== "", startedAt) };
    setS(next);
    return next.staged;
  }
  return s.staged;
}

function decide(live: boolean, startedAt?: string | null): boolean {
  if (!startedAt) return true;
  const age = Date.now() - Date.parse(startedAt);
  if (!Number.isFinite(age)) return true;
  return age < (live ? FX.liveMs : FX.freshMs);
}

// Reveal timing travels down the tree: `delay` is how long the nearest
// <Reveal> wrapper stays hidden, so nested counters and confetti wait for it.
export type RevealTiming = { delay: number; staged: boolean };
export const RevealContext = createContext<RevealTiming>({ delay: 0, staged: true });
export function useRevealTiming(): RevealTiming {
  return useContext(RevealContext);
}

// True once `ms` has passed (immediately for ms <= 0).
export function useAfter(ms: number, enabled = true): boolean {
  const [done, setDone] = useState(enabled && ms <= 0);
  useEffect(() => {
    if (!enabled) {
      setDone(false);
      return;
    }
    if (ms <= 0) {
      setDone(true);
      return;
    }
    setDone(false);
    const t = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(t);
  }, [ms, enabled]);
  return done;
}

// --- scores ------------------------------------------------------------------

// Last score this device displayed, per player id. Count-ups start here, so the
// order in which score and phase events arrive never matters.
export const shownScores = new Map<string, number>();

// Leaderboard order that waits for score events to stop before re-sorting
// (FX.settle), and on mount first shows the order this device showed last time
// (FX.mountSettle after the reveal delay), so the room sees who passed whom.
const lastOrders = new Map<string, string[]>();

export function useSettledOrder(
  ids: string[],
  opts: { cacheKey: string; staged: boolean; startDelay: number },
): string[] {
  const key = ids.join(",");
  const [shown, setShown] = useState<string[]>(() => {
    if (!opts.staged || prefersReducedMotion()) return ids;
    const prev = lastOrders.get(opts.cacheKey);
    return prev && sameMembers(prev, ids) ? prev : ids;
  });
  const settledOnce = useRef(false);
  const shownKey = shown.join(",");
  useEffect(() => {
    lastOrders.set(opts.cacheKey, shown);
    if (shownKey === key) {
      settledOnce.current = true;
      return;
    }
    const wait = settledOnce.current || !opts.staged ? FX.settle : opts.startDelay + FX.mountSettle;
    const t = setTimeout(() => {
      settledOnce.current = true;
      setShown(ids);
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, shownKey, opts.cacheKey]);
  return reconcile(shown, ids);
}

function sameMembers(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function reconcile(shown: string[], ids: string[]): string[] {
  const out = shown.filter((id) => ids.includes(id));
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

// FLIP: rows (children of `listRef` with data-flip-id) slide from where they
// were to where they are now, using transform only. Reads every row before
// writing any, and picks up from the current spot if a slide is interrupted.
export function useFlip(listRef: RefObject<HTMLElement | null>, orderKey: string): void {
  const prevTops = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = Array.from(list.children) as HTMLElement[];
    const canMatrix = typeof DOMMatrixReadOnly !== "undefined";
    const reads = rows.map((el) => {
      let offset = 0;
      if (prevTops.current && canMatrix) {
        const t = getComputedStyle(el).transform;
        if (t && t !== "none") offset = new DOMMatrixReadOnly(t).m42;
      }
      return { el, id: el.dataset.flipId ?? "", top: el.offsetTop, offset };
    });
    const prev = prevTops.current;
    prevTops.current = new Map(reads.map((r) => [r.id, r.top]));
    if (!prev || prefersReducedMotion()) return;
    for (const r of reads) {
      const before = prev.get(r.id);
      if (before == null || typeof r.el.animate !== "function") continue;
      const delta = before + r.offset - r.top;
      if (Math.abs(delta) < 1) continue;
      r.el.getAnimations?.().forEach((a) => a.cancel());
      r.el.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
        duration: FX.flip,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);
}

// --- one-off motion from event handlers or small visual components -----------

export function playKeyframes(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): void {
  if (!el || prefersReducedMotion()) return;
  const h = el as HTMLElement;
  if (typeof h.animate !== "function") return;
  h.animate(frames, opts);
}

export function playShake(el: Element | null | undefined): void {
  playKeyframes(
    el,
    [
      { transform: "none" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(2px)" },
      { transform: "none" },
    ],
    { duration: 320, easing: "ease-out" },
  );
}
