// Socket.io client wrapper for Fast Draw multiplayer game

import { io, type Socket } from "socket.io-client";
import type { StrokeEvent } from "./canvas";

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || 
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "http://localhost:4000");

export type GameState = 'waiting' | 'starting' | 'word_selection' | 'drawing' | 'round_end' | 'game_end';

export type RoomConfig = {
  name?: string;
  isPublic?: boolean;
  maxPlayers?: number;
  maxRounds?: number;
  roundDuration?: number;
  wordSelectionDuration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  customWords?: string[];
  allowSpectators?: boolean;
  enableHints?: boolean;
  enableChat?: boolean;
  randomDrawerOrder?: boolean;
  showScoresAfterRound?: boolean;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  isPublic: boolean;
  isLocked: boolean;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  gameState: GameState;
  currentRound: number;
  maxRounds: number;
  roundDuration: number;
  createdAt: number;
  players?: Player[];
  spectators?: any[];
  currentDrawer?: string | null;
  timer?: number;
  startCountdown?: number | null;
  difficulty?: string;
  enableHints?: boolean;
  enableChat?: boolean;
  allowSpectators?: boolean;
};

export type Player = {
  id: string;
  authId: string;
  name: string;
  picture: string;
  isGuest: boolean;
  isHost?: boolean;
  score: number;
  hasGuessed: boolean;
  pointsGainedThisRound: number;
  hasDrawnThisRound: boolean;
  correctGuessesInGameCount: number;
  drawingsInGameCount: number;
  isReady?: boolean;
  joinedAt?: number;
};

export type GameStatePayload = {
  gameState: GameState;
  currentRound: number;
  maxRounds: number;
  currentDrawer: string | null;
  timer: number;
  wordChoices: string[];
  lobbyCountdown: number | null;
};

export type ChatMessage = {
  name: string;
  message: string;
  dateTime: string;
  picture?: string;
  isSystem?: boolean;
};

let socket: Socket | null = null;

