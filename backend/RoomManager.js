// Room Management System for Fast Draw Multiplayer Game
const crypto = require("crypto");

class Room {
  constructor(config) {
    this.id = config.id || generateRoomCode();
    this.code = this.id; // 6-character alphanumeric code
    this.name = config.name || `${config.hostName}'s Room`;
    this.hostId = config.hostId;
    this.hostName = config.hostName;
    this.creatorProfileId = config.creatorProfileId || null;
    
    // Room settings
    this.isPublic = config.isPublic !== false;
    this.isLocked = false;
    this.maxPlayers = Math.min(Math.max(config.maxPlayers || 8, 2), 12);
    this.maxRounds = Math.min(Math.max(config.maxRounds || 3, 1), 10);
    this.roundDuration = [30, 45, 60, 90, 120].includes(config.roundDuration) ? config.roundDuration : 60;
    this.wordSelectionDuration = config.wordSelectionDuration || 15;
    this.difficulty = ['easy', 'medium', 'hard'].includes(config.difficulty) ? config.difficulty : 'medium';
    this.customWords = Array.isArray(config.customWords) ? config.customWords : [];
    this.allowSpectators = config.allowSpectators !== false;
    this.enableHints = config.enableHints !== false;
    this.enableChat = config.enableChat !== false;
    this.randomDrawerOrder = config.randomDrawerOrder !== false;
    this.showScoresAfterRound = config.showScoresAfterRound !== false;
    
    // Game state
    this.players = {}; // socketId -> Player object
    this.spectators = {}; // socketId -> Spectator object
    this.disconnectedPlayers = {}; // authId -> { playerData, disconnectTime, timeout }
    this.drawingHistory = [];
    this.gameState = 'waiting'; // 'waiting' | 'starting' | 'word_selection' | 'drawing' | 'round_end' | 'game_end'
    this.currentRound = 0;
    this.currentDrawer = null;
    this.currentDrawerProfileId = null;
    this.drawerDevice = 'desktop';
    this.currentWord = '';
    this.wordChoices = [];
    this.timer = 0;
    this.timerInterval = null;
    this.startCountdown = null;
    this.startCountdownInterval = null;
    this.drawersInRound = [];
    this.drawerIndex = 0;
    this.bannedSocketIds = new Set();
    this.kickVotes = {};
    this.hintRevealed = 0; // Number of letters revealed
    this.usedWords = new Set(); // Track used words in current match
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  // Player management
  addPlayer(socketId, profile) {
    if (this.isLocked && !this.disconnectedPlayers[profile?.id]) {
      return { success: false, error: 'Room is locked' };
    }
    
    // Auto-reclaim host status if creator is returning
    if (profile && profile.id === this.creatorProfileId && this.hostId !== socketId) {
      if (this.hostId && this.players[this.hostId]) {
        this.players[this.hostId].isHost = false;
      }
      this.hostId = socketId;
      this.hostName = profile.name;
    }
    
    // Auto-reclaim drawer status if the returning player was the drawer
    if (profile && profile.id === this.currentDrawerProfileId && this.currentDrawer !== socketId) {
      this.currentDrawer = socketId;
    }
    
    // Check if this player was disconnected (grace period) — restore their data
    const dcData = profile?.id ? this.disconnectedPlayers[profile.id] : null;
    if (dcData) {
      clearTimeout(dcData.timeout);
      delete this.disconnectedPlayers[profile.id];
      
      const oldSocketId = dcData.socketId;
      const oldPlayerData = this.players[oldSocketId];
      if (oldPlayerData) {
        delete this.players[oldSocketId];
        this.players[socketId] = {
          ...oldPlayerData,
          id: socketId,
          isDisconnected: false, // clear disconnected flag
          joinedAt: Date.now()
        };
      } else {
        // Fallback if old player data was somehow deleted
        this.players[socketId] = {
          ...dcData.playerData,
          id: socketId,
          isDisconnected: false,
          joinedAt: Date.now()
        };
      }
      
      if (socketId === this.hostId) this.players[socketId].isHost = true;
      if (dcData.wasDrawer) {
        this.currentDrawer = socketId;
      }
      
      this.lastActivity = Date.now();
      console.log(`[REJOIN] Player ${profile.name} restored with score ${this.players[socketId].score}`);
      return { success: true, asSpectator: false, reconnected: true };
    }

    // Check for duplicate player with same profile.id (authId) already active in room
    if (profile && profile.id) {
      let duplicateSocketId = null;
      for (const [sid, p] of Object.entries(this.players)) {
        if (p.authId === profile.id) {
          duplicateSocketId = sid;
          break;
        }
      }
      if (duplicateSocketId && duplicateSocketId !== socketId) {
        console.log(`[SELF-HEAL] Duplicate player ${profile.name} found. Replacing old socket ${duplicateSocketId} with new socket ${socketId}`);
        const oldPlayerData = this.players[duplicateSocketId];
        delete this.players[duplicateSocketId];
        
        this.players[socketId] = {
          ...oldPlayerData,
          id: socketId,
          isDisconnected: false,
          joinedAt: Date.now()
        };
        
        if (duplicateSocketId === this.hostId) {
          this.hostId = socketId;
          this.players[socketId].isHost = true;
        }
        if (this.currentDrawer === duplicateSocketId) {
          this.currentDrawer = socketId;
        }
        
        this.lastActivity = Date.now();
        return { success: true, asSpectator: false, reconnected: true };
      }
    }
    
    if (this.getPlayerCount() >= this.maxPlayers) {
      if (this.allowSpectators) {
        this.spectators[socketId] = {
          id: socketId,
          authId: profile.id,
          name: profile.name,
          picture: profile.picture,
          isGuest: profile.isGuest
        };
        return { success: true, asSpectator: true };
      }
      return { success: false, error: 'Room is full' };
    }
    
    this.players[socketId] = {
      id: socketId,
      authId: profile.id,
      name: profile.name,
      picture: profile.picture,
      isGuest: profile.isGuest,
      isHost: socketId === this.hostId,
      score: 0,
      hasGuessed: false,
      pointsGainedThisRound: 0,
      hasDrawnThisRound: false,
      correctGuessesInGameCount: 0,
      drawingsInGameCount: 0,
      isReady: false,
      isDisconnected: false,
      joinedAt: Date.now()
    };
    
    this.lastActivity = Date.now();
    return { success: true, asSpectator: false };
  }

  removePlayer(socketId) {
    const wasPlayer = !!this.players[socketId];
    delete this.players[socketId];
    delete this.spectators[socketId];
    delete this.kickVotes[socketId];
    
    // Transfer host if needed
    if (socketId === this.hostId) {
      const playerIds = Object.keys(this.players);
      if (playerIds.length > 0) {
        this.hostId = playerIds[0];
        this.players[this.hostId].isHost = true;
        this.hostName = this.players[this.hostId].name;
      } else {
        this.hostId = null;
      }
    }
    
    this.lastActivity = Date.now();
    return { wasPlayer, newHost: this.hostId };
  }

  // Mark a player as disconnected (grace period before permanent removal)
  markPlayerDisconnected(socketId, onExpire) {
    const player = this.players[socketId];
    if (!player) return null;
    
    const authId = player.authId;
    const wasDrawer = this.currentDrawer === socketId;
    
    player.isDisconnected = true;
    
    // Transfer host if needed to an active player
    if (socketId === this.hostId) {
      const activePlayerIds = Object.keys(this.players).filter(sid => sid !== socketId && !this.players[sid].isDisconnected);
      if (activePlayerIds.length > 0) {
        this.hostId = activePlayerIds[0];
        this.players[this.hostId].isHost = true;
        this.hostName = this.players[this.hostId].name;
      }
    }
    
    // Save info for expiry cleanup
    const playerData = { ...player };
    
    // Store in disconnectedPlayers with a 60-second timeout
    const GRACE_PERIOD = 60 * 1000; // 60 seconds
    const timeout = setTimeout(() => {
      delete this.disconnectedPlayers[authId];
      // Permanently remove from players list upon expiration
      if (this.players[socketId] && this.players[socketId].isDisconnected) {
        delete this.players[socketId];
      }
      console.log(`[DC-EXPIRE] Player ${playerData.name} grace period expired, permanently removed`);
      if (onExpire) onExpire();
    }, GRACE_PERIOD);
    
    this.disconnectedPlayers[authId] = {
      socketId,
      playerData,
      wasDrawer,
      disconnectTime: Date.now(),
      timeout
    };
    
    console.log(`[DC-GRACE] Player ${playerData.name} (${authId}) marked as disconnected/away (60s)`);
    this.lastActivity = Date.now();
    return { wasPlayer: true, newHost: this.hostId, gracePeriod: true, playerData };
  }

  getPlayer(socketId) {
    return this.players[socketId] || this.spectators[socketId] || null;
  }

  isEmpty() {
    return Object.keys(this.players).length === 0 && 
           Object.keys(this.spectators).length === 0 &&
           Object.keys(this.disconnectedPlayers).length === 0;
  }

  getPlayerCount() {
    // Only count active players who are not disconnected/away
    return Object.values(this.players).filter(p => !p.isDisconnected).length;
  }

  getSpectatorCount() {
    return Object.keys(this.spectators).length;
  }

  canStart() {
    return this.gameState === 'waiting' && this.getPlayerCount() >= 1;
  }

  // State management
  setState(newState) {
    const validTransitions = {
      'waiting': ['starting'],
      'starting': ['word_selection'],
      'word_selection': ['drawing'],
      'drawing': ['round_end'],
      'round_end': ['word_selection', 'game_end', 'waiting'],
      'game_end': ['waiting']
    };
    
    const currentState = this.gameState;
    if (validTransitions[currentState] && validTransitions[currentState].includes(newState)) {
      this.gameState = newState;
      this.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  clearTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.startCountdownInterval) {
      clearInterval(this.startCountdownInterval);
      this.startCountdownInterval = null;
    }
  }

  resetGameState() {
    this.clearTimers();
    this.gameState = 'waiting';
    this.currentRound = 0;
    this.currentDrawer = null;
    this.currentDrawerProfileId = null;
    this.drawerDevice = 'desktop';
    this.currentWord = '';
    this.wordChoices = [];
    this.timer = 0;
    this.startCountdown = null;
    this.drawersInRound = [];
    this.drawerIndex = 0;
    this.drawingHistory = [];
    this.hintRevealed = 0;
    this.kickVotes = {};
    
    // Reset player scores
    Object.values(this.players).forEach(player => {
      player.score = 0;
      player.hasGuessed = false;
      player.pointsGainedThisRound = 0;
      player.hasDrawnThisRound = false;
      player.correctGuessesInGameCount = 0;
      player.drawingsInGameCount = 0;
      player.isReady = false;
    });
  }

  // Serialization for network transmission
  toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      hostId: this.hostId,
      hostName: this.hostName,
      isPublic: this.isPublic,
      isLocked: this.isLocked,
      playerCount: this.getPlayerCount(),
      spectatorCount: this.getSpectatorCount(),
      maxPlayers: this.maxPlayers,
      gameState: this.gameState,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      roundDuration: this.roundDuration,
      createdAt: this.createdAt
    };
  }

  toDetailedJSON() {
    return {
      ...this.toJSON(),
      players: Object.values(this.players),
      spectators: Object.values(this.spectators),
      currentDrawer: this.currentDrawer,
      drawerDevice: this.drawerDevice,
      timer: this.timer,
      startCountdown: this.startCountdown,
      difficulty: this.difficulty,
      enableHints: this.enableHints,
      enableChat: this.enableChat,
      allowSpectators: this.allowSpectators
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
    this.playerToRoom = new Map(); // socketId -> roomId
    this.cleanupInterval = null;
    this.startCleanupTask();
  }

  createRoom(config) {
    const room = new Room(config);
    this.rooms.set(room.id, room);
    this.playerToRoom.set(config.hostId, room.id);
    console.log(`Room created: ${room.id} (${room.name}) by ${room.hostName}`);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  getRoomByCode(code) {
    const normalizedCode = code.toUpperCase().trim();
    for (const room of this.rooms.values()) {
      if (room.code === normalizedCode) {
        return room;
      }
    }
    return null;
  }

  getPlayerRoom(socketId) {
    const roomId = this.playerToRoom.get(socketId);
    return roomId ? this.getRoom(roomId) : null;
  }

  joinRoom(roomId, socketId, profile) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    const result = room.addPlayer(socketId, profile);
    if (result.success) {
      this.playerToRoom.set(socketId, roomId);
    }
    return result;
  }

  leaveRoom(socketId) {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) {
      return null;
    }
    
    const room = this.getRoom(roomId);
    if (!room) {
      this.playerToRoom.delete(socketId);
      return null;
    }
    
    const result = room.removePlayer(socketId);
    this.playerToRoom.delete(socketId);
    
    // Remove room if empty
    if (room.isEmpty()) {
      this.deleteRoom(roomId);
    }
    
    return { room, ...result };
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.clearTimers();
      // Remove all player mappings
      for (const socketId of Object.keys(room.players)) {
        this.playerToRoom.delete(socketId);
      }
      for (const socketId of Object.keys(room.spectators)) {
        this.playerToRoom.delete(socketId);
      }
      this.rooms.delete(roomId);
      console.log(`Room deleted: ${roomId}`);
    }
  }

  getPublicRooms() {
    const publicRooms = [];
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.gameState === 'waiting' && !room.isLocked) {
        publicRooms.push(room.toJSON());
      }
    }
    return publicRooms.sort((a, b) => b.createdAt - a.createdAt);
  }

  findBestPublicRoom() {
    // Find a public room that's waiting and not full
    const availableRooms = [];
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.gameState === 'waiting' && !room.isLocked) {
        const playerCount = room.getPlayerCount();
        if (playerCount < room.maxPlayers) {
          availableRooms.push({ room, playerCount });
        }
      }
    }
    
    // Prioritize rooms with more players (but not full)
    availableRooms.sort((a, b) => b.playerCount - a.playerCount);
    return availableRooms.length > 0 ? availableRooms[0].room : null;
  }

  // Cleanup idle rooms
  startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      
      for (const [roomId, room] of this.rooms.entries()) {
        if (now - room.lastActivity > IDLE_TIMEOUT) {
          console.log(`Cleaning up idle room: ${roomId}`);
          this.deleteRoom(roomId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  stopCleanupTask() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getRoomCount() {
    return this.rooms.size;
  }

  getTotalPlayers() {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.getPlayerCount() + room.getSpectatorCount();
    }
    return total;
  }

  // Find a room where a profile ID has a disconnected player waiting
  findRoomByProfile(authId) {
    for (const room of this.rooms.values()) {
      // Check disconnected players
      if (room.disconnectedPlayers[authId]) {
        return room;
      }
      // Check active players (already in room)
      for (const player of Object.values(room.players)) {
        if (player.authId === authId) {
          return room;
        }
      }
    }
    return null;
  }
}

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

module.exports = { Room, RoomManager, generateRoomCode };
