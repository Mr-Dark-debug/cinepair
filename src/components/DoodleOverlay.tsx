import React, { useEffect, useRef, useState } from "react";
import { Brush, Eraser, X, Heart } from "lucide-react";
import { useSocket } from "../hooks/useSocket";

// Lightweight couple doodle layer over the Stage.
// Strokes stay local for zero-lag drawing; a "Send 💘" button snapshots
// the doodle into chat (via screenshot relay) so both partners keep it.
export const DoodleOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#EC646C");
  const [width, setWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const socketService = useSocket();

  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const r = wrap.getBoundingClientRect();
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      if (canvas.width > 0) tmp.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
      const ctx = canvas.getContext("2d");
      if (ctx && tmp.width > 0) ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const strokeTo = (p: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const last = lastRef.current || p;
    ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = isEraser ? width * 3 : width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const sendDoodle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const data = canvas.toDataURL("image/png");
      socketService.shareScreenshot(data);
    } catch { /* noop */ }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 z-[60]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drawingRef.current = true;
          lastRef.current = pos(e);
          strokeTo(pos(e));
        }}
        onPointerMove={(e) => { if (drawingRef.current) strokeTo(pos(e)); }}
        onPointerUp={() => { drawingRef.current = false; lastRef.current = null; }}
        onPointerLeave={() => { drawingRef.current = false; lastRef.current = null; }}
      />
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-canvas/95 border-2 border-ink rounded-full px-3 py-1.5 shadow-soft">
        {["#EC646C", "#FF6F61", "#B0D19A", "#6FA8DC", "#1C1C1C", "#DAA520"].map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setIsEraser(false); }}
            className={`w-5 h-5 rounded-full border-2 cursor-pointer ${color === c && !isEraser ? "border-ink scale-110" : "border-transparent"}`}
            style={{ background: c }}
            title={c}
          />
        ))}
        <input type="range" min={2} max={14} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-16 accent-ink" title="Brush size" />
        <button onClick={() => setIsEraser(false)} className={`p-1.5 rounded-full cursor-pointer ${!isEraser ? "bg-block-lime" : ""}`} title="Brush"><Brush className="w-3.5 h-3.5" /></button>
        <button onClick={() => setIsEraser(true)} className={`p-1.5 rounded-full cursor-pointer ${isEraser ? "bg-block-lime" : ""}`} title="Eraser"><Eraser className="w-3.5 h-3.5" /></button>
        <button onClick={clear} className="text-[9px] font-black uppercase px-2 cursor-pointer" title="Clear">Clear</button>
        <button onClick={sendDoodle} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-ink text-canvas text-[9px] font-black cursor-pointer" title="Send doodle to chat"><Heart className="w-3 h-3" /> Send</button>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface-soft cursor-pointer" title="Close doodle"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
};
