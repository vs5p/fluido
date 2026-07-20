import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconPencil,
  IconEraser,
  IconTrash,
  IconArrowBackUp,
} from "@tabler/icons-react";
import {
  LOGICAL,
  clearCanvas,
  replayStrokes,
  setupCanvas,
  toLogical,
  type StrokeEvent,
  type Tool,
} from "@/lib/canvas";
import {
  emitStrokeStart,
  emitStrokeMove,
  emitStrokeEnd,
  emitCanvasClear,
  emitCanvasUndo,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  onCanvasClear,
  onCanvasUndo,
  onStrokeHistory,
  getSocket,
} from "@/lib/socket";
import { useGame } from "@/store/gameStore";

const COLORS = [
  "#000000",
  "#ffffff",
  "#ff453a",
  "#ff9f0a",
  "#ffd60a",
  "#30d158",
  "#0a84ff",
  "#bf5af2",
  "#8b5a2b",
];

export function CanvasPanel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<StrokeEvent[]>([]);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const gameState = useGame((s) => s.gameState);
  const currentDrawer = useGame((s) => s.currentDrawer);
  const userProfile = useGame((s) => s.userProfile);
  const isConnected = useGame((s) => s.isConnected);
  const players = useGame((s) => s.players);

  const drawerPlayer = players.find((p) => p.id === currentDrawer);
  const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [penSize, setPenSize] = useState(6);
  const [eraserSize, setEraserSize] = useState(12);
  const [activeMenu, setActiveMenu] = useState<"colors" | "sizes" | null>(null);

  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [isPointerOver, setIsPointerOver] = useState(false);
  
  const size = tool === "pen" ? penSize : eraserSize;
  const setSize = (s: number) => {
    if (tool === "pen") setPenSize(s);
    else setEraserSize(s);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobileScreen(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const logical = LOGICAL.desktop;

  // Determine if current user can draw
  const socket = getSocket();
  const canDraw = !!(isConnected && socket && (
    gameState === 'drawing' && currentDrawer === socket.id
  ));

  const isDrawer = !!(socket && currentDrawer === socket.id);

  // Set up canvas + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    console.log("[CanvasPanel] setupCanvas useEffect. canvas:", canvas, "wrap:", wrap);
    if (!canvas || !wrap) {
      console.warn("[CanvasPanel] Setup skipped: canvas or wrap is null.");
      return;
    }
    ctxRef.current = setupCanvas(canvas, logical.w, logical.h);
    console.log("[CanvasPanel] setupCanvas success. ctx:", ctxRef.current);
    clearCanvas(ctxRef.current, logical.w, logical.h);
    replayStrokes(ctxRef.current, strokesRef.current, logical.w, logical.h);

    const ro = new ResizeObserver(() => {
      if (ctxRef.current) {
        replayStrokes(ctxRef.current, strokesRef.current, logical.w, logical.h);
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [logical.w, logical.h]);

  // Subscribe to stroke history on mount
  useEffect(() => {
    const unsubHistory = onStrokeHistory((history) => {
      console.log("[CanvasPanel] Inbound stroke history received. length:", history.length);
      strokesRef.current = history;
      if (ctxRef.current) {
        replayStrokes(ctxRef.current, strokesRef.current, logical.w, logical.h);
      }
    });

    return () => {
      unsubHistory();
    };
  }, [logical.w, logical.h]);



  const inboundLastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Subscribe to inbound strokes
  useEffect(() => {
    console.log("[CanvasPanel] Subscribing to inbound strokes. isConnected:", isConnected);
    const unsubStart = onStrokeStart((s) => {
      console.log("[CanvasPanel] Inbound stroke start:", s);
      strokesRef.current.push(s);
      inboundLastPointRef.current = { x: s.x!, y: s.y! };
      if (ctxRef.current) {
        ctxRef.current.strokeStyle = s.tool === "eraser" ? "#fafaf8" : s.color || "#000";
        ctxRef.current.lineWidth = s.size ?? 4;
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(s.x!, s.y!);
      } else {
        console.warn("[CanvasPanel] Inbound stroke start received but ctx is null!");
      }
    });

    const unsubMove = onStrokeMove((s) => {
      console.log("[CanvasPanel] Inbound stroke move:", s);
      strokesRef.current.push(s);
      if (ctxRef.current && inboundLastPointRef.current) {
        const last = inboundLastPointRef.current;
        const mid = { x: (last.x + s.x!) / 2, y: (last.y + s.y!) / 2 };
        const ctx = ctxRef.current;
        ctx.strokeStyle = s.tool === "eraser" ? "#fafaf8" : s.color || "#000";
        ctx.lineWidth = s.size ?? 4;
        ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
      }
      inboundLastPointRef.current = { x: s.x!, y: s.y! };
    });

    const unsubEnd = onStrokeEnd((s) => {
      console.log("[CanvasPanel] Inbound stroke end:", s);
      strokesRef.current.push(s);
      inboundLastPointRef.current = null;
    });

    const unsubClear = onCanvasClear(() => {
      console.log("[CanvasPanel] Inbound canvas clear received.");
      strokesRef.current = [];
      if (ctxRef.current) {
        clearCanvas(ctxRef.current, logical.w, logical.h);
      }
    });

    const unsubUndo = onCanvasUndo(() => {
      console.log("[CanvasPanel] Inbound canvas undo received.");
      let lastStartIndex = -1;
      const strokes = strokesRef.current;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].type === "start") {
          lastStartIndex = i;
          break;
        }
      }
      if (lastStartIndex !== -1) {
        strokesRef.current = strokes.slice(0, lastStartIndex);
      }
      if (ctxRef.current) {
        replayStrokes(ctxRef.current, strokesRef.current, logical.w, logical.h);
      }
    });

    return () => {
      console.log("[CanvasPanel] Unsubscribing from inbound strokes.");
      unsubStart();
      unsubMove();
      unsubEnd();
      unsubClear();
      unsubUndo();
    };
  }, [logical.w, logical.h, isConnected]);

  // Clear canvas on round/turn transitions
  useEffect(() => {
    if (gameState === 'word_selection' || gameState === 'round_end' || gameState === 'waiting') {
      console.log("[CanvasPanel] Clearing canvas due to gameState transition:", gameState);
      strokesRef.current = [];
      drawingRef.current = false;
      lastPointRef.current = null;
      if (ctxRef.current) {
        clearCanvas(ctxRef.current, logical.w, logical.h);
      }
    }
  }, [gameState, logical.w, logical.h]);

  // -------- Drawing handlers --------
  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !ctxRef.current) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = toLogical(e, e.currentTarget, logical.w, logical.h);
    lastPointRef.current = p;
    const ev: StrokeEvent = {
      type: "start",
      ...p,
      color,
      size: tool === "eraser" ? eraserSize * 3.5 : penSize,
      tool,
      t: Date.now(),
    };
    strokesRef.current.push(ev);
    emitStrokeStart(ev);

    const ctx = ctxRef.current;
    ctx.strokeStyle = tool === "eraser" ? "#fafaf8" : color;
    ctx.lineWidth = tool === "eraser" ? eraserSize * 3.5 : penSize;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !drawingRef.current || !ctxRef.current) return;
    const p = toLogical(e, e.currentTarget, logical.w, logical.h);
    const last = lastPointRef.current!;
    const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
    const ctx = ctxRef.current;
    ctx.strokeStyle = tool === "eraser" ? "#fafaf8" : color;
    ctx.lineWidth = tool === "eraser" ? eraserSize * 3.5 : penSize;
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mid.x, mid.y);
    lastPointRef.current = p;
    const ev: StrokeEvent = {
      type: "move",
      ...p,
      color,
      size: tool === "eraser" ? eraserSize * 3.5 : penSize,
      tool,
      t: Date.now(),
    };
    strokesRef.current.push(ev);
    emitStrokeMove(ev);
  }

  function handleUp() {
    if (!canDraw || !drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const ev: StrokeEvent = { type: "end", t: Date.now() };
    strokesRef.current.push(ev);
    emitStrokeEnd(ev);
  }

  function handleClear() {
    if (!canDraw || !ctxRef.current) return;
    strokesRef.current = [];
    clearCanvas(ctxRef.current, logical.w, logical.h);
    emitCanvasClear();
  }



  return (
    <div
      className="flex flex-col"
      style={{ flex: "1 1 0", minHeight: 0, background: "var(--bg-base)" }}
    >
      {/* Canvas surface */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center p-4 md:p-6 relative"
        style={{ background: "var(--bg-base)" }}
      >
        {/* Waiting overlay when canvas is locked */}
        {!canDraw && gameState !== 'waiting' && gameState !== 'drawing' && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", pointerEvents: "auto" }}
          >
            <div className="text-center px-6 py-4 rounded-lg" style={{ background: "rgba(28,28,30,0.9)", border: "1px solid var(--separator)" }}>
              <div className="text-[14px] text-primary-mac font-medium mb-1">
                {gameState === 'word_selection' && `${drawerName} is choosing a word…`}
                {gameState === 'round_end' && 'Round ended!'}
                {gameState === 'game_end' && 'Game over!'}
                {gameState === 'starting' && 'Game starting…'}
              </div>
              <div className="text-[12px] text-secondary-mac">Please wait</div>
            </div>
          </div>
        )}

        <div
          ref={wrapRef}
          className="w-full h-full flex items-center justify-center relative"
          style={{ cursor: canDraw && tool === "eraser" ? "none" : undefined }}
          onPointerEnter={() => setIsPointerOver(true)}
          onPointerLeave={() => {
            setIsPointerOver(false);
            setPointerPos(null);
          }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPointerPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
        >
          <CanvasInner
            wrapRef={wrapRef}
            canvasRef={canvasRef}
            onDown={handleDown}
            onMove={handleMove}
            onUp={handleUp}
            aspect={logical.w / logical.h}
            canDraw={canDraw}
          />
          {/* Custom Eraser Circle Cursor Overlay */}
          {canDraw && tool === "eraser" && isPointerOver && pointerPos && (
            <div
              className="absolute pointer-events-none rounded-full border border-black/80 bg-white/30 mix-blend-difference shadow-lg"
              style={{
                left: pointerPos.x,
                top: pointerPos.y,
                width: eraserSize * 3.5,
                height: eraserSize * 3.5,
                transform: "translate(-50%, -50%)",
                zIndex: 20,
              }}
            />
          )}
        </div>
      </div>

      {/* Toolbar — drawer only */}
      {canDraw && (
        isMobileScreen ? (
          /* Mobile Custom Floating Toolbar */
          <div className="flex items-center justify-between px-4 h-14 border-t border-white/10 bg-zinc-950/90 backdrop-blur-md relative z-10 shrink-0">
            {/* Pen/Eraser Toggle */}
            <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg">
              <button
                aria-label="Pen"
                onClick={() => { setTool("pen"); setActiveMenu(null); }}
                className={`p-2 rounded-md transition-colors ${tool === "pen" ? "bg-white/10 text-blue-400" : "text-white/60"}`}
              >
                <IconPencil size={18} />
              </button>
              <button
                aria-label="Eraser"
                onClick={() => { setTool("eraser"); setActiveMenu(null); }}
                className={`p-2 rounded-md transition-colors ${tool === "eraser" ? "bg-white/10 text-blue-400" : "text-white/60"}`}
              >
                <IconEraser size={18} />
              </button>
            </div>

            {/* Color Trigger (Tap to Expand) */}
            <button
              onClick={() => setActiveMenu(activeMenu === "colors" ? null : "colors")}
              className="flex items-center gap-2 p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: tool === "eraser" ? "#fafaf8" : color }} />
              <span className="text-xs text-white/80 font-medium">Color</span>
            </button>

            {/* Size Trigger (Tap to Expand) */}
            <button
              onClick={() => setActiveMenu(activeMenu === "sizes" ? null : "sizes")}
              className="flex items-center gap-2 p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
            >
              <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center">
                <span className="rounded-full bg-white" style={{ width: Math.min(size, 10), height: Math.min(size, 10) }} />
              </div>
              <span className="text-xs text-white/80 font-medium">{size}px</span>
            </button>

            {/* Undo Button */}
            <button
              aria-label="Undo last stroke"
              onClick={() => {
                emitCanvasUndo();
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              <IconArrowBackUp size={18} />
            </button>

            {/* Clear Button */}
            <button
              aria-label="Clear canvas"
              onClick={handleClear}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
            >
              <IconTrash size={18} />
            </button>

            {/* Floating Popovers */}
            <AnimatePresence>
              {activeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-16 left-4 right-4 p-3 rounded-xl mac-panel z-20 flex justify-center gap-3 bg-zinc-900/95 shadow-xl border border-white/10"
                >
                  {activeMenu === "colors" && (
                    <div className="grid grid-cols-5 gap-2.5">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          aria-label={`Color ${c}`}
                          onClick={() => {
                            setColor(c);
                            setTool("pen");
                            setActiveMenu(null);
                          }}
                          className="w-8 h-8 rounded-full border border-white/20 transition-transform active:scale-90"
                          style={{
                            background: c,
                            boxShadow: color === c ? "0 0 0 2px var(--accent)" : "none",
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {activeMenu === "sizes" && (
                    <div className="flex items-center gap-4">
                      {[3, 6, 12, 20].map((s) => (
                        <button
                          key={s}
                          aria-label={`Size ${s}`}
                          onClick={() => {
                            setSize(s);
                            setActiveMenu(null);
                          }}
                          className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 active:scale-95"
                          style={{
                            border: size === s ? "2px solid var(--accent)" : "1px solid var(--separator)",
                          }}
                        >
                          <span
                            className="rounded-full bg-white"
                            style={{ width: s, height: s }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Desktop layout */
          <div
            className="flex items-center gap-1.5 px-3 overflow-x-auto"
            style={{
              height: 52,
              borderTop: "1px solid var(--separator)",
              background: "rgba(28,28,30,0.85)",
              backdropFilter: "blur(20px) saturate(180%)",
              flex: "0 0 auto",
            }}
          >
            <button
              aria-label="Pen"
              onClick={() => setTool("pen")}
              className="mac-btn"
              style={{
                minWidth: 44,
                minHeight: 36,
                background: tool === "pen" ? "var(--bg-hover)" : undefined,
              }}
            >
              <IconPencil size={16} />
            </button>
            <button
              aria-label="Eraser"
              onClick={() => setTool("eraser")}
              className="mac-btn"
              style={{
                minWidth: 44,
                minHeight: 36,
                background: tool === "eraser" ? "var(--bg-hover)" : undefined,
              }}
            >
              <IconEraser size={16} />
            </button>

            <div
              className="mx-1 h-7"
              style={{ width: 1, background: "var(--separator)" }}
            />

            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => {
                    setColor(c);
                    setTool("pen");
                  }}
                  className="rounded-full transition-transform"
                  style={{
                    width: 22,
                    height: 22,
                    background: c,
                    border:
                      color === c
                        ? "2px solid var(--accent)"
                        : "1px solid var(--separator-strong)",
                    transform: color === c ? "scale(1.08)" : "scale(1)",
                  }}
                />
              ))}
            </div>

            <div
              className="mx-1 h-7"
              style={{ width: 1, background: "var(--separator)" }}
            />

            <div className="flex items-center gap-1.5">
              {[3, 6, 12, 20].map((s) => (
                <button
                  key={s}
                  aria-label={`Size ${s}`}
                  onClick={() => setSize(s)}
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    background:
                      size === s ? "var(--bg-hover)" : "var(--bg-control)",
                    border: "1px solid var(--separator)",
                  }}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: s,
                      height: s,
                      background: "var(--text-primary)",
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                aria-label="Undo last stroke"
                onClick={emitCanvasUndo}
                className="mac-btn"
                style={{ minHeight: 36 }}
              >
                <IconArrowBackUp size={15} />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                aria-label="Clear canvas"
                onClick={handleClear}
                className="mac-btn"
                style={{ minHeight: 36 }}
              >
                <IconTrash size={15} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function CanvasInner({
  wrapRef,
  canvasRef,
  onDown,
  onMove,
  onUp,
  aspect,
  canDraw,
}: {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onUp: () => void;
  aspect: number;
  canDraw: boolean;
}) {
  return (
    <div
      ref={wrapRef}
      className="w-full h-full flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Drawing canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          touchAction: canDraw ? "none" : "auto",
          background: "var(--canvas-bg)",
          borderRadius: 8,
          border: "1px solid var(--separator)",
          cursor: canDraw ? "crosshair" : "not-allowed",
          width: "100%",
          height: "100%",
          aspectRatio: `${aspect}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          opacity: canDraw ? 1 : 0.95,
        }}
      />
    </div>
  );
}


