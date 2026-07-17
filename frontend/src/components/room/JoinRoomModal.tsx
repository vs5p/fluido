import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconCopy, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useGame } from "@/store/gameStore";
import { useRoom } from "@/store/roomStore";
import { getSocket } from "@/lib/socket";
import { useNavigate } from "@tanstack/react-router";

type Room = {
  id: string;
  code: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  gameState: string;
  createdAt: number;
};

type Props = {
  onClose?: () => void;
};

export function JoinRoomModal({ onClose }: Props) {
  const navigate = useNavigate();
  const userProfile = useGame((s) => s.userProfile);
  const setCurrentRoom = useRoom((s) => s.setCurrentRoom);
  const setIsInRoom = useRoom((s) => s.setIsInRoom);

  const [mode, setMode] = useState<"code" | "browse">("browse");
  const [roomCode, setRoomCode] = useState("");
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const socket = getSocket();

  useEffect(() => {
    if (mode === "browse") {
      loadPublicRooms();
    }
  }, [mode]);

  const loadPublicRooms = () => {
    setLoading(true);
    socket?.emit("room:list-public", (rooms: Room[]) => {
      setPublicRooms(rooms);
      setLoading(false);
    });
  };

  const handleJoinByCode = async () => {
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    if (!userProfile) {
      setError("You must be authenticated");
      return;
    }

    setLoading(true);
    setError("");

    socket?.emit(
      "room:join",
      roomCode.toUpperCase(),
      userProfile,
      (response: any) => {
        setLoading(false);
        if (response?.success) {
          const room = response.room;
          setCurrentRoom(room);
          setIsInRoom(true);
          onClose?.();
          navigate({ to: "/room/$id", params: { id: room.code } });
        } else {
          setError(response?.error || "Failed to join room");
        }
      }
    );
  };

  const handleJoinRoom = async (room: Room) => {
    if (!userProfile) {
      setError("You must be authenticated");
      return;
    }

    setLoading(true);
    setError("");

    socket?.emit(
      "room:join",
      room.code,
      userProfile,
      (response: any) => {
        setLoading(false);
        if (response?.success) {
          const joinedRoom = response.room;
          setCurrentRoom(joinedRoom);
          setIsInRoom(true);
          onClose?.();
          navigate({ to: "/room/$id", params: { id: joinedRoom.code } });
        } else {
          setError(response?.error || "Failed to join room");
        }
      }
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-2xl mx-4 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Join Room</h2>
            <button
              onClick={() => onClose?.()}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <IconX size={20} className="text-white/60" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-lg">
            <button
              onClick={() => setMode("browse")}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                mode === "browse"
                  ? "bg-blue-600 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Browse Rooms
            </button>
            <button
              onClick={() => setMode("code")}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                mode === "code"
                  ? "bg-blue-600 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Enter Code
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Enter Code Tab */}
          {mode === "code" && (
            <div className="space-y-4">
              <div>
                <Label className="text-white/70">Room Code</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="e.g., ABC123"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono text-lg text-center"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-white/50 mt-2">Ask your friend for the 6-character room code</p>
              </div>

              <Button
                onClick={handleJoinByCode}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                disabled={loading || !roomCode.trim()}
              >
                {loading ? "Joining..." : "Join Room"}
              </Button>
            </div>
          )}

          {/* Browse Rooms Tab */}
          {mode === "browse" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-white/80 font-semibold">Available Public Rooms</h3>
                <button
                  onClick={loadPublicRooms}
                  disabled={loading}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <IconRefresh size={18} className={loading ? "animate-spin" : ""} />
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-white/50">No public rooms available</p>
                  <p className="text-white/30 text-sm mt-2">Create a room or ask a friend to share a room code</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {publicRooms.map((room) => (
                    <motion.div
                      key={room.id}
                      whileHover={{ x: 4 }}
                    >
                      <Card
                        className="border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                        onClick={() => !loading && handleJoinRoom(room)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-white">{room.name}</h4>
                                <span className="px-2 py-1 rounded text-xs bg-blue-600/20 text-blue-300">
                                  {room.code}
                                </span>
                              </div>
                              <p className="text-xs text-white/50">
                                Hosted by {room.hostName} • {room.playerCount}/{room.maxPlayers} players
                              </p>
                            </div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinRoom(room);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              disabled={loading}
                            >
                              Join
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => onClose?.()}
              className="w-full border-white/10 text-white hover:bg-white/10"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
