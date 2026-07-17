import { useEffect } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGame } from "@/store/gameStore";
import { requestLeaderboard } from "@/lib/socket";

const medalEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

export function LeaderboardScreen() {
  const leaderboard = useGame((s) => s.leaderboard);
  const setLeaderboard = useGame((s) => s.setLeaderboard);

  useEffect(() => {
    requestLeaderboard();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">🏆 Leaderboard</h1>
          <p className="text-white/60 mt-2">Top players of all time</p>
        </motion.div>

        {leaderboard.length === 0 ? (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-12 text-center">
              <p className="text-white/50">No players yet. Be the first to join the leaderboard!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((player: any, index: number) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`border-0 ${
                  index === 0
                    ? "bg-gradient-to-r from-yellow-600/20 to-yellow-600/10 border-l-4 border-yellow-500"
                    : index === 1
                    ? "bg-gradient-to-r from-gray-400/20 to-gray-400/10 border-l-4 border-gray-400"
                    : index === 2
                    ? "bg-gradient-to-r from-amber-600/20 to-amber-600/10 border-l-4 border-amber-600"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                } transition-colors`}>
                  <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 text-2xl w-12 text-center">
                      {index < 5 ? medalEmojis[index] : `${index + 1}`}
                    </div>

                    {/* Avatar & Name */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={player.picture} alt={player.name} />
                        <AvatarFallback className="bg-blue-600 text-white font-bold">
                          {player.name?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{player.name}</h3>
                        <p className="text-xs text-white/50">
                          {player.gamesPlayed ?? 0} games • {player.correctGuesses ?? 0} correct guesses
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-blue-400">
                        {player.totalPoints ?? 0}
                      </div>
                      <p className="text-xs text-white/50">points</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        {leaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 grid md:grid-cols-3 gap-4"
          >
            {[
              {
                label: "Top Player",
                value: leaderboard[0]?.name,
                emoji: "👑"
              },
              {
                label: "Total Games Played",
                value: leaderboard.reduce((sum, p) => sum + (p.gamesPlayed ?? 0), 0),
                emoji: "🎮"
              },
              {
                label: "Active Players",
                value: leaderboard.length,
                emoji: "👥"
              }
            ].map((stat, i) => (
              <Card key={i} className="border-white/10 bg-white/5">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl mb-2">{stat.emoji}</div>
                  <p className="text-white/60 text-sm mb-2">{stat.label}</p>
                  <p className="text-2xl font-bold text-white truncate">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
