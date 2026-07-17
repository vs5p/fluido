require('dotenv').config();
const express = require("express");
const cors = require("cors");
const app = express();
const db = require("./db");
const { RoomManager } = require("./RoomManager");
const GameEngine = require("./GameEngine");

const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    rooms: roomManager.getRoomCount(),
    players: roomManager.getTotalPlayers(),
    uptime: process.uptime()
  });
});

// Room list API endpoint
app.get('/api/rooms/public', (req, res) => {
  const publicRooms = roomManager.getPublicRooms();
  res.json({ rooms: publicRooms });
});

const server = app.listen(PORT, () => {
  console.log(`✨ Fluido Server running on port ${PORT}`);
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize room manager
const roomManager = new RoomManager();

// Google Auth Verification Helper
async function verifyGoogleToken(token) {
  if (token.startsWith('dev-token-')) {
    const name = token.replace('dev-token-', '').trim() || 'Developer';
    return {
      sub: `dev-google-${name.toLowerCase().replace(/\s+/g, '-')}`,
      email: `${name.toLowerCase()}@dev.local`,
      name: name,
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`
    };
  }

  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!res.ok) {
      throw new Error('Failed to verify token with Google');
    }
    const data = await res.json();
    if (data.error_description) {
      throw new Error(data.error_description);
    }
    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture
    };
  } catch (err) {
    console.error('Google token verification failed:', err);
    throw err;
  }
}

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  let currentRoom = null;
  let userProfile = null;

  // Send server stats
  socket.emit("server-stats", {
    rooms: roomManager.getRoomCount(),
    players: roomManager.getTotalPlayers()
  });

  // ============= AUTHENTICATION =============

  socket.on("auth-firebase", async (token) => {
    try {
      let uid, name, email, picture;

      if (token.startsWith('mock-token-') || token.startsWith('dev-token-')) {
        // Format: mock-token-{uid}::{displayName}  or  dev-token-{displayName}
        if (token.startsWith('mock-token-')) {
          const withoutPrefix = token.slice('mock-token-'.length);
          const separatorIdx = withoutPrefix.indexOf('::');
          if (separatorIdx !== -1) {
            uid = withoutPrefix.slice(0, separatorIdx);
            name = withoutPrefix.slice(separatorIdx + 2) || 'User';
          } else {
            uid = withoutPrefix;
            name = uid.split('-').slice(-1)[0] || 'User';
          }
        } else {
          // dev-token-{displayName}
          name = token.slice('dev-token-'.length).trim() || 'Developer';
          uid = `dev-${name.toLowerCase().replace(/\s+/g, '-')}`;
        }
        email = `${uid.toLowerCase().replace(/[^a-z0-9]/g, '')}@dev.local`;
        picture = `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
        console.log(`[AUTH] Mock Firebase token decoded for: ${name} (uid: ${uid})`);
      } else {
        // Securely verify Firebase ID token via Admin SDK
        if (db.isFirebaseEnabled()) {
          const decodedToken = await db.verifyIdToken(token);
          uid = decodedToken.uid;
          email = decodedToken.email || '';
          name = decodedToken.name || decodedToken.displayName || email.split('@')[0] || 'User';
          picture = decodedToken.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
          console.log(`[AUTH] Secure Firebase token verified for: ${name} (uid: ${uid})`);
        } else {
          throw new Error('Firebase integration is disabled on this server.');
        }
      }

      userProfile = await db.createUserOrUpdate(uid, {
        name,
        email,
        picture,
        isGuest: false
      });

      socket.emit("auth-success", userProfile);
      console.log(`✅ User authenticated: ${userProfile.name} (${socket.id})`);
    } catch (err) {
      console.error('[AUTH] Firebase auth error:', err);
      socket.emit("auth-error", `Authentication failed: ${err.message}`);
    }
  });

  socket.on("auth-google", async (token) => {
    try {
      const googleProfile = await verifyGoogleToken(token);
      userProfile = await db.createUserOrUpdate(googleProfile.sub, {
        name: googleProfile.name,
        email: googleProfile.email,
        picture: googleProfile.picture,
        isGuest: false
      });

      socket.emit("auth-success", userProfile);
      console.log(`✅ User authenticated: ${userProfile.name} (${socket.id})`);
    } catch (err) {
      console.error(err);
      socket.emit("auth-error", "Invalid Google credentials. Please try again.");
    }
  });

  socket.on("auth-guest", async (nickname) => {
    const cleanNick = nickname.trim().substring(0, 15) || 'Guest';
    const guestId = `guest-${Math.random().toString(36).substring(2, 11)}`;
    userProfile = await db.createUserOrUpdate(guestId, {
      name: cleanNick,
      isGuest: true,
      picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanNick}`
    });

    socket.emit("auth-success", userProfile);
    console.log(`👤 Guest joined: ${userProfile.name} (${socket.id})`);
  });

  socket.on("auth-resume", async (userId) => {
    const profile = await db.getUser(userId);
    if (profile) {
      userProfile = profile;
      socket.emit("auth-success", userProfile);
    } else {
      socket.emit("auth-expired");
    }
  });

  // ============= ROOM MANAGEMENT =============

  socket.on("room:create", (config) => {
    if (!userProfile) {
      socket.emit("room:error", "Must be authenticated to create room");
      return;
    }

    if (userProfile.isGuest) {
      socket.emit("room:error", "Guests cannot create rooms. Please sign in.");
      return;
    }

    if (currentRoom) {
      handleLeaveRoom();
    }

    const room = roomManager.createRoom({
      ...config,
      hostId: socket.id,
      hostName: userProfile.name
    });

    const result = roomManager.joinRoom(room.id, socket.id, userProfile);
    if (result.success) {
      currentRoom = room;
      const engine = new GameEngine(room, io, db);
      
      socket.emit("room:joined", {
        room: room.toDetailedJSON(),
        asHost: true
      });

      console.log(`🎮 Room created: ${room.code} by ${userProfile.name}`);
    } else {
      roomManager.deleteRoom(room.id);
      socket.emit("room:error", result.error);
    }
  });

  socket.on("room:join", (roomCode) => {
    if (!userProfile) {
      socket.emit("room:error", "Must be authenticated to join room");
      return;
    }

    if (currentRoom) {
      handleLeaveRoom();
    }

    const room = roomManager.getRoomByCode(roomCode);
    if (!room) {
      socket.emit("room:error", "Room not found");
      return;
    }

    const result = roomManager.joinRoom(room.id, socket.id, userProfile);
    if (result.success) {
      currentRoom = room;
      const engine = new GameEngine(room, io, db);
      
      socket.emit("room:joined", {
        room: room.toDetailedJSON(),
        asSpectator: result.asSpectator
      });

      // Send drawing history
      socket.emit("stroke:history", room.drawingHistory);

      // Notify others
      engine.broadcast('room:player-joined', {
        player: room.players[socket.id] || room.spectators[socket.id]
      });

      engine.broadcast('chat-message', {
        name: 'System',
        message: `${userProfile.name} joined the room!`,
        isSystem: true,
        dateTime: new Date().toISOString()
      });

      engine.broadcastPlayers();
      console.log(`➕ ${userProfile.name} joined room ${room.code}`);
    } else {
      socket.emit("room:error", result.error);
    }
  });

  socket.on("room:quick-play", () => {
    if (!userProfile) {
      socket.emit("room:error", "Must be authenticated");
      return;
    }

    if (currentRoom) {
      socket.emit("room:error", "Already in a room");
      return;
    }

    // Try to find existing public room
    let room = roomManager.findBestPublicRoom();

    // Create new public room if none available
    if (!room) {
      room = roomManager.createRoom({
        name: "Quick Play Room",
        hostId: socket.id,
        hostName: userProfile.name,
        isPublic: true,
        maxPlayers: 8,
        maxRounds: 3,
        roundDuration: 60
      });
      console.log(`🚀 Quick Play room auto-created: ${room.code}`);
    }

    const result = roomManager.joinRoom(room.id, socket.id, userProfile);
    if (result.success) {
      currentRoom = room;
      const engine = new GameEngine(room, io, db);
      
      socket.emit("room:joined", {
        room: room.toDetailedJSON(),
        asHost: room.hostId === socket.id,
        asSpectator: result.asSpectator
      });

      socket.emit("stroke:history", room.drawingHistory);

      engine.broadcast('room:player-joined', {
        player: room.players[socket.id] || room.spectators[socket.id]
      });

      engine.broadcast('chat-message', {
        name: 'System',
        message: `${userProfile.name} joined the room!`,
        isSystem: true,
        dateTime: new Date().toISOString()
      });

      engine.broadcastPlayers();
      
      // Auto-start if enough players
      if (room.canStart() && !room.startCountdownInterval) {
        setTimeout(() => {
          if (room.canStart() && room.gameState === 'waiting') {
            engine.startGameCountdown();
          }
        }, 3000);
      }
    } else {
      socket.emit("room:error", result.error);
    }
  });

  socket.on("room:leave", () => {
    handleLeaveRoom();
  });

  socket.on("room:list-public", () => {
    const publicRooms = roomManager.getPublicRooms();
    socket.emit("room:public-list", publicRooms);
  });

  socket.on("room:lock", () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      socket.emit("room:error", "Only host can lock room");
      return;
    }
    currentRoom.isLocked = true;
    const engine = new GameEngine(currentRoom, io, db);
    engine.broadcast('room:updated', { isLocked: true });
  });

  socket.on("room:unlock", () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      socket.emit("room:error", "Only host can unlock room");
      return;
    }
    currentRoom.isLocked = false;
    const engine = new GameEngine(currentRoom, io, db);
    engine.broadcast('room:updated', { isLocked: false });
  });

  // ============= GAME CONTROLS =============

  socket.on("game:start", () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      socket.emit("game:error", "Only host can start game");
      return;
    }

    if (!currentRoom.canStart()) {
      socket.emit("game:error", "Need at least 1 player to start");
      return;
    }

    const engine = new GameEngine(currentRoom, io, db);
    engine.startGameCountdown();
  });

  socket.on("game:skip-turn", () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      return;
    }

    const engine = new GameEngine(currentRoom, io, db);
    engine.skipTurn();
  });

  socket.on("game:end", () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      return;
    }

    const engine = new GameEngine(currentRoom, io, db);
    engine.resetToWaiting("Game ended by host.");
  });

  socket.on("game:kick-player", (targetSocketId) => {
    if (!currentRoom || currentRoom.hostId !== socket.id) {
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit("kicked", "You were removed from the room by the host.");
      targetSocket.disconnect(true);
    }
  });

  // ============= WORD SELECTION =============

  socket.on("word:choose", (word) => {
    if (!currentRoom || currentRoom.gameState !== 'word_selection') {
      return;
    }

    if (socket.id !== currentRoom.currentDrawer) {
      return;
    }

    if (!currentRoom.wordChoices.includes(word)) {
      return;
    }

    const engine = new GameEngine(currentRoom, io, db);
    clearInterval(currentRoom.timerInterval);
    currentRoom.timerInterval = null;
    engine.startDrawing(word);
  });



  // ============= DRAWING =============

  socket.on("stroke:start", (data) => {
    if (!currentRoom) return;
    
    const canDraw = currentRoom.gameState === 'waiting' || 
                    (currentRoom.gameState === 'drawing' && socket.id === currentRoom.currentDrawer);
    
    if (canDraw) {
      const strokeEvent = { ...data, type: 'start' };
      currentRoom.drawingHistory.push(strokeEvent);
      socket.broadcast.to(Object.keys(currentRoom.players)).emit("stroke:start", data);
      Object.keys(currentRoom.spectators).forEach(id => {
        io.to(id).emit("stroke:start", data);
      });
    }
  });

  socket.on("stroke:move", (data) => {
    if (!currentRoom) return;
    
    const canDraw = currentRoom.gameState === 'waiting' || 
                    (currentRoom.gameState === 'drawing' && socket.id === currentRoom.currentDrawer);
    
    if (canDraw) {
      const strokeEvent = { ...data, type: 'move' };
      currentRoom.drawingHistory.push(strokeEvent);
      socket.broadcast.to(Object.keys(currentRoom.players)).emit("stroke:move", data);
      Object.keys(currentRoom.spectators).forEach(id => {
        io.to(id).emit("stroke:move", data);
      });
    }
  });

  socket.on("stroke:end", (data) => {
    if (!currentRoom) return;
    
    const canDraw = currentRoom.gameState === 'waiting' || 
                    (currentRoom.gameState === 'drawing' && socket.id === currentRoom.currentDrawer);
    
    if (canDraw) {
      const strokeEvent = { ...data, type: 'end' };
      currentRoom.drawingHistory.push(strokeEvent);
      socket.broadcast.to(Object.keys(currentRoom.players)).emit("stroke:end", data);
      Object.keys(currentRoom.spectators).forEach(id => {
        io.to(id).emit("stroke:end", data);
      });
    }
  });

  socket.on("canvas:clear", () => {
    if (!currentRoom) return;
    
    const canClear = currentRoom.gameState === 'waiting' || 
                     (currentRoom.gameState === 'drawing' && socket.id === currentRoom.currentDrawer);
    
    if (canClear) {
      currentRoom.drawingHistory = [];
      const engine = new GameEngine(currentRoom, io, db);
      engine.broadcast("canvas:clear");
    }
  });

  socket.on("canvas:undo", () => {
    if (!currentRoom) return;
    const canUndo = currentRoom.gameState === 'waiting' || 
                    (currentRoom.gameState === 'drawing' && socket.id === currentRoom.currentDrawer);
    if (canUndo && currentRoom.drawingHistory && currentRoom.drawingHistory.length > 0) {
      let lastStartIndex = -1;
      for (let i = currentRoom.drawingHistory.length - 1; i >= 0; i--) {
        if (currentRoom.drawingHistory[i].type === 'start') {
          lastStartIndex = i;
          break;
        }
      }
      if (lastStartIndex !== -1) {
        currentRoom.drawingHistory = currentRoom.drawingHistory.slice(0, lastStartIndex);
        const engine = new GameEngine(currentRoom, io, db);
        engine.broadcast("canvas:undo");
      }
    }
  });

  // ============= CHAT & GUESSING =============

  socket.on("message", (data) => {
    if (!currentRoom) return;
    
    const player = currentRoom.players[socket.id];
    if (!player) return;

    const messageText = (data.message || '').trim();
    if (!messageText) return;

    // Votekick mechanism
    if (messageText.startsWith('/votekick ')) {
      handleVoteKick(messageText.substring(10).trim());
      return;
    }

    // During drawing phase, intercept as guess
    if (currentRoom.gameState === 'drawing') {
      // Drawer cannot chat
      if (socket.id === currentRoom.currentDrawer) {
        socket.emit("chat-message", {
          name: "System",
          message: "You are the Drawer! You cannot chat during your turn.",
          isSystem: true,
          dateTime: new Date().toISOString()
        });
        return;
      }

      // Already guessed correctly
      if (player.hasGuessed) {
        socket.emit("chat-message", {
          name: "System",
          message: "You already guessed correctly! Please wait for others.",
          isSystem: true,
          dateTime: new Date().toISOString()
        });
        return;
      }

      // Process guess
      const engine = new GameEngine(currentRoom, io, db);
      const result = engine.processGuess(socket.id, messageText);

      if (result.correct) {
        return; // Engine handles correct guess notification
      }

      if (result.close) {
        socket.emit("chat-message", {
          name: "System",
          message: `"${messageText}" is so close!`,
          isSystem: true,
          dateTime: new Date().toISOString()
        });
      }

      // Show guess in chat as wrong
      const chatMsg = {
        name: player.name,
        message: messageText,
        picture: player.picture,
        dateTime: new Date().toISOString(),
        isSystem: false
      };
      const engine2 = new GameEngine(currentRoom, io, db);
      engine2.broadcast("chat-message", chatMsg);
      return;
    }

    // Normal chat message
    const chatPayload = {
      name: player.name,
      message: messageText,
      dateTime: new Date().toISOString(),
      picture: player.picture,
      isSystem: false
    };

    const engine = new GameEngine(currentRoom, io, db);
    engine.broadcast("chat-message", chatPayload);
  });

  // Helper: Vote kick
  function handleVoteKick(targetName) {
    if (!currentRoom) return;

    const targetEntry = Object.entries(currentRoom.players).find(
      ([_, p]) => p.name.toLowerCase() === targetName.toLowerCase()
    );

    if (!targetEntry) {
      socket.emit("chat-message", {
        name: "System",
        message: `Player '${targetName}' not found.`,
        isSystem: true,
        dateTime: new Date().toISOString()
      });
      return;
    }

    const [targetId, targetPlayer] = targetEntry;
    if (!currentRoom.kickVotes[targetId]) {
      currentRoom.kickVotes[targetId] = new Set();
    }

    currentRoom.kickVotes[targetId].add(socket.id);

    const activeCount = Object.keys(currentRoom.players).length;
    const votesNeeded = Math.floor(activeCount / 2) + 1;

    const engine = new GameEngine(currentRoom, io, db);
    engine.broadcast('chat-message', {
      name: "System",
      message: `Vote to kick ${targetPlayer.name}: ${currentRoom.kickVotes[targetId].size}/${votesNeeded}`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    if (currentRoom.kickVotes[targetId].size >= votesNeeded) {
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.emit("kicked", "You have been vote-kicked from the game.");
        targetSocket.disconnect(true);
      }
      delete currentRoom.kickVotes[targetId];
    }
  }

  // ============= LEADERBOARD =============

  socket.on("request-leaderboard", () => {
    socket.emit("leaderboard-update", db.getLeaderboard(10));
  });

  // ============= DISCONNECT =============

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    if (currentRoom) {
      const room = currentRoom;
      if (room.gameState !== 'waiting' && room.gameState !== 'game_end') {
        const result = room.markPlayerDisconnected(socket.id, () => {
          if (room.isEmpty()) {
            console.log(`[DC-EXPIRE-CLEANUP] Room ${room.id} is empty, deleting`);
            roomManager.deleteRoom(room.id);
          } else {
            const engine = new GameEngine(room, io, db);
            engine.broadcast('room:player-left', { player: result?.playerData });
            engine.broadcastPlayers();
            
            const playerCount = room.getPlayerCount();
            if (playerCount < 1) {
              console.log(`[GAME-RESET] No active players left in room ${room.code}, resetting to waiting`);
              room.gameState = 'waiting';
              room.clearTimers();
              engine.broadcast('room:updated', room.toDetailedJSON());
            }
          }
        });
        
        if (result) {
          const engine = new GameEngine(room, io, db);
          engine.broadcast('room:player-disconnected', { 
            playerId: socket.id, 
            authId: result.playerData?.authId || '' 
          });
          if (result.newHost) {
            engine.broadcast('room:host-changed', { newHostId: result.newHost });
          }
          engine.broadcastPlayers();
          
          if (room.getPlayerCount() < 1) {
            console.log(`[GAME-RESET] No active players left in room ${room.code}, resetting to waiting`);
            room.gameState = 'waiting';
            room.clearTimers();
            engine.broadcast('room:updated', room.toDetailedJSON());
          }
        }
      } else {
        handleLeaveRoom();
      }
    }
  });

  // Helper: Leave room cleanup
  function handleLeaveRoom() {
    if (!currentRoom) return;

    const result = roomManager.leaveRoom(socket.id);
    if (!result) return;

    const { room, wasPlayer, newHost } = result;
    
    if (userProfile) {
      const engine = new GameEngine(room, io, db);
      engine.broadcast('chat-message', {
        name: 'System',
        message: `${userProfile.name} left the room.`,
        isSystem: true,
        dateTime: new Date().toISOString()
      });

      if (newHost) {
        engine.broadcast('room:host-changed', { newHostId: newHost });
      }

      engine.broadcastPlayers();

      // Handle game state changes
      if (wasPlayer && room.gameState !== 'waiting') {
        const playerCount = room.getPlayerCount();
        if (playerCount < 1) {
          engine.resetToWaiting("Not enough players remaining. Game reset.");
        } else if (socket.id === room.currentDrawer) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
          engine.broadcast('chat-message', {
            name: 'System',
            message: 'The drawer disconnected! Ending round.',
            isSystem: true,
            dateTime: new Date().toISOString()
          });
          engine.endRound();
        }
      }
    }

    currentRoom = null;
    console.log(`➖ Player left room ${room.code}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    roomManager.stopCleanupTask();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    roomManager.stopCleanupTask();
    process.exit(0);
  });
});
