/**
 * useSocket – initialises the Socket.io connection once and wires every
 * server → store update in one place.  Import this in the top-level App or
 * route component and it will stay alive for the session.
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

export function useSocket() {
  const setConnected      = useGame((s) => s.setConnected);
  const setUser           = useGame((s) => s.setUser);
  const setUserProfile    = useGame((s) => s.setUserProfile);
  const setAuthReady      = useGame((s) => s.setAuthReady);
  const setGameState      = useGame((s) => s.setGameState);
  const setRounds         = useGame((s) => s.setRounds);
  const setCurrentDrawer  = useGame((s) => s.setCurrentDrawer);
  const setTimer          = useGame((s) => s.setTimer);
  const setStartCountdown = useGame((s) => s.setStartCountdown);
  const setWordChoices    = useGame((s) => s.setWordChoices);
  const setCurrentWord    = useGame((s) => s.setCurrentWord);
  const setMaskedWord     = useGame((s) => s.setMaskedWord);
  const setPlayers        = useGame((s) => s.setPlayers);
  const pushMessage       = useGame((s) => s.pushMessage);
  const setLeaderboard    = useGame((s) => s.setLeaderboard);
  const setRoundResults   = useGame((s) => s.setRoundResults);
  const setGameOverData   = useGame((s) => s.setGameOverData);
  const setRoomInfo       = useGame((s) => s.setRoomInfo);
  const setDrawerDevice   = useGame((s) => s.setDrawerDevice);

  const setCurrentRoom    = useRoom((s) => s.setCurrentRoom);
  const setIsHost         = useRoom((s) => s.setIsHost);
  const setIsSpectator    = useRoom((s) => s.setIsSpectator);
  const setPublicRooms    = useRoom((s) => s.setPublicRooms);
  const leaveCurrentRoom  = useRoom((s) => s.leaveCurrentRoom);
  const setRoomError      = useRoom((s) => s.setRoomError);
  const updateRoomProp    = useRoom((s) => s.updateRoomProperty);

  useEffect(() => {
    initSocket();
    connectSocket();

    const unsubs: Array<() => void> = [];

    // ── Connection ──────────────────────────────────────────────────────────
    unsubs.push(onConnect(() => setConnected(true)));
    unsubs.push(onDisconnect(() => setConnected(false)));

    // ── Auth ────────────────────────────────────────────────────────────────
    unsubs.push(onAuthSuccess((profile) => {
      setUserProfile(profile);
      if (typeof window !== "undefined") {
        localStorage.setItem('orbitdraw-user-id', profile.id);
      }
      setUser({
        uid: profile.id,
        displayName: profile.name,
        email: profile.email || null,
        photoURL: profile.picture || null,
      } as any);
      requestLeaderboard();
      setAuthReady(true);
    }));

    unsubs.push(onAuthError((msg) => {
      pushMessage({ name: "System", message: `Auth error: ${msg}`, isSystem: true });
      setAuthReady(true);
    }));

    unsubs.push(onAuthExpired(() => {
      setUserProfile(null);
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem('orbitdraw-user-id');
        localStorage.removeItem('orbitdraw-auth-provider');
      }
      setAuthReady(true);
    }));

    const socket = getSocket();
    let fallbackTimeout: any;

    const savedUserId = typeof window !== "undefined" ? localStorage.getItem('orbitdraw-user-id') : null;

    if (savedUserId) {
      connectSocket();
      socket?.emit("auth-resume", savedUserId);
      
      fallbackTimeout = setTimeout(() => {
        setAuthReady(true);
      }, 5000);
    }

    const unsubAuth = onAuth(async (u) => {
      if (!u) {
        if (savedUserId) return;
        setUser(null);
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      setUser(u);
      
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
    unsubs.push(onRoomJoined(({ room, asHost, asSpectator, reconnected }) => {
      setCurrentRoom(room as Room);
      setIsHost(!!asHost);
      setIsSpectator(!!asSpectator);
      setRoomInfo(room.code, room.name);
      // seed game state from room
      if (room.gameState) setGameState(room.gameState as any);
      if (room.maxRounds)  setRounds(room.currentRound || 0, room.maxRounds);
      if (room.players)    setPlayers(room.players as any);
      if (room.drawerDevice) setDrawerDevice(room.drawerDevice as any);
      
      if (reconnected) {
        pushMessage({ name: "System", message: `⚡ Reconnected & restored to match!`, isSystem: true });
      } else {
        pushMessage({ name: "System", message: `Joined room ${room.name} (${room.code})`, isSystem: true });
      }
    }));
    unsubs.push(onRoomError((msg) => {
      setRoomError(msg);
      pushMessage({ name: "System", message: `Room error: ${msg}`, isSystem: true });
    }));
    unsubs.push(onRoomPublicList((rooms) => setPublicRooms(rooms as Room[])));
    unsubs.push(onRoomPlayerJoined(({ player }) =>
      pushMessage({ name: "System", message: `${(player as any).name} joined the room.`, isSystem: true })
    ));
    unsubs.push(onRoomPlayerLeft(({ player }) =>
      pushMessage({ name: "System", message: `${(player as any).name} left the room.`, isSystem: true })
    ));
    unsubs.push(onRoomHostChanged(({ newHostId }) =>
      updateRoomProp({ hostId: newHostId })
    ));
    unsubs.push(onRoomUpdated((data) => {
      updateRoomProp(data as any);
      if (data.players) {
        setPlayers(data.players as any);
      }
      if (data.gameState) {
        setGameState(data.gameState as any);
        // Clear game over overlay when host resets or starts a new game
        if (data.gameState === 'waiting' || data.gameState === 'starting') {
          setGameOverData(null);
        }
        if (data.gameState === 'waiting') {
          setRoundResults(null);
          setWordChoices([]);
          setCurrentWord("");
          setMaskedWord("");
          setStartCountdown(null);
        }
      }
      if (data.currentRound !== undefined && data.maxRounds !== undefined) {
        setRounds(data.currentRound, data.maxRounds);
      }
      if (data.currentDrawer !== undefined) {
        setCurrentDrawer(data.currentDrawer);
      }
      if (data.timer !== undefined) {
        setTimer(data.timer);
      }
      if (data.startCountdown !== undefined) {
        setStartCountdown(data.startCountdown ?? null);
      }
      if (data.drawerDevice !== undefined) {
        setDrawerDevice(data.drawerDevice as any);
      }
      // Re-evaluate host status dynamically (socket ID may have changed)
      if (data.hostId) {
        const sock = getSocket();
        if (sock) setIsHost(data.hostId === sock.id);
      }
    }));
    unsubs.push(onKicked((msg) => {
      leaveCurrentRoom();
      pushMessage({ name: "System", message: `You were kicked: ${msg}`, isSystem: true });
    }));

    // ── Game state ──────────────────────────────────────────────────────────
    unsubs.push(onGameStateUpdate((state) => {
      const s = state as any;
      setGameState(s.gameState as any);
      setRounds(s.currentRound, s.maxRounds);
      setCurrentDrawer(s.currentDrawer);
      setTimer(s.timer);
      setStartCountdown(s.startCountdown ?? null);
      if (s.roomCode) setRoomInfo(s.roomCode, s.roomName ?? "");
    }));
    unsubs.push(onPlayersUpdate((players) => setPlayers(players as any)));
    unsubs.push(onTimerTick((t) => setTimer(t)));
    unsubs.push(onCountdownTick(({ count }) => setStartCountdown(count)));

    // ── Words ───────────────────────────────────────────────────────────────
    unsubs.push(onWordChoices((words) => setWordChoices(words)));
    unsubs.push(onDrawerWord((word) => {
      setCurrentWord(word);
      setMaskedWord(word); // drawer sees full word
    }));
    unsubs.push(onMaskedWord((masked) => setMaskedWord(masked)));

    // ── Chat ────────────────────────────────────────────────────────────────
    unsubs.push(onChatMessage((m) => pushMessage({
      name: m.name,
      message: m.message,
      picture: m.picture,
      isSystem: m.isSystem,
      dateTime: m.dateTime,
    })));
    unsubs.push(onCorrectGuess(({ name, points }) =>
      pushMessage({ name, message: `guessed the word! (+${points} pts)`, isSystem: false, isCorrect: true })
    ));

    // ── Scoring / round ─────────────────────────────────────────────────────
    unsubs.push(onRoundResults((data) => {
      setRoundResults(data);
      setCurrentWord(data.word || "");
    }));
    unsubs.push(onGameOver((data) => {
      setGameOverData(data);
    }));

    // ── Leaderboard ─────────────────────────────────────────────────────────
    unsubs.push(onLeaderboardUpdate((lb) => setLeaderboard(lb)));

    // ── Sounds ──────────────────────────────────────────────────────────────
    unsubs.push(onPlaySound((sound) => {
      // Simple web audio implementation – silently fails if browser blocks it
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

    return () => unsubs.forEach((fn) => fn());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
