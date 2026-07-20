/**
 * useSocket – initialises the Socket.io connection once and wires every
 * server → store update in one place.
 *
 * CRITICAL FIX: Uses `useGame.getState()` and `useRoom.getState()` instead
 * of hook-based selectors. This means RootComponent has ZERO Zustand
 * subscriptions, so socket events never trigger component re-renders.
 * All state updates go directly to the store.
 */
import { useEffect } from "react";
import { useGame } from "@/store/gameStore";
import { useRoom } from "@/store/roomStore";
import {
  initSocket,
  connectSocket,
  onConnect,
  onDisconnect,
  onAuthSuccess,
  onAuthError,
  onAuthExpired,
  onGameStateUpdate,
  onPlayersUpdate,
  onChatMessage,
  onTimerTick,
  onWordChoices,
  onDrawerWord,
  onMaskedWord,
  onCorrectGuess,
  onRoundResults,
  onGameOver,
  onLeaderboardUpdate,
  onRoomJoined,
  onRoomError,
  onRoomPublicList,
  onRoomPlayerJoined,
  onRoomPlayerLeft,
  onRoomHostChanged,
  onRoomUpdated,
  onKicked,
  onCountdownTick,
  onPlaySound,
  getSocket,
  authFirebase,
  authGoogle,
  authGuest,
  requestLeaderboard,
  type Room,
} from "@/lib/socket";
import { onAuth } from "@/lib/firebase";

// Guard to prevent double-init from React StrictMode
let socketInitialized = false;

