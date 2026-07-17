import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { HomeScreen } from "@/components/home/HomeScreen";
import { LeaderboardScreen } from "@/components/leaderboard/LeaderboardScreen";
import { MainLayout } from "@/components/layout/MainLayout";
import { GameScreen } from "@/components/game/GameScreen";
import { ToastHost } from "@/components/ui-mac/Toast";
import { onAuth } from "@/lib/firebase";
import { useGame } from "@/store/gameStore";
import { useRoom } from "@/store/roomStore";
import { initSocket, connectSocket, onAuthSuccess, onAuthError, onAuthExpired, authGuest, authGoogle, authFirebase, requestLeaderboard } from "@/lib/socket";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const user = useGame((s) => s.user);
  const userProfile = useGame((s) => s.userProfile);
  const setUser = useGame((s) => s.setUser);
  const setUserProfile = useGame((s) => s.setUserProfile);
  const setConnected = useGame((s) => s.setConnected);
  const setLeaderboard = useGame((s) => s.setLeaderboard);
  const isInRoom = useRoom((s) => s.isInRoom);
  const currentRoom = useRoom((s) => s.currentRoom);
  
  const authReady = useGame((s) => s.authReady);
  const [currentTab, setCurrentTab] = useState<"play" | "leaderboard">("play");

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-white/50 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!user) {
    return (
      <>
        <ToastHost />
        <AuthScreen />
      </>
    );
  }

  // Show game screen if in a room
  if (isInRoom && currentRoom) {
    return (
      <>
        <ToastHost />
        <GameScreen onLeave={() => {}} />
      </>
    );
  }

  // Show main layout with tabs
  return (
    <>
      <ToastHost />
      <MainLayout currentTab={currentTab} onTabChange={setCurrentTab}>
        {currentTab === "play" && <HomeScreen />}
        {currentTab === "leaderboard" && <LeaderboardScreen />}
      </MainLayout>
    </>
  );
}
