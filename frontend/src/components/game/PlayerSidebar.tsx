import { IconCrown, IconPencil, IconCheck } from "@tabler/icons-react";
import { useGame } from "@/store/gameStore";

export function PlayerSidebar({ limitHeight = true }: { limitHeight?: boolean }) {
  const players = useGame((s) => s.players);
  const currentDrawer = useGame((s) => s.currentDrawer);
  const userProfile = useGame((s) => s.userProfile);
  const gameState = useGame((s) => s.gameState);
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col min-h-0 flex-1" style={{ flex: limitHeight ? "0 0 auto" : "1 1 0%" }}>
      <div
        className="px-4 py-2 mac-label-caps flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--separator)" }}
      >
        <span>Players</span>
        <span>{players.length}</span>
      </div>
      <div className="overflow-y-auto flex-1" style={limitHeight ? { maxHeight: 280 } : undefined}>
        {sorted.map((p, i) => {
          const isDrawer = p.id === currentDrawer;
          const isYou = p.id === userProfile?.id || p.authId === userProfile?.id;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2.5 px-3 transition-colors hover:bg-[var(--vibrancy-light)]"
              style={{
                height: 44,
                borderBottom: i < sorted.length - 1 ? "1px solid var(--separator)" : "none",
                opacity: p.isDisconnected ? 0.5 : 1,
              }}
            >
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: stringToColor(p.name) }}
              >
                {p.picture
                  ? <img src={p.picture} alt={p.name} className="w-full h-full rounded-full object-cover" />
                  : p.name[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-primary-mac truncate flex items-center gap-1">
                  {i === 0 && <IconCrown size={12} style={{ color: "var(--yellow)" }} />}
                  <span style={{ textDecoration: p.isDisconnected ? "line-through" : "none" }}>{p.name}</span>
                  {p.isDisconnected && <span className="text-[9px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded ml-1 uppercase">AWAY</span>}
                  {p.isHost && <span className="text-[10px] text-yellow-400 ml-1">HOST</span>}
                  {isYou && <span className="text-tertiary-mac text-[11px]">(you)</span>}
                </div>
                <div className="text-[11px] text-secondary-mac tabular-nums flex items-center gap-1.5">
                  <span>{p.score} pts</span>
                  {(gameState === 'drawing' || gameState === 'round_end') && p.pointsGainedThisRound > 0 && (
                    <span className="font-bold text-xs" style={{ color: "var(--green)" }}>
                      +{p.pointsGainedThisRound}
                    </span>
                  )}
                </div>
              </div>

              {isDrawer && <IconPencil size={14} style={{ color: "var(--accent)" }} />}
              {p.hasGuessed && !isDrawer && <IconCheck size={14} style={{ color: "var(--green)" }} />}
            </div>
          );
        })}
        {players.length === 0 && (
          <div className="text-center text-tertiary-mac text-[12px] py-6">
            Waiting for players…
          </div>
        )}
      </div>
    </div>
  );
}

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 45%)`;
}
