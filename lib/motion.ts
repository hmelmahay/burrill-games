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
// A tab that reloads a phase it already played shows it final once the room's
// beats are behind it (`holdMs`, the game's latest phone beat plus slack).
// Before that it replays:  showing it final would put this phone's result on
// screen ahead of the host's payoff.
// phaseKey: `${room.round_idx}:${room.phase}`, or "" while the room loads.
export function useStaged(phaseKey: string, startedAt?: string | null, holdMs: number = FX.reloadHold): boolean {
  const id = phaseKey && startedAt ? `${phaseKey}@${startedAt}` : "";
  const [s, setS] = useState(() => ({ key: phaseKey, staged: decide(false, startedAt, id, holdMs) }));
  let staged = s.staged;
  if (s.key !== phaseKey) {
    const next = { key: phaseKey, staged: decide(s.key !== "", startedAt, id, holdMs) };
    setS(next);
    staged = next.staged;
  }
  // Marked after commit, not during render, so a render React throws away
  // can't mark a phase that never played.
  useEffect(() => {
    if (staged && id) markPlayed(id);
  }, [staged, id]);
  return staged;
}

function decide(live: boolean, startedAt: string | null | undefined, id: string, holdMs: number): boolean {
  if (!startedAt) return true;
  const age = Date.now() - Date.parse(startedAt);
  if (!Number.isFinite(age)) return true;
  if (age >= (live ? FX.liveMs : FX.freshMs)) return false;
  if (live || !id || !playedHere(id)) return true;
  return age < holdMs;
}

// Phases this tab has staged, newest last.  sessionStorage survives a reload of
// the same tab and nothing else, which is exactly the case to catch.
const PLAYED = "fx-played";
function playedHere(id: string): boolean {
  try {
    return (sessionStorage.getItem(PLAYED) ?? "").split("|").includes(id);
  } catch {
    return false;
  }
}
function markPlayed(id: string): void {
  try {
    const list = (sessionStorage.getItem(PLAYED) ?? "").split("|").filter(Boolean);
    if (list.includes(id)) return;
    sessionStorage.setItem(PLAYED, [...list, id].slice(-30).join("|"));
  } catch {}
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
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  const shownKey = shown.join(",");
  useEffect(() => {
    lastOrders.set(opts.cacheKey, shown);
    if (shownKey === key) {
      settledOnce.current = true;
      return;
    }
    let wait = settledOnce.current || !opts.staged ? FX.settle : opts.startDelay + FX.mountSettle;
    // A score that lands while a fresh board is still hidden waits until the
    // board has been on screen a beat, so the room still sees the slide.
    if (opts.staged && mountedAt.current != null) {
      wait = Math.max(wait, mountedAt.current + opts.startDelay + FX.mountSettle - Date.now());
    }
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
    // Tops are measured from the list itself.  offsetTop alone is measured from
    // the offsetParent, which changes while a phase block's entrance transform
    // runs, and that made every row jump by the block's offset.
    const reads = rows.map((el) => {
      let offset = 0;
      if (prevTops.current && canMatrix) {
        const t = getComputedStyle(el).transform;
        if (t && t !== "none") offset = new DOMMatrixReadOnly(t).m42;
      }
      const top = el.offsetParent === list ? el.offsetTop : el.offsetTop - list.offsetTop;
      return { el, id: el.dataset.flipId ?? "", top, offset };
    });
    const prev = prevTops.current;
    prevTops.current = new Map(reads.map((r) => [r.id, r.top]));
    if (!prev || prefersReducedMotion()) return;
    for (const r of reads) {
      const before = prev.get(r.id);
      if (before == null || typeof r.el.animate !== "function") continue;
      const delta = before + r.offset - r.top;
      // Cancel first:  a row whose net move is zero must not keep playing an
      // older slide against its new spot.
      r.el.getAnimations?.().forEach((a) => a.cancel());
      if (Math.abs(delta) < 1) continue;
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
