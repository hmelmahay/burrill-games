"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// Live-synced sketchpad. The drawer streams normalized stroke segments over a
// Supabase broadcast channel; everyone else replays them onto their own canvas.
type Seg = { x0: number; y0: number; x1: number; y1: number; c: string; w: number };

const COLORS = ["#111111", "#e21b3c", "#1368ce", "#26890c"];
const ERASER = "#ffffff";

export function DoodleCanvas({
  code,
  roundIdx,
  canDraw,
}: {
  code: string;
  roundIdx: number;
  canDraw: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const colorRef = useRef(color);
  colorRef.current = color;

  function ctx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function drawSeg(s: Seg) {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    const W = canvas.width;
    const H = canvas.height;
    c.strokeStyle = s.c;
    c.lineWidth = s.w * W;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(s.x0 * W, s.y0 * H);
    c.lineTo(s.x1 * W, s.y1 * H);
    c.stroke();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, canvas.width, canvas.height);
  }

  // One broadcast channel per room; reset the canvas each new round.
  useEffect(() => {
    clearCanvas();
    const ch = supabase.channel(`doodle-${code}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "seg" }, ({ payload }) => drawSeg(payload as Seg))
      .on("broadcast", { event: "clear" }, () => clearCanvas())
      .subscribe();
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, roundIdx]);

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function down(e: React.PointerEvent) {
    if (!canDraw) return;
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    drawingRef.current = true;
    lastRef.current = pos(e);
  }

  function move(e: React.PointerEvent) {
    if (!canDraw || !drawingRef.current || !lastRef.current) return;
    e.preventDefault();
    const p = pos(e);
    const last = lastRef.current;
    if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 0.004) return;
    const seg: Seg = {
      x0: last.x,
      y0: last.y,
      x1: p.x,
      y1: p.y,
      c: colorRef.current,
      w: colorRef.current === ERASER ? 0.06 : 0.012,
    };
    drawSeg(seg);
    lastRef.current = p;
    chRef.current?.send({ type: "broadcast", event: "seg", payload: seg });
  }

  function up() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function sendClear() {
    clearCanvas();
    chRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={`w-full aspect-[4/3] rounded-xl bg-white ${
          canDraw ? "touch-none cursor-crosshair" : ""
        }`}
      />
      {canDraw && (
        <div className="flex gap-2 items-center">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`pen ${c}`}
              className={`w-9 h-9 rounded-full border-2 ${
                color === c ? "border-glow scale-110" : "border-line"
              }`}
              style={{ background: c }}
            />
          ))}
          <button
            onClick={() => setColor(ERASER)}
            className={`w-9 h-9 rounded-full border-2 bg-white text-black text-xs font-bold ${
              color === ERASER ? "border-glow scale-110" : "border-line"
            }`}
          >
            ⌫
          </button>
          <button
            onClick={sendClear}
            className="ml-auto rounded-lg border border-line px-3 py-2 text-sm text-fog"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
