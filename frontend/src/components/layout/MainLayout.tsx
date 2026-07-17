import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconPaint, IconTrophy, IconLogout, IconX, IconMenu2 } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/lib/firebase";
import { useGame } from "@/store/gameStore";
import type { ReactNode } from "react";

export type NavTab = "play" | "leaderboard";

type Props = {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: ReactNode;
};

export function MainLayout({ currentTab, onTabChange, children }: Props) {
  const userProfile = useGame((s) => s.userProfile);
  const leaderboard = useGame((s) => s.leaderboard);
  const setUser = useGame((s) => s.setUser);
  const setUserProfile = useGame((s) => s.setUserProfile);
  
  const [showProfile, setShowProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setUserProfile(null);
  };

  const renderSidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <IconPaint size={28} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">Fluido</h1>
            <p className="text-[11px] text-white/40">Multiplayer Game</p>
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors md:hidden text-white/60 hover:text-white"
        >
          <IconX size={20} />
        </button>
      </div>

      {/* Profile Card */}
      {userProfile && (
        <div
          className="m-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setShowProfile(!showProfile)}
        >
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-12 h-12">
              <AvatarImage src={userProfile.picture} alt={userProfile.name} />
              <AvatarFallback className="bg-blue-600 text-white font-bold">
                {userProfile.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{userProfile.name}</p>
              {userProfile.isGuest ? (
                <Badge variant="secondary" className="text-xs mt-1">Guest</Badge>
              ) : (
                <p className="text-xs text-white/60">{userProfile.stats?.totalPoints ?? 0} pts</p>
              )}
            </div>
          </div>

          {showProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="pt-3 border-t border-white/10 space-y-2 text-xs"
            >
              <div className="flex justify-between">
                <span className="text-white/60">Games Played</span>
                <span className="font-semibold">{userProfile.stats?.gamesPlayed ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Total Points</span>
                <span className="font-semibold">{userProfile.stats?.totalPoints ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Correct Guesses</span>
                <span className="font-semibold">{userProfile.stats?.correctGuesses ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">High Score</span>
                <span className="font-semibold">{userProfile.stats?.highScore ?? 0}</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        <NavTab
          icon={<IconPaint size={20} />}
          label="Play"
          active={currentTab === "play"}
          onClick={() => {
            onTabChange("play");
            setIsSidebarOpen(false);
          }}
        />
        <NavTab
          icon={<IconTrophy size={20} />}
          label="Leaderboard"
          active={currentTab === "leaderboard"}
          onClick={() => {
            onTabChange("leaderboard");
            setIsSidebarOpen(false);
          }}
        />
      </nav>

      {/* Top Players Preview in Sidebar */}
      {currentTab === "leaderboard" && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-white/60 uppercase">Top Players</p>
          {leaderboard.slice(0, 3).map((p: any, i: number) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : "bg-amber-600"
              }`}>
                {i + 1}
              </div>
              <span className="truncate flex-1">{p.name}</span>
              <span className="text-white/60">{p.totalPoints}</span>
            </div>
          ))}
        </div>
      )}

      {/* Logout Button */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 transition-colors text-sm font-medium"
        >
          <IconLogout size={16} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div
      className="flex h-screen bg-black text-white flex-col md:flex-row"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Mobile Top Header */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 bg-zinc-950 border-b border-white/10 z-30 shrink-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Menu"
        >
          <IconMenu2 size={24} className="text-white" />
        </button>
        
        <div className="flex items-center gap-2">
          <IconPaint size={20} className="text-blue-400" />
          <span className="font-bold text-sm">Fluido</span>
        </div>

        {userProfile ? (
          <Avatar className="w-8 h-8 cursor-pointer" onClick={() => setIsSidebarOpen(true)}>
            <AvatarImage src={userProfile.picture} alt={userProfile.name} />
            <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
              {userProfile.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[280px] border-r border-white/10 bg-gradient-to-b from-zinc-950 to-black flex-col shrink-0">
        {renderSidebarContent()}
      </div>

      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-gradient-to-b from-zinc-950 to-black border-r border-white/10 flex flex-col md:hidden shadow-2xl"
            >
              {renderSidebarContent()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

function NavTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
        active
          ? "bg-blue-600/20 text-blue-400"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
      whileHover={{ x: 4 }}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {active && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-l"
        />
      )}
    </motion.button>
  );
}
