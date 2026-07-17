import { create } from "zustand";
import type { Room } from "@/lib/socket";

type RoomState = {
  // Current room
  currentRoom: Room | null;
  isInRoom: boolean;
  isHost: boolean;
  isSpectator: boolean;
  
  // Public rooms list
  publicRooms: Room[];
  
  // UI state
  isCreatingRoom: boolean;
  isJoiningRoom: boolean;
  showCreateModal: boolean;
  showJoinModal: boolean;
  roomError: string | null;
  
  // Actions
  setCurrentRoom: (room: Room | null) => void;
  setIsInRoom: (inRoom: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setIsSpectator: (isSpectator: boolean) => void;
  setPublicRooms: (rooms: Room[]) => void;
  setIsCreatingRoom: (creating: boolean) => void;
  setIsJoiningRoom: (joining: boolean) => void;
  setShowCreateModal: (show: boolean) => void;
  setShowJoinModal: (show: boolean) => void;
  setRoomError: (error: string | null) => void;
  leaveCurrentRoom: () => void;
  updateRoomProperty: (updates: Partial<Room>) => void;
};

export const useRoom = create<RoomState>((set) => ({
  // State
  currentRoom: null,
  isInRoom: false,
  isHost: false,
  isSpectator: false,
  publicRooms: [],
  isCreatingRoom: false,
  isJoiningRoom: false,
  showCreateModal: false,
  showJoinModal: false,
  roomError: null,
  
  // Actions
  setCurrentRoom: (room) => set({
    currentRoom: room,
    isInRoom: !!room,
  }),
  
  setIsInRoom: (isInRoom) => set({ isInRoom }),
  
  setIsHost: (isHost) => set({ isHost }),
  
  setIsSpectator: (isSpectator) => set({ isSpectator }),
  
  setPublicRooms: (rooms) => set({ publicRooms: rooms }),
  
  setIsCreatingRoom: (creating) => set({ isCreatingRoom: creating }),
  
  setIsJoiningRoom: (joining) => set({ isJoiningRoom: joining }),
  
  setShowCreateModal: (show) => set({ showCreateModal: show }),
  
  setShowJoinModal: (show) => set({ showJoinModal: show }),
  
  setRoomError: (error) => set({ roomError: error }),
  
  leaveCurrentRoom: () => set({
    currentRoom: null,
    isInRoom: false,
    isHost: false,
    isSpectator: false,
  }),
  
  updateRoomProperty: (updates) => set((state) => ({
    currentRoom: state.currentRoom ? { ...state.currentRoom, ...updates } : null,
  })),
}));
