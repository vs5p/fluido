import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  IconPlus,
  IconLogin2,
  IconCopy,
  IconLogout,
  IconUsers,
  IconClock,
} from "@tabler/icons-react";
import { TrafficLights } from "@/components/ui-mac/TrafficLights";
import { Avatar } from "@/components/ui-mac/Avatar";
import { SegmentedControl } from "@/components/ui-mac/SegmentedControl";
import { useGame } from "@/store/gameStore";
import { signOut } from "@/lib/firebase";
import { toast } from "@/components/ui-mac/Toast";

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export function LobbyScreen() {
  const user = useGame((s) => s.user);
  const setUser = useGame((s) => s.setUser);
  const setUserProfile = useGame((s) => s.setUserProfile);
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [rounds, setRounds] = useState<"3" | "5" | "8">("5");
  const [time, setTime] = useState<"60" | "80" | "120">("80");

  if (!user) return null;
  const name = user.displayName ?? "Guest";

  function handleCreate() {
    const id = makeRoomCode();
    navigate({ to: "/room/$id", params: { id } });
  }
  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (joinCode.length !== 4) return;
    navigate({ to: "/room/$id", params: { id: joinCode.toUpperCase() } });
  }

  return (
    <div
      className="flex items-center justify-center p-4"
      style={{ height: "100dvh", background: "var(--bg-base)" }}
    >
      <div
        className="mac-panel w-full max-w-[860px] overflow-hidden anim-fade-in-up"
      >
        {/* Title bar */}
        <div
          className="flex items-center"
          style={{ borderBottom: "1px solid var(--separator)" }}
        >
          <TrafficLights />
          <div className="flex-1 text-center text-[12px] text-tertiary-mac py-2">
            Scribble — Lobby
          </div>
          <div className="flex items-center gap-2 pr-3">
            <button
              aria-label="Sign out"
              onClick={async () => {
                await signOut();
                setUser(null);
                setUserProfile(null);
              }}
              className="mac-btn"
              style={{ minHeight: 26, padding: "2px 10px", fontSize: 12 }}
            >
              <IconLogout size={13} /> Sign out
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2">
          {/* Left — your profile + create/join */}
          <div
            className="p-7"
            style={{ borderRight: "1px solid var(--separator)" }}
          >
            <div className="flex items-center gap-3 mb-7">
              <Avatar uid={user.uid} name={name} src={user.photoURL ?? undefined} size={44} />
              <div>
                <div className="text-[15px] font-medium text-primary-mac">
                  {name}
                </div>
                <div className="text-[12px] text-secondary-mac">Signed in</div>
              </div>
            </div>

            <h2 className="text-[20px] font-light tracking-tight text-primary-mac mb-1">
              Start a new game
            </h2>
            <p className="text-[13px] text-secondary-mac mb-5">
              Create a room and invite friends with a 4-letter code.
            </p>
            <button
              onClick={handleCreate}
              className="mac-btn mac-btn-primary w-full justify-center mb-6"
              style={{ minHeight: 40 }}
            >
              <IconPlus size={16} />
              Create room
            </button>

            <label htmlFor="lobby-join-code" className="mac-label-caps mb-2 block">Join a room</label>
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                id="lobby-join-code"
                name="joinCode"
                aria-label="Room code"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase())
                }
                placeholder="ABCD"
                className="mac-input font-mono text-center tracking-[0.4em] text-[18px]"
                style={{ letterSpacing: "0.4em" }}
              />
              <button
                type="submit"
                disabled={joinCode.length !== 4}
                className="mac-btn"
                style={{ minHeight: 40 }}
              >
                <IconLogin2 size={15} />
                Join
              </button>
            </form>
          </div>

          {/* Right — settings preview */}
          <div className="p-7" style={{ background: "var(--vibrancy-light)" }}>
            <h3 className="text-[15px] font-medium text-primary-mac mb-1">
              Game settings
            </h3>
            <p className="text-[13px] text-secondary-mac mb-6">
              Defaults for the next room you create.
            </p>

            <div className="space-y-5">
              <div>
                <label className="mac-label-caps flex items-center gap-1.5 mb-2">
                  <IconUsers size={11} /> Rounds
                </label>
                <SegmentedControl
                  value={rounds}
                  onChange={setRounds}
                  options={[
                    { value: "3", label: "3" },
                    { value: "5", label: "5" },
                    { value: "8", label: "8" },
                  ]}
                />
              </div>
              <div>
                <label className="mac-label-caps flex items-center gap-1.5 mb-2">
                  <IconClock size={11} /> Drawing time
                </label>
                <SegmentedControl
                  value={time}
                  onChange={setTime}
                  options={[
                    { value: "60", label: "60s" },
                    { value: "80", label: "80s" },
                    { value: "120", label: "120s" },
                  ]}
                />
              </div>
              <div>
                <label className="mac-label-caps mb-2 block">Word pack</label>
                <SegmentedControl
                  value={"mixed"}
                  onChange={() => {}}
                  options={[
                    { value: "easy", label: "Easy" },
                    { value: "mixed", label: "Mixed" },
                    { value: "hard", label: "Hard" },
                  ]}
                />
              </div>
            </div>

            <div
              className="mt-7 p-4 rounded-xl flex items-start gap-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--separator)",
              }}
            >
              <IconCopy size={16} style={{ color: "var(--accent)" }} />
              <div className="text-[12px] text-secondary-mac leading-relaxed">
                Once your room is created, the code appears in the title bar.
                Tap to copy and share.
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText("ABCD");
                    toast("Sample code ABCD copied");
                  }}
                  className="ml-1 text-[var(--accent)] hover:underline"
                >
                  Try it
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
