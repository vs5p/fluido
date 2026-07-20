import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconSend2, IconSparkles, IconX } from "@tabler/icons-react";
import { useGame, type ChatMessage } from "@/store/gameStore";
import { sendMessage } from "@/lib/socket";

export function ChatSection({ isDrawer }: { isDrawer: boolean }) {
  const messages = useGame((s) => s.messages);
  const gameState = useGame((s) => s.gameState);
  const players = useGame((s) => s.players);
  const currentDrawer = useGame((s) => s.currentDrawer);
  const userProfile = useGame((s) => s.userProfile);

  const [text, setText] = useState("");
  const [showPlayersPopup, setShowPlayersPopup] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isKeyboardOpen]);

  useEffect(() => {
    const handleResize = () => {
      setIsKeyboardOpen(window.innerHeight < 550);
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const canType = !isDrawer && gameState !== "waiting" && gameState !== "starting";
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !canType) return;
    sendMessage(text.trim());
    setText("");
  }

  return (
    <div className="flex flex-col min-h-0" style={{ flex: "1 1 0" }}>
      {!isKeyboardOpen && (
        <div className="px-4 py-2 mac-label-caps flex justify-between items-center" style={{ borderBottom: "1px solid var(--separator)" }}>
          <span>Chat</span>
          <button
            onClick={() => setShowPlayersPopup(true)}
            className="md:hidden text-[10px] text-blue-400 font-semibold uppercase tracking-wider hover:underline"
          >
            Players ({players.length})
          </button>
        </div>
      )}

      {/* Horizontal scrollable players list on mobile */}
      {!isKeyboardOpen && (
        <div className="md:hidden flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/[0.02] gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 flex-1 pr-2 no-scrollbar">
            {sortedPlayers.map((p) => {
              const isPlayerDrawer = p.id === currentDrawer;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full pl-0.5 pr-2 py-0.5 shrink-0"
                  style={{
                    borderColor: p.hasGuessed
                      ? "rgba(48,209,88,0.3)"
                      : isPlayerDrawer
                      ? "rgba(10,132,255,0.3)"
                      : "rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    className="relative w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{
                      background: stringToColor(p.name),
                    }}
                  >
                    {p.picture ? (
                      <img src={p.picture} alt={p.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      p.name[0]?.toUpperCase()
                    )}
                    {isPlayerDrawer && (
                      <span className="absolute -bottom-1 -right-1 text-[7px] bg-blue-500 rounded-full flex items-center justify-center w-2.5 h-2.5">
                        ✏️
                      </span>
                    )}
                    {p.hasGuessed && !isPlayerDrawer && (
                      <span className="absolute -bottom-1 -right-1 text-[7px] bg-green-500 rounded-full flex items-center justify-center w-2.5 h-2.5">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-secondary-mac truncate max-w-[50px]">{p.name}</span>
                  <span className="text-[9px] font-bold text-blue-400 font-mono">{p.score}p</span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowPlayersPopup(true)}
            className="text-[10px] text-blue-400 font-semibold px-2 py-0.5 bg-blue-600/10 hover:bg-blue-600/20 rounded transition-colors shrink-0"
          >
            More
          </button>
        </div>
      )}

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0"
      >
        {messages.length === 0 && (
          <div className="text-center text-tertiary-mac text-[12px] py-8 flex flex-col items-center gap-2">
            <IconSparkles size={20} />
            {gameState === "drawing" ? "Type your guesses here!" : "Chat will appear here."}
          </div>
        )}
        {messages.map((m) => <MessageRow key={m.id} m={m} />)}
      </div>

      <form
        onSubmit={send}
        className={`flex items-center gap-2 ${isKeyboardOpen ? 'p-1.5' : 'p-2.5'}`}
        style={{
          borderTop: isKeyboardOpen ? "none" : "1px solid var(--separator)",
          background: "rgba(28,28,30,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          flex: "0 0 auto",
        }}
      >
        <input
          id="chat-input"
          name="chatMessage"
          aria-label="Type your guess"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isDrawer ? "You can't guess while drawing" : "Type your guess…"}
          disabled={!canType}
          className="mac-input"
          style={{ opacity: canType ? 1 : 0.5 }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canType || !text.trim()}
          className="mac-btn mac-btn-primary"
          style={{ minWidth: 44, minHeight: 40 }}
        >
          <IconSend2 size={15} />
        </button>
      </form>

      {/* Players list popup modal */}
      <AnimatePresence>
        {showPlayersPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <h3 className="font-bold text-white text-base">Players & Scores</h3>
                <button
                  onClick={() => setShowPlayersPopup(false)}
                  className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {sortedPlayers.map((p, i) => {
                  const isPlayerDrawer = p.id === currentDrawer;
                  const isYou = p.id === userProfile?.id || p.authId === userProfile?.id;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: stringToColor(p.name) }}
                      >
                        {p.picture ? <img src={p.picture} alt={p.name} className="w-full h-full rounded-full object-cover" /> : p.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-white truncate flex items-center gap-1.5">
                          {i === 0 && "👑"} {p.name}
                          {p.isHost && <span className="text-[9px] text-yellow-400 font-bold px-1 bg-yellow-400/10 rounded">HOST</span>}
                          {isYou && <span className="text-[10px] text-white/40">(you)</span>}
                        </div>
                        <div className="text-[11px] text-white/50">{p.score} pts</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPlayerDrawer && <span className="text-sm">✏️</span>}
                        {p.hasGuessed && <span className="text-green-400 text-sm">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowPlayersPopup(false)}
                className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageRow({ m }: { m: ChatMessage }) {
  if (m.isSystem) {
    return (
      <div className="flex justify-center py-0.5">
        <span
          className="text-[11px] px-3 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-tertiary)" }}
        >
          {m.message}
        </span>
      </div>
    );
  }

  if (m.isCorrect) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]"
        style={{
          background: "rgba(48,209,88,0.12)",
          border: "1px solid rgba(48,209,88,0.25)",
          color: "var(--green)",
        }}
      >
        ✓ <span className="font-medium">{m.name}</span>
        <span>guessed the word!</span>
      </motion.div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-1">
      <div
        className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
        style={{ background: stringToColor(m.name) }}
      >
        {m.name[0]?.toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-tertiary-mac leading-tight">{m.name}</div>
        <div className="text-[13px] text-primary-mac leading-snug break-words">{m.message}</div>
      </div>
    </div>
  );
}

function stringToColor(str: string = "System") {
  const s = str || "System";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}