export function useSocket() {
  useEffect(() => {
    // Prevent StrictMode double-initialization
    if (socketInitialized) return;
    socketInitialized = true;

    initSocket();
    connectSocket();

    const unsubs: Array<() => void> = [];

    // Helper: get store setters directly (no React subscriptions)
    const game = () => useGame.getState();
    const room = () => useRoom.getState();

    // ── Connection ──────────────────────────────────────────────────────────
    unsubs.push(onConnect(() => game().setConnected(true)));
    unsubs.push(onDisconnect(() => game().setConnected(false)));

    // ── Auth ────────────────────────────────────────────────────────────────
    unsubs.push(onAuthSuccess((profile) => {
      game().setUserProfile(profile);
      if (typeof window !== "undefined") {
        localStorage.setItem('orbitdraw-user-id', profile.id);
      }
      game().setUser({
        uid: profile.id,
        displayName: profile.name,
        email: profile.email || null,
        photoURL: profile.picture || null,
      } as any);
      requestLeaderboard();
      game().setAuthReady(true);
    }));

    unsubs.push(onAuthError((msg) => {
      game().pushMessage({ name: "System", message: `Auth error: ${msg}`, isSystem: true });
      game().setAuthReady(true);
    }));

    unsubs.push(onAuthExpired(() => {
      game().setUserProfile(null);
      game().setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem('orbitdraw-user-id');
        localStorage.removeItem('orbitdraw-auth-provider');
      }
      game().setAuthReady(true);
    }));

    const socket = getSocket();
    let fallbackTimeout: any;

    const savedUserId = typeof window !== "undefined" ? localStorage.getItem('orbitdraw-user-id') : null;

    if (savedUserId) {
      connectSocket();
      socket?.emit("auth-resume", savedUserId);
      
      fallbackTimeout = setTimeout(() => {
        game().setAuthReady(true);
      }, 5000);
    }

    const unsubAuth = onAuth(async (u) => {
      if (!u) {
        if (savedUserId) return;
        game().setUser(null);
        game().setUserProfile(null);
        game().setAuthReady(true);
        return;
      }

      game().setUser(u);
      
      if (!savedUserId) {
        connectSocket();

        if (u.uid.startsWith("mock-")) {
          const displayName = (u as any)?.displayName || "User";
          const mockToken = `mock-token-${u.uid}::${displayName}`;
          authFirebase(mockToken);
          return;
        }

        let token = "";
        if (typeof (u as any).getIdToken === "function") {
          try {
            token = await (u as any).getIdToken();
          } catch (err) {
            console.error("Failed to get ID token:", err);
          }
        }

        if (token) {
          const isGoogle = !!(u as any).providerData &&
            (u as any).providerData.some((p: any) => p.providerId === "google.com");
          if (isGoogle && typeof window !== "undefined") {
            localStorage.setItem('orbitdraw-auth-provider', 'google');
          }
          authFirebase(token);
        } else {
          const displayName = (u as any)?.displayName || "User";
          authFirebase(`dev-token-${displayName}`);
        }
      }
    });

    unsubs.push(unsubAuth);
    if (fallbackTimeout) {
      unsubs.push(() => clearTimeout(fallbackTimeout));
    }

    // ── Room ────────────────────────────────────────────────────────────────
    unsubs.push(onRoomJoined(({ room: r, asHost, asSpectator, reconnected }) => {
      room().setCurrentRoom(r as Room);
      room().setIsHost(!!asHost);
      room().setIsSpectator(!!asSpectator);
      game().setRoomInfo(r.code, r.name);
      // seed game state from room
      if (r.gameState) game().setGameState(r.gameState as any);
      if (r.maxRounds)  game().setRounds(r.currentRound || 0, r.maxRounds);
      if (r.players)    game().setPlayers(r.players as any);
      if ((r as any).drawerDevice) game().setDrawerDevice((r as any).drawerDevice);
      
      if (reconnected) {
        game().pushMessage({ name: "System", message: `⚡ Reconnected & restored to match!`, isSystem: true });
      } else {
        game().pushMessage({ name: "System", message: `Joined room ${r.name} (${r.code})`, isSystem: true });
      }
    }));
    unsubs.push(onRoomError((msg) => {
      room().setRoomError(msg);
      game().pushMessage({ name: "System", message: `Room error: ${msg}`, isSystem: true });
    }));
    unsubs.push(onRoomPublicList((rooms) => room().setPublicRooms(rooms as Room[])));
    unsubs.push(onRoomPlayerJoined(({ player }) =>
      game().pushMessage({ name: "System", message: `${(player as any).name} joined the room.`, isSystem: true })
    ));
    unsubs.push(onRoomPlayerLeft(({ player }) =>
      game().pushMessage({ name: "System", message: `${(player as any).name} left the room.`, isSystem: true })
    ));
    unsubs.push(onRoomHostChanged(({ newHostId }) =>
      room().updateRoomProperty({ hostId: newHostId })
    ));
    unsubs.push(onRoomUpdated((data) => {
      room().updateRoomProperty(data as any);
      if (data.players) {
        game().setPlayers(data.players as any);
      }
      if (data.gameState) {
        game().setGameState(data.gameState as any);
        if (data.gameState === 'waiting' || data.gameState === 'starting') {
          game().setGameOverData(null);
        }
        if (data.gameState === 'waiting') {
          game().setRoundResults(null);
          game().setWordChoices([]);
          game().setCurrentWord("");
          game().setMaskedWord("");
          game().setStartCountdown(null);
        }
      }
      if (data.currentRound !== undefined && data.maxRounds !== undefined) {
        game().setRounds(data.currentRound, data.maxRounds);
      }
      if (data.currentDrawer !== undefined) {
        game().setCurrentDrawer(data.currentDrawer);
      }
      if (data.timer !== undefined) {
        game().setTimer(data.timer);
      }
      if (data.startCountdown !== undefined) {
        game().setStartCountdown(data.startCountdown ?? null);
      }
      if ((data as any).drawerDevice !== undefined) {
        game().setDrawerDevice((data as any).drawerDevice);
      }
      if (data.hostId) {
        const sock = getSocket();
        if (sock) room().setIsHost(data.hostId === sock.id);
      }
    }));
    unsubs.push(onKicked((msg) => {
      room().leaveCurrentRoom();
      game().pushMessage({ name: "System", message: `You were kicked: ${msg}`, isSystem: true });
    }));

    // ── Game state ──────────────────────────────────────────────────────────
    unsubs.push(onGameStateUpdate((state) => {
      const s = state as any;
      game().setGameState(s.gameState as any);
      game().setRounds(s.currentRound, s.maxRounds);
      game().setCurrentDrawer(s.currentDrawer);
      game().setTimer(s.timer);
      game().setStartCountdown(s.startCountdown ?? null);
      if (s.roomCode) game().setRoomInfo(s.roomCode, s.roomName ?? "");
    }));
    unsubs.push(onPlayersUpdate((players) => game().setPlayers(players as any)));
    unsubs.push(onTimerTick((t) => game().setTimer(t)));
    unsubs.push(onCountdownTick(({ count }) => game().setStartCountdown(count)));

    // ── Words ───────────────────────────────────────────────────────────────
    unsubs.push(onWordChoices((words) => game().setWordChoices(words)));
    unsubs.push(onDrawerWord((word) => {
      game().setCurrentWord(word);
      game().setMaskedWord(word); // drawer sees full word
    }));
    unsubs.push(onMaskedWord((masked) => game().setMaskedWord(masked)));

    // ── Chat ────────────────────────────────────────────────────────────────
    unsubs.push(onChatMessage((m) => game().pushMessage({
      name: m.name,
      message: m.message,
      picture: m.picture,
      isSystem: m.isSystem,
      dateTime: m.dateTime,
    })));
    unsubs.push(onCorrectGuess(({ name, points }) =>
      game().pushMessage({ name, message: `guessed the word! (+${points} pts)`, isSystem: false, isCorrect: true })
    ));

    // ── Scoring / round ─────────────────────────────────────────────────────
    unsubs.push(onRoundResults((data) => {
      game().setRoundResults(data);
      game().setCurrentWord(data.word || "");
    }));
    unsubs.push(onGameOver((data) => {
      game().setGameOverData(data);
    }));

    // ── Leaderboard ─────────────────────────────────────────────────────────
    unsubs.push(onLeaderboardUpdate((lb) => game().setLeaderboard(lb)));

    // ── Sounds ──────────────────────────────────────────────────────────────
    unsubs.push(onPlaySound((sound) => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (sound === "correct") { osc.frequency.value = 880; gain.gain.value = 0.15; }
        else                     { osc.frequency.value = 220; gain.gain.value = 0.1;  }
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } catch (_) {}
    }));

    return () => {
      unsubs.forEach((fn) => fn());
      socketInitialized = false;
    };
  }, []);
}
