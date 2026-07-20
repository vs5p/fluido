import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ToastHost, toast } from "@/components/ui-mac/Toast";
import { useGame } from "@/store/gameStore";
import { useRoom } from "@/store/roomStore";
import { getSocket } from "@/lib/socket";
import { GameScreen } from "@/components/game/GameScreen";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const Route = createFileRoute("/room/$id")({
  component: RoomPage,
});

function RoomPage() {
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const user = useGame((s) => s.user);
  const setUser = useGame((s) => s.setUser);
  const userProfile = useGame((s) => s.userProfile);
  const isConnected = useGame((s) => s.isConnected);

  const currentRoom = useRoom((s) => s.currentRoom);
  const isInRoom = useRoom((s) => s.isInRoom);
  const setCurrentRoom = useRoom((s) => s.setCurrentRoom);
  const setIsInRoom = useRoom((s) => s.setIsInRoom);

  const authReady = useGame((s) => s.authReady);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Auto-join room when connected and profile is loaded
  useEffect(() => {
    if (!authReady || !isConnected || !userProfile || !id) return;

    const targetCode = id.toUpperCase();

    // If we're already in this room, nothing to do
    if (isInRoom && currentRoom && currentRoom.code === targetCode) {
      setJoining(false);
      return;
    }

    setJoining(true);
    setJoinError("");
    const socket = getSocket();

    socket?.emit("room:join", targetCode, userProfile, (response: any) => {
      setJoining(false);
      if (response?.success) {
        const room = response.room;
        setCurrentRoom(room);
        setIsInRoom(true);
        toast(`Joined room ${room.name}`);
      } else {
        const errMsg = response?.error || "Failed to join room";
        setJoinError(errMsg);
        toast(`Error: ${errMsg}`);
        setTimeout(() => {
          navigate({ to: "/" });
        }, 2000);
      }
    });
  }, [authReady, isConnected, userProfile?.id, id, isInRoom, currentRoom?.code]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
        <p>Loading session…</p>
      </div>
    );
  }

  // If not authenticated, show the AuthScreen right here in room route!
  if (!user) {
    return (
      <>
        <ToastHost />
        <AuthScreen redirectOnSuccess={false} />
      </>
    );
  }

  // If in room, show the game screen
  if (isInRoom && currentRoom && currentRoom.code === id.toUpperCase()) {
    return (
      <>
        <ToastHost />
        <GameScreen onLeave={() => navigate({ to: "/" })} />
      </>
    );
  }

  // Otherwise show loading / join error page
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <ToastHost />
      <div className="text-center space-y-4 max-w-sm px-6">
        {joinError ? (
          <>
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-bold text-red-400">Failed to Join Room</h2>
            <p className="text-white/60 text-sm">{joinError}</p>
            <p className="text-white/40 text-xs">Redirecting to lobby…</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
            <h2 className="text-lg font-semibold">Connecting to Room {id.toUpperCase()}...</h2>
            <p className="text-white/45 text-xs">
              {!isConnected ? "Connecting to server…" : "Joining lobby…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
