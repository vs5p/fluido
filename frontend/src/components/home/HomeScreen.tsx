import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { JoinRoomModal } from "@/components/room/JoinRoomModal";

export function HomeScreen() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section — CSS animation, no Framer Motion so state changes don't re-trigger */}
        <div className="text-center space-y-4 py-6 sm:py-12 anim-fade-in-up">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white">Draw, Guess, Win!</h1>
          <p className="text-xl text-white/70">Real-time multiplayer drawing game with friends</p>
        </div>

        {/* Play Options */}
        <div className="grid md:grid-cols-2 gap-4 anim-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <Card className="border-0 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-shadow cursor-pointer"
            onClick={() => setShowCreateModal(true)}>
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="text-5xl">🎨</div>
              <h3 className="text-2xl font-bold">Create Room</h3>
              <p className="text-white/80">Start your own private game with custom settings</p>
              <Button className="mt-4 w-full bg-white text-blue-600 hover:bg-white/90 font-semibold">
                Create Now
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-shadow cursor-pointer"
            onClick={() => setShowJoinModal(true)}>
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="text-5xl">🚪</div>
              <h3 className="text-2xl font-bold">Join Room</h3>
              <p className="text-white/80">Enter a room code to join your friends</p>
              <Button className="mt-4 w-full bg-white text-purple-600 hover:bg-white/90 font-semibold">
                Join Now
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* How to Play */}
        <div className="anim-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-2xl">How to Play</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  step: 1,
                  emoji: "👥",
                  title: "Join a Game",
                  desc: "Create a room or join one with a code. Invite 2-12 players for maximum fun!"
                },
                {
                  step: 2,
                  emoji: "✏️",
                  title: "Take Turns Drawing",
                  desc: "Each player takes a turn drawing a secret word while others guess in real-time."
                },
                {
                  step: 3,
                  emoji: "🎯",
                  title: "Earn Points",
                  desc: "Guessers get more points for faster correct answers. Drawers earn bonus points too!"
                },
                {
                  step: 4,
                  emoji: "🏆",
                  title: "Win",
                  desc: "Highest score after all rounds wins. Challenge your friends and climb the leaderboard!"
                }
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600/20 border border-blue-500/50 text-2xl">
                      {item.emoji}
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <h4 className="font-semibold text-lg">{item.title}</h4>
                    <p className="text-white/60 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Game Features */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 anim-fade-in-up" style={{ animationDelay: "0.3s" }}>
          {[
            { icon: "👥", title: "Multiplayer", desc: "2-12 players" },
            { icon: "🎨", title: "Creative", desc: "Free drawing canvas" },
            { icon: "⚡", title: "Real-time", desc: "Instant gameplay" },
            { icon: "🏅", title: "Leaderboard", desc: "Track scores" }
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-4 rounded-lg bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors hover:-translate-y-1"
            >
              <div className="text-3xl mb-2">{feature.icon}</div>
              <h4 className="font-semibold text-sm text-white">{feature.title}</h4>
              <p className="text-xs text-white/50 mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />}
      {showJoinModal && <JoinRoomModal onClose={() => setShowJoinModal(false)} />}
    </div>
  );
}
