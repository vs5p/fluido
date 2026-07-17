import { create } from "zustand";
import type { User } from "firebase/auth";
import type { MockUser } from "@/lib/firebase";
import type { GameState, Player as BackendPlayer } from "@/lib/socket";

export type Player = BackendPlayer;

export type ChatMessage = {
  id: string;
  uid?: string;
  displayName?: string;
  name: string;
  message: string;
  dateTime: string;
  picture?: string;
  isSystem?: boolean;
  isCorrect?: boolean;
  // legacy compat
  text?: string;
  sentAt?: number;
};

export type AuthUser = User | MockUser | null;

type State = {
  // Auth
  user: AuthUser;
  userProfile: any | null;
  setUser: (u: AuthUser) => void;
  setUserProfile: (profile: any) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Game state
  gameState: GameState;
  setGameState: (state: GameState) => void;

  currentRound: number;
  maxRounds: number;
  setRounds: (current: number, max: number) => void;

  currentDrawer: string | null;
  setCurrentDrawer: (drawer: string | null) => void;

  timer: number;
  setTimer: (time: number) => void;

  startCountdown: number | null;
  setStartCountdown: (n: number | null) => void;

  // Word
  wordChoices: string[];
  setWordChoices: (words: string[]) => void;

  currentWord: string;
  setCurrentWord: (word: string) => void;

  maskedWord: string;
  setMaskedWord: (masked: string) => void;

  // Players
  players: Player[];
  setPlayers: (p: Player[]) => void;

  // Chat
  messages: ChatMessage[];
  pushMessage: (m: Partial<ChatMessage> & { id?: string }) => void;
  clearMessages: () => void;

  // UI
  drawerDevice: "mobile" | "desktop";
  setDrawerDevice: (d: "mobile" | "desktop") => void;

  // Leaderboard
  leaderboard: any[];
  setLeaderboard: (lb: any[]) => void;

  // Auth Ready
  authReady: boolean;
  setAuthReady: (ready: boolean) => void;

  // Round results
  roundResults: any | null;
  setRoundResults: (results: any) => void;

  // Game over
  gameOverData: any | null;
  setGameOverData: (data: any) => void;

  // Room info
  roomCode: string;
  roomName: string;
  setRoomInfo: (code: string, name: string) => void;
};

export const useGame = create<State>((set) => ({
  user: null,
  userProfile: null,
  setUser: (u) => set({ user: u }),
  setUserProfile: (profile) => set({ userProfile: profile }),

  isConnected: false,
  setConnected: (isConnected) => set({ isConnected }),

  gameState: 'waiting',
  setGameState: (gameState) => set({ gameState }),

  currentRound: 0,
  maxRounds: 3,
  setRounds: (current, max) => set({ currentRound: current, maxRounds: max }),

  currentDrawer: null,
  setCurrentDrawer: (currentDrawer) => set({ currentDrawer }),

  timer: 0,
  setTimer: (timer) => set({ timer }),

  startCountdown: null,
  setStartCountdown: (startCountdown) => set({ startCountdown }),

  wordChoices: [],
  setWordChoices: (wordChoices) => set({ wordChoices }),

  currentWord: "",
  setCurrentWord: (currentWord) => set({ currentWord }),

  maskedWord: "",
  setMaskedWord: (maskedWord) => set({ maskedWord }),

  players: [],
  setPlayers: (players) => set({ players }),

  messages: [],
  pushMessage: (m) =>
    set((s) => {
      const msg: ChatMessage = {
        id: m.id || crypto.randomUUID(),
        name: m.name || m.displayName || "System",
        message: m.message || m.text || "",
        dateTime: m.dateTime || new Date().toISOString(),
        picture: m.picture,
        isSystem: m.isSystem,
        isCorrect: m.isCorrect,
        uid: m.uid,
        displayName: m.displayName,
        text: m.text,
        sentAt: m.sentAt,
      };
      return { messages: [...s.messages, msg].slice(-200) };
    }),
  clearMessages: () => set({ messages: [] }),

  drawerDevice: "desktop",
  setDrawerDevice: (drawerDevice) => set({ drawerDevice }),

  leaderboard: [],
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  roundResults: null,
  setRoundResults: (roundResults) => set({ roundResults }),

  gameOverData: null,
  setGameOverData: (gameOverData) => set({ gameOverData }),

  roomCode: "",
  roomName: "",
  setRoomInfo: (roomCode, roomName) => set({ roomCode, roomName }),

  authReady: false,
  setAuthReady: (authReady) => set({ authReady }),
}));
