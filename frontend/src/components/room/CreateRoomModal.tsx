import { useState } from "react";
import { motion } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGame } from "@/store/gameStore";
import { useRoom } from "@/store/roomStore";
import { getSocket } from "@/lib/socket";
import { useNavigate } from "@tanstack/react-router";

type Props = {
  onClose?: () => void;
};

export function CreateRoomModal({ onClose }: Props) {
  const navigate = useNavigate();
  const userProfile = useGame((s) => s.userProfile);
  const setRoomInfo = useGame((s) => s.setRoomInfo);
  const setCurrentRoom = useRoom((s) => s.setCurrentRoom);
  const setIsInRoom = useRoom((s) => s.setIsInRoom);

  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [maxRounds, setMaxRounds] = useState(3);
  const [roundDuration, setRoundDuration] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    if (!userProfile) {
      setError("You must be authenticated");
      return;
    }

    setLoading(true);
    setError("");

    const socket = getSocket();
    if (!socket) {
      setError("Connection lost");
      setLoading(false);
      return;
    }

    socket.emit(
      "room:create",
      {
        name: roomName,
        hostName: userProfile.name,
        hostPicture: userProfile.picture,
        maxPlayers,
        maxRounds,
        roundDuration,
        isPublic
      },
      (response: any) => {
        setLoading(false);
        if (response?.success) {
          const room = response.room;
          setRoomInfo(room.code, room.name);
          setCurrentRoom(room);
          setIsInRoom(true);
          onClose?.();
          navigate({ to: "/room/$id", params: { id: room.code } });
        } else {
          setError(response?.error || "Failed to create room");
        }
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => onClose?.()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md mx-4 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Create Room</h2>
            <button
              onClick={() => onClose?.()}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <IconX size={20} className="text-white/60" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Room Name</Label>
              <Input
                placeholder="e.g., Art Masters"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white/70 text-sm">Max Players</Label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  {[2, 4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} players
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-white/70 text-sm">Max Rounds</Label>
                <select
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} rounds
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-white/70 text-sm">Round Duration</Label>
              <select
                value={roundDuration}
                onChange={(e) => setRoundDuration(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              >
                {[30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              <span className="text-white/70 text-sm">Public room (anyone can join)</span>
            </label>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onClose?.()}
                className="flex-1 border-white/10 text-white hover:bg-white/10"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Room"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
