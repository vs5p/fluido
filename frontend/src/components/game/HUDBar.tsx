import { motion } from "framer-motion";
import { IconClock } from "@tabler/icons-react";
import { useGame } from "@/store/gameStore";

export function HUDBar({ isDrawer }: { isDrawer: boolean }) {
  const currentRound = useGame((s) => s.currentRound);
  const maxRounds = useGame((s) => s.maxRounds);
  const timer = useGame((s) => s.timer);
  const currentWord = useGame((s) => s.currentWord);
  const maskedWord = useGame((s) => s.maskedWord);
  const gameState = useGame((s) => s.gameState);
  const roundDuration = 60; // default, could come from room config

  const pct = gameState === "drawing" ? Math.max(0, Math.min(1, timer / roundDuration)) : 1;
  const isLow = timer <= 10 && gameState === "drawing";

  const displayWord = isDrawer
    ? currentWord.toUpperCase()
    : maskedWord
      ? maskedWord.toUpperCase()
      : gameState === "word_selection"
        ? "? ? ?"
        : "";

  return (
    <div className="relative" style={{ flex: "0 0 auto" }}>
      <div
        className="flex items-center px-3 gap-3"
        style={{
          height: 40,
          borderBottom: "1px solid var(--separator)",
          background: "rgba(28,28,30,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div className="mac-label-caps">
          Round {currentRound || 1} / {maxRounds}
        </div>

        <div className="flex-1 flex justify-center min-w-0">
          <div
            className="font-mono text-[13px] sm:text-[15px] tracking-[0.2em] sm:tracking-[0.35em] text-primary-mac select-none truncate"
            aria-label={isDrawer ? `Word: ${currentWord}` : "Word"}
          >
            {displayWord}
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 text-[13px] font-medium tabular-nums"
          style={{ color: isLow ? "var(--red)" : "var(--text-secondary)" }}
        >
          <IconClock size={13} />
          {timer}s
        </div>
      </div>

      {/* timer progress strip */}
      <div className="absolute left-0 right-0 bottom-0" style={{ height: 2 }}>
        <motion.div
          style={{
            height: "100%",
            background: isLow ? "var(--red)" : "var(--accent)",
            transformOrigin: "left",
          }}
          animate={{ scaleX: pct }}
          transition={{ duration: 0.9, ease: "linear" }}
        />
      </div>
    </div>
  );
}
