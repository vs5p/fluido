// Canvas math helpers — logical coordinate space + DPR sharpness.

export type Tool = "pen" | "eraser";
export type StrokeEvent = {
  type: "start" | "move" | "end" | "clear";
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  tool?: Tool;
  t: number;
};

export const LOGICAL = {
  desktop: { w: 800, h: 600 },
  mobile: { w: 390, h: 760 },
};

export function toLogical(
  e: { clientX: number; clientY: number },
  canvasEl: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * logicalW,
    y: ((e.clientY - rect.top) / rect.height) * logicalH,
  };
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return ctx;
}

export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  logicalW: number,
  logicalH: number,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  ctx.fillStyle = "#fafaf8";
  ctx.fillRect(0, 0, logicalW, logicalH);
}

export function replayStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: StrokeEvent[],
  logicalW: number,
  logicalH: number,
) {
  clearCanvas(ctx, logicalW, logicalH);
  let last: StrokeEvent | null = null;
  for (const s of strokes) {
    if (s.type === "clear") {
      clearCanvas(ctx, logicalW, logicalH);
      last = null;
      continue;
    }
    if (s.type === "start") {
      ctx.beginPath();
      ctx.moveTo(s.x!, s.y!);
      ctx.strokeStyle = s.tool === "eraser" ? "#fafaf8" : s.color || "#000";
      ctx.lineWidth = s.size ?? 4;
      last = s;
      continue;
    }
    if (s.type === "move" && last) {
      const mid = { x: (last.x! + s.x!) / 2, y: (last.y! + s.y!) / 2 };
      ctx.quadraticCurveTo(last.x!, last.y!, mid.x, mid.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      last = s;
    }
    if (s.type === "end") last = null;
  }
}