export function initSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): void {
  if (socket && !socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}

// Authentication
export function authGoogle(token: string): void {
  socket?.emit("auth-google", token);
}

export function authFirebase(token: string): void {
  socket?.emit("auth-firebase", token);
}

export function authGuest(nickname: string): void {
  socket?.emit("auth-guest", nickname);
}

export function authResume(userId: string): void {
  socket?.emit("auth-resume", userId);
}

// Drawing events
export function emitStrokeStart(data: StrokeEvent): void {
  socket?.emit("stroke:start", data);
}

export function emitStrokeMove(data: StrokeEvent): void {
  socket?.emit("stroke:move", data);
}

export function emitStrokeEnd(data: StrokeEvent): void {
  socket?.emit("stroke:end", data);
}

export function emitCanvasClear(): void {
  socket?.emit("canvas:clear");
}

// Game actions
export function chooseWord(word: string): void {
  socket?.emit("choose-word", word);
}

export function sendMessage(message: string): void {
  socket?.emit("message", { message });
}

export function sendTypingFeedback(isTyping: boolean): void {
  socket?.emit("feedback", { isTyping });
}

export function requestLeaderboard(): void {
  socket?.emit("request-leaderboard");
}

// Event listeners
export function onAuthSuccess(callback: (user: any) => void): () => void {
  socket?.on("auth-success", callback);
  return () => socket?.off("auth-success", callback);
}

export function onAuthError(callback: (error: string) => void): () => void {
  socket?.on("auth-error", callback);
  return () => socket?.off("auth-error", callback);
}

export function onAuthExpired(callback: () => void): () => void {
  socket?.on("auth-expired", callback);
  return () => socket?.off("auth-expired", callback);
}

export function onGameStateUpdate(callback: (state: GameStatePayload) => void): () => void {
  socket?.on("game-state-update", callback);
  return () => socket?.off("game-state-update", callback);
}

export function onPlayersUpdate(callback: (players: Player[]) => void): () => void {
  socket?.on("players-update", callback);
  return () => socket?.off("players-update", callback);
}

export function onChatMessage(callback: (message: ChatMessage) => void): () => void {
  socket?.on("chat-message", callback);
  return () => socket?.off("chat-message", callback);
}

export function onStrokeStart(callback: (data: StrokeEvent) => void): () => void {
  socket?.on("stroke:start", callback);
  return () => socket?.off("stroke:start", callback);
}

export function onStrokeMove(callback: (data: StrokeEvent) => void): () => void {
  socket?.on("stroke:move", callback);
  return () => socket?.off("stroke:move", callback);
}

export function onStrokeEnd(callback: (data: StrokeEvent) => void): () => void {
  socket?.on("stroke:end", callback);
  return () => socket?.off("stroke:end", callback);
}

export function onCanvasClear(callback: () => void): () => void {
  socket?.on("canvas:clear", callback);
  return () => socket?.off("canvas:clear", callback);
}

export function onStrokeHistory(callback: (history: StrokeEvent[]) => void): () => void {
  socket?.on("stroke:history", callback);
  return () => socket?.off("stroke:history", callback);
}

export function onWordChoices(callback: (words: string[]) => void): () => void {
  socket?.on("word-choices", callback);
  return () => socket?.off("word-choices", callback);
}

export function onDrawerWord(callback: (word: string) => void): () => void {
  socket?.on("drawer-word", callback);
  return () => socket?.off("drawer-word", callback);
}

export function onMaskedWord(callback: (masked: string) => void): () => void {
  socket?.on("masked-word", callback);
  return () => socket?.off("masked-word", callback);
}

export function onTimerTick(callback: (time: number) => void): () => void {
  socket?.on("timer-tick", callback);
  return () => socket?.off("timer-tick", callback);
}

export function onLobbyCountdown(callback: (countdown: number | null) => void): () => void {
  socket?.on("lobby-countdown", callback);
  return () => socket?.off("lobby-countdown", callback);
}

export function onCorrectGuess(callback: (data: { id: string; name: string; points: number }) => void): () => void {
  socket?.on("correct-guess", callback);
  return () => socket?.off("correct-guess", callback);
}

export function onRoundResults(callback: (data: any) => void): () => void {
  socket?.on("round-results", callback);
  return () => socket?.off("round-results", callback);
}

export function onGameOver(callback: (data: any) => void): () => void {
  socket?.on("game-over", callback);
  return () => socket?.off("game-over", callback);
}

export function onLeaderboardUpdate(callback: (leaderboard: any[]) => void): () => void {
  socket?.on("leaderboard-update", callback);
  return () => socket?.off("leaderboard-update", callback);
}

export function onClientsTotal(callback: (total: number) => void): () => void {
  socket?.on("clients_total", callback);
  return () => socket?.off("clients_total", callback);
}

export function onPlayCorrectSound(callback: () => void): () => void {
  socket?.on("play-correct-sound", callback);
  return () => socket?.off("play-correct-sound", callback);
}

export function onTypingFeedback(callback: (data: { isTyping: boolean }) => void): () => void {
  socket?.on("feedback", callback);
  return () => socket?.off("feedback", callback);
}

export function onConnect(callback: () => void): () => void {
  socket?.on("connect", callback);
  return () => socket?.off("connect", callback);
}

export function onDisconnect(callback: () => void): () => void {
  socket?.on("disconnect", callback);
  return () => socket?.off("disconnect", callback);
}

export function onReconnect(callback: () => void): () => void {
  socket?.on("reconnect", callback);
  return () => socket?.off("reconnect", callback);
}

// ============= ROOM MANAGEMENT =============

export function createRoom(config: RoomConfig): void {
  socket?.emit("room:create", config);
}

export function joinRoom(roomCode: string): void {
  socket?.emit("room:join", roomCode);
}

export function quickPlay(): void {
  socket?.emit("room:quick-play");
}

export function leaveRoom(): void {
  socket?.emit("room:leave");
}

export function listPublicRooms(): void {
  socket?.emit("room:list-public");
}

export function lockRoom(): void {
  socket?.emit("room:lock");
}

export function unlockRoom(): void {
  socket?.emit("room:unlock");
}

// Room event listeners
export function onRoomJoined(callback: (data: { room: Room; asHost?: boolean; asSpectator?: boolean; reconnected?: boolean }) => void): () => void {
  socket?.on("room:joined", callback);
  return () => socket?.off("room:joined", callback);
}

export function onRoomError(callback: (error: string) => void): () => void {
  socket?.on("room:error", callback);
  return () => socket?.off("room:error", callback);
}

export function onRoomPublicList(callback: (rooms: Room[]) => void): () => void {
  socket?.on("room:public-list", callback);
  return () => socket?.off("room:public-list", callback);
}

export function onRoomPlayerJoined(callback: (data: { player: Player }) => void): () => void {
  socket?.on("room:player-joined", callback);
  return () => socket?.off("room:player-joined", callback);
}

export function onRoomPlayerLeft(callback: (data: { player: Player }) => void): () => void {
  socket?.on("room:player-left", callback);
  return () => socket?.off("room:player-left", callback);
}

export function onRoomHostChanged(callback: (data: { newHostId: string }) => void): () => void {
  socket?.on("room:host-changed", callback);
  return () => socket?.off("room:host-changed", callback);
}

export function onRoomUpdated(callback: (data: Partial<Room>) => void): () => void {
  socket?.on("room:updated", callback);
  return () => socket?.off("room:updated", callback);
}

export function onKicked(callback: (message: string) => void): () => void {
  socket?.on("kicked", callback);
  return () => socket?.off("kicked", callback);
}

// ============= GAME CONTROLS =============

export function startGame(): void {
  socket?.emit("game:start");
}

export function skipTurn(): void {
  socket?.emit("game:skip-turn");
}

export function endGame(): void {
  socket?.emit("game:end");
}

export function resetGame(): void {
  socket?.emit("game:reset");
}

export function kickPlayer(socketId: string): void {
  socket?.emit("game:kick-player", socketId);
}

export function onGameError(callback: (error: string) => void): () => void {
  socket?.on("game:error", callback);
  return () => socket?.off("game:error", callback);
}

// ============= WORD SELECTION =============

export function chooseWordNew(word: string): void {
  socket?.emit("word:choose", word);
}

// ============= COUNTDOWN =============

export function onCountdownTick(callback: (data: { count: number; type: string }) => void): () => void {
  socket?.on("countdown-tick", callback);
  return () => socket?.off("countdown-tick", callback);
}

// ============= SOUNDS =============

export function onPlaySound(callback: (soundName: string) => void): () => void {
  socket?.on("play-sound", callback);
  return () => socket?.off("play-sound", callback);
}

// ============= SERVER STATS =============

export function onServerStats(callback: (stats: { rooms: number; players: number }) => void): () => void {
  socket?.on("server-stats", callback);
  return () => socket?.off("server-stats", callback);
}

// ============= UNDO =============

export function emitCanvasUndo(): void {
  socket?.emit("canvas:undo");
}

export function onCanvasUndo(callback: () => void): () => void {
  socket?.on("canvas:undo", callback);
  return () => socket?.off("canvas:undo", callback);
}

