import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconArrowLeft,
  IconCopy,
  IconPlayerPlay,
  IconPlayerSkipForward,
  IconLock,
  IconLockOpen,
  IconRotateDot,
  IconDoorExit,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { TrafficLights } from "@/components/ui-mac/TrafficLights";
import { HUDBar } from "@/components/game/HUDBar";
import { CanvasPanel } from "@/components/canvas/CanvasPanel";
import { ChatSection } from "@/components/chat/ChatSection";
import { PlayerSidebar } from "@/components/game/PlayerSidebar";
import { useGame } from "@/store/gameStore";
import { useRoom } from "@/store/roomStore";
import {
  startGame, skipTurn, lockRoom, unlockRoom,
  chooseWordNew, leaveRoom, getSocket, resetGame,
} from "@/lib/socket";

export function GameScreen({ onLeave }: { onLeave: () => void }) {
  const gameState      = useGame((s) => s.gameState);
  const currentDrawer  = useGame((s) => s.currentDrawer);
  const userProfile    = useGame((s) => s.userProfile);
  const wordChoices    = useGame((s) => s.wordChoices);
  const timer          = useGame((s) => s.timer);
  const startCountdown = useGame((s) => s.startCountdown);
  const roundResults   = useGame((s) => s.roundResults);
  const gameOverData   = useGame((s) => s.gameOverData);
  const players        = useGame((s) => s.players);
  const drawerDeviceStore = useGame((s) => s.drawerDevice);

  const currentRoom       = useRoom((s) => s.currentRoom);
  const storeIsHost       = useRoom((s) => s.isHost);
  const leaveCurrentRoom  = useRoom((s) => s.leaveCurrentRoom);
  const isLocked          = currentRoom?.isLocked ?? false;

  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [showPlayersDrawer, setShowPlayersDrawer] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobileScreen(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsKeyboardOpen(window.innerHeight < 550);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const socket = getSocket();
  // Compute isHost reliably: trust store OR do live socket-id comparison against room hostId
  const isHost   = storeIsHost || !!(socket?.id && currentRoom?.hostId === socket.id);
  const isDrawer = !!(socket && currentDrawer === socket.id);
  const roomCode = currentRoom?.code ?? "";
  const drawerDevice = drawerDeviceStore;
  const drawerPlayer = players.find((p) => p.id === currentDrawer);
  const drawerName = drawerPlayer ? drawerPlayer.name : "Drawer";

  function handleLeave() {
    leaveRoom();          // tell backend
    leaveCurrentRoom();   // clear local store immediately
    onLeave();            // navigate (if parent provides it)
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
  }

  return (
    <div
      className="game-screen flex flex-col"
      style={{
        height: "100dvh",
        background: "var(--bg-base)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center"
        style={{
          borderBottom: "1px solid var(--separator)",
          background: "rgba(28,28,30,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          flex: "0 0 auto",
        }}
      >
        <button onClick={handleLeave} className="flex items-center gap-1.5 pl-3 pr-2 py-2 text-secondary-mac hover:text-primary-mac text-[12px]" aria-label="Back">
          <IconArrowLeft size={14} />
        </button>
        <div className="hidden sm:block">
          <TrafficLights />
        </div>
        <div className="flex-1 text-center text-[12px] text-tertiary-mac py-2 truncate max-w-[120px] sm:max-w-none">
          {currentRoom?.name ?? "Fluido"}
          {roomCode && (
            <button onClick={copyCode} className="ml-2 inline-flex items-center gap-1 text-primary-mac font-mono tracking-[0.2em] hover:text-[var(--accent)] transition-colors">
              {roomCode} <IconCopy size={11} />
            </button>
          )}
        </div>
        {/* Players list toggle for mobile */}
        <button
          onClick={() => setShowPlayersDrawer(true)}
          className="flex md:hidden items-center gap-1.5 px-3 py-2 text-secondary-mac hover:text-primary-mac text-[12px]"
          aria-label="View players"
        >
          <IconUsers size={15} />
          <span className="font-semibold text-xs">{players.length}</span>
        </button>
        {/* Host controls */}
        {isHost && (
          <div className="flex items-center gap-1 pr-3">
            {gameState === "waiting" && (
              <button
                onClick={() => startGame()}
                className="mac-btn text-[11px] gap-1"
                style={{ minHeight: 28 }}
              >
                <IconPlayerPlay size={13} /> Start
              </button>
            )}
            {(gameState === "drawing" || gameState === "word_selection") && (
              <button onClick={() => skipTurn()} className="mac-btn text-[11px] gap-1" style={{ minHeight: 28 }}>
                <IconPlayerSkipForward size={13} /> Skip
              </button>
            )}
            <button
              onClick={() => isLocked ? unlockRoom() : lockRoom()}
              className="mac-btn text-[11px] gap-1"
              style={{ minHeight: 28 }}
            >
              {isLocked ? <IconLockOpen size={13} /> : <IconLock size={13} />}
            </button>
          </div>
        )}
      </div>

      {/* HUD */}
      {gameState !== "waiting" && gameState !== "starting" && (
        <HUDBar isDrawer={isDrawer} />
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 relative flex flex-col md:flex-row">
        {/* Canvas */}
        <div
          className="flex flex-col min-h-0 animate-fade-in w-full"
          style={{ flex: "1 1 0%" }}
        >
          <CanvasPanel />
        </div>

        {/* Right panel */}
        <div
          className="flex flex-col min-h-0 md:w-[300px]"
          style={{
            borderTop: "1px solid var(--separator)",
            background: "rgba(28,28,30,0.85)",
            backdropFilter: "blur(20px) saturate(180%)",
            height: isMobileScreen ? (isKeyboardOpen ? 140 : 200) : undefined,
            flex: isMobileScreen ? `0 0 ${isKeyboardOpen ? 140 : 200}px` : undefined,
          }}
        >
          {!isMobileScreen && (
            <div style={{ borderLeft: "1px solid var(--separator)" }}>
              <PlayerSidebar />
            </div>
          )}
          <ChatSection isDrawer={isDrawer} />
        </div>

        {/* ── Overlays ── */}

        {/* Waiting lobby overlay */}
        <AnimatePresence>
          {gameState === "waiting" && (
            <WaitingOverlay players={players} isHost={isHost} roomCode={roomCode} />
          )}
        </AnimatePresence>

        {/* Game-starting countdown overlay */}
        <AnimatePresence>
          {gameState === "starting" && startCountdown != null && (
            <CountdownOverlay count={startCountdown} label="Game starts in" />
          )}
        </AnimatePresence>

        {/* Word selection overlay */}
        <AnimatePresence>
          {gameState === "word_selection" && (
            isDrawer
              ? <WordChoiceOverlay choices={wordChoices} timer={timer} onPick={chooseWordNew} />
              : <WaitingForDrawerOverlay drawerName={drawerName} />
          )}
        </AnimatePresence>

        {/* Round results overlay */}
        <AnimatePresence>
          {gameState === "round_end" && (
            <RoundResultsOverlay data={roundResults ?? { word: '', results: [] }} timer={timer} />
          )}
        </AnimatePresence>

        {/* Game over overlay */}
        <AnimatePresence>
          {gameState === "game_end" && (
            <GameOverOverlay data={gameOverData ?? { standings: [] }} onLeave={handleLeave} isHost={isHost} />
          )}
        </AnimatePresence>

        {/* Mobile players list drawer */}
        <AnimatePresence>
          {showPlayersDrawer && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPlayersDrawer(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              />
              {/* Drawer Content */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 z-50 w-[260px] bg-zinc-950 border-l border-white/10 flex flex-col md:hidden shadow-2xl pt-10"
              >
                <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 shrink-0">
                  <span className="font-bold text-sm">Room Players</span>
                  <button
                    onClick={() => setShowPlayersDrawer(false)}
                    className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                  >
                    <IconX size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <PlayerSidebar limitHeight={false} />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-overlays ────────────────────────────────────────────────────────────

function WaitingOverlay({ players, isHost, roomCode }: { players: any[]; isHost: boolean; roomCode: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", pointerEvents: "auto" }}
    >
      <div className="text-center max-w-md w-full px-6">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="text-5xl mb-4">🎨</div>
          <h2 className="text-[24px] font-bold text-primary-mac mb-2">Waiting for players…</h2>
          <p className="text-secondary-mac text-[14px] mb-6">
            Need at least 1 player to start.
          </p>

          <div className="mb-6 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--separator)" }}>
            <p className="text-tertiary-mac text-[11px] mb-1">ROOM CODE</p>
            <p className="text-primary-mac font-mono text-[24px] tracking-[0.4em]">{roomCode}</p>
          </div>

          <div className="space-y-2 mb-6 max-h-[160px] overflow-y-auto pr-1">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: stringToColor(p.name) }}>
                  {p.picture ? <img src={p.picture} alt={p.name} className="w-full h-full rounded-full object-cover" /> : p.name[0]?.toUpperCase()}
                </div>
                <span className="text-primary-mac text-[14px] flex-1 text-left">{p.name}</span>
                {p.isHost && <span className="text-yellow-400 text-[11px]">HOST</span>}
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-tertiary-mac text-[13px]">No players yet…</p>
            )}
          </div>

          {isHost && players.length >= 1 && (
            <button onClick={() => startGame()} className="mac-btn mac-btn-primary w-full justify-center" style={{ minHeight: 44 }}>
              Start Game ({players.length} players)
            </button>
          )}
          {players.length < 1 && (
            <p className="text-tertiary-mac text-[12px]">Share the room code above to invite friends!</p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

function CountdownOverlay({ count, label }: { count: number; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", pointerEvents: "auto" }}
    >
      <div className="text-center">
        <p className="text-secondary-mac text-[16px] mb-4">{label}</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[100px] font-bold"
            style={{ color: count <= 1 ? "var(--red)" : count === 2 ? "var(--yellow)" : "var(--green)" }}
          >
            {count}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function WordChoiceOverlay({ choices, timer, onPick }: { choices: string[]; timer: number; onPick: (w: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)", pointerEvents: "auto" }}
    >
      <div className="text-center max-w-lg w-full px-6">
        <p className="text-secondary-mac text-[14px] mb-2">Choose a word to draw</p>
        <p className="text-tertiary-mac text-[12px] mb-6">{timer}s remaining</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-xs sm:max-w-none mx-auto">
          {choices.map((word) => (
            <motion.button
              key={word}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(word)}
              className="p-4 rounded-xl text-primary-mac font-semibold text-[15px] capitalize"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}
            >
              {word}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function WaitingForDrawerOverlay({ drawerName }: { drawerName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)", pointerEvents: "auto" }}
    >
      <div className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="text-4xl mb-4">✏️</motion.div>
        <p className="text-primary-mac text-[18px] font-semibold">{drawerName} is choosing a word…</p>
        <p className="text-secondary-mac text-[13px] mt-2">Get ready to guess!</p>
      </div>
    </motion.div>
  );
}

function RoundResultsOverlay({ data, timer }: { data: any; timer: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)", pointerEvents: "auto" }}
    >
      <div className="text-center max-w-md w-full px-6">
        <div className="text-4xl mb-3">🎯</div>
        <h2 className="text-[22px] font-bold text-primary-mac mb-1">Round Over!</h2>
        <p className="text-secondary-mac text-[14px] mb-2">
          The word was: <span className="text-primary-mac font-bold capitalize">{data.word}</span>
        </p>
        <p className="text-tertiary-mac text-[12px] mb-5">Next round in {timer}s</p>
        <div className="space-y-2">
          {data.results?.slice(0, 5).map((r: any, i: number) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span className="text-[13px] text-tertiary-mac w-4">{i + 1}</span>
              <span className="flex-1 text-primary-mac text-[14px] text-left">{r.name}</span>
              {r.pointsGained > 0 && (
                <span className="text-[13px]" style={{ color: "var(--green)" }}>+{r.pointsGained}</span>
              )}
              <span className="text-[13px] text-secondary-mac tabular-nums">{r.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function GameOverOverlay({ data, onLeave, isHost }: { data: any; onLeave: () => void; isHost: boolean }) {
  const standings = data.standings || [];
  const first = standings[0];
  const second = standings[1];
  const third = standings[2];
  const rest = standings.slice(3);

  function handlePlayAgain() {
    startGame();
  }

  function handleReturnToLobby() {
    resetGame();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6"
      style={{ background: "rgba(10,10,12,0.95)", backdropFilter: "blur(16px)", pointerEvents: "auto" }}
    >
      <div className="max-w-2xl w-full flex flex-col items-center">
        {/* Title */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-2" style={{ background: "rgba(255,215,0,0.1)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.2)" }}>
            🏆 Match Completed
          </div>
          <h2 className="text-4xl font-extrabold text-primary-mac tracking-tight">Leaderboard</h2>
        </motion.div>

        {/* Podium Animation */}
        <div className="flex items-end justify-center gap-4 w-full max-w-lg mb-10 h-[220px]">
          {/* 2nd Place */}
          {second && (
            <div className="flex flex-col items-center flex-1">
              <motion.div
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", delay: 0.6 }}
                className="text-center mb-2"
              >
                <div className="text-xl">🥈</div>
                <div className="font-bold text-sm text-primary-mac truncate max-w-[100px]">{second.name}</div>
                <div className="text-xs text-secondary-mac font-semibold">{second.score} pts</div>
              </motion.div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 100 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                className="w-full rounded-t-xl flex items-center justify-center font-bold text-lg text-primary-mac"
                style={{
                  background: "linear-gradient(180deg, rgba(192,192,192,0.25) 0%, rgba(192,192,192,0.05) 100%)",
                  border: "1px solid rgba(192,192,192,0.3)",
                  borderBottom: "none"
                }}
              >
                2
              </motion.div>
            </div>
          )}

          {/* 1st Place */}
          {first && (
            <div className="flex flex-col items-center flex-1 z-10">
              <motion.div
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", delay: 0.4 }}
                className="text-center mb-2"
              >
                <div className="text-3xl animate-bounce">👑</div>
                <div className="font-extrabold text-base text-yellow-400 truncate max-w-[120px]">{first.name}</div>
                <div className="text-xs text-yellow-500 font-bold">{first.score} pts</div>
              </motion.div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 140 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                className="w-full rounded-t-xl flex items-center justify-center font-bold text-2xl text-yellow-400"
                style={{
                  background: "linear-gradient(180deg, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0.08) 100%)",
                  border: "1px solid rgba(255,215,0,0.45)",
                  borderBottom: "none",
                  boxShadow: "0 0 20px rgba(255,215,0,0.15)"
                }}
              >
                1
              </motion.div>
            </div>
          )}

          {/* 3rd Place */}
          {third && (
            <div className="flex flex-col items-center flex-1">
              <motion.div
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", delay: 0.8 }}
                className="text-center mb-2"
              >
                <div className="text-xl">🥉</div>
                <div className="font-bold text-sm text-primary-mac truncate max-w-[100px]">{third.name}</div>
                <div className="text-xs text-secondary-mac font-semibold">{third.score} pts</div>
              </motion.div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 70 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                className="w-full rounded-t-xl flex items-center justify-center font-bold text-sm text-primary-mac"
                style={{
                  background: "linear-gradient(180deg, rgba(205,127,50,0.2) 0%, rgba(205,127,50,0.05) 100%)",
                  border: "1px solid rgba(205,127,50,0.25)",
                  borderBottom: "none"
                }}
              >
                3
              </motion.div>
            </div>
          )}
        </div>

        {/* Runner ups */}
        {rest.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="w-full max-w-md rounded-xl border border-separator p-3 mb-8 max-h-[160px] overflow-y-auto"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="text-tertiary-mac text-[10px] font-bold uppercase tracking-wider mb-2 px-1">Runner ups</div>
            <div className="space-y-1.5">
              {rest.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="text-tertiary-mac font-semibold w-4">{i + 4}</span>
                    <span className="text-secondary-mac font-medium">{p.name}</span>
                  </div>
                  <span className="text-tertiary-mac font-mono">{p.score} pts</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="flex flex-col gap-3 w-full max-w-md"
        >
          {isHost ? (
            <div className="flex gap-3">
              <button
                onClick={handlePlayAgain}
                className="mac-btn mac-btn-primary flex-1 justify-center py-3 text-sm gap-2"
                style={{ height: 44 }}
              >
                <IconRotateDot size={18} /> Play Again
              </button>
              <button
                onClick={handleReturnToLobby}
                className="mac-btn flex-1 justify-center py-3 text-sm gap-2"
                style={{ height: 44, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Return to Lobby
              </button>
            </div>
          ) : (
            <div className="text-center py-3 px-4 rounded-lg bg-white/5 border border-separator text-xs text-secondary-mac mb-2">
              ⏳ Waiting for the Host to restart the match…
            </div>
          )}
          <button
            onClick={onLeave}
            className="mac-btn w-full justify-center text-xs gap-1.5 text-tertiary-mac hover:text-red-400 transition-colors"
            style={{ height: 36, background: "transparent", border: "none" }}
          >
            <IconDoorExit size={14} /> Exit Room
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}
