require('dotenv').config();
const express = require("express");
const app = express();
const db = require("./db");
const { RoomManager } = require("./RoomManager");
const fs = require("fs");

// Log file
const logFile = fs.createWriteStream("./game-debug.log", { flags: "a" });
function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  logFile.write(line);
  process.stderr.write(line);
}

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
    log(`Fluido Server running on port ${PORT}`);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Expanded curated word list (250+ drawing-friendly items)
const RAW_WORDS = [
  "apple", "banana", "sun", "cloud", "car", "house", "tree", "dog", "cat", "fish",
  "star", "moon", "boat", "plane", "smile", "flower", "heart", "book", "cup", "hat",
  "guitar", "phone", "clock", "chair", "table", "key", "door", "window", "shoe", "socks",
  "pizza", "burger", "cookie", "cake", "ice cream", "spider", "snake", "bird", "rabbit", "lion",
  "rocket", "alien", "robot", "castle", "bridge", "mountain", "river", "beach", "drum",
  "train", "bicycle", "helicopter", "volcano", "pyramid", "wizard", "superman", "batman", "dinosaur", "monster",
  "hamburger", "pencil", "dolphin", "elephant", "giraffe", "monkey", "octopus", "penguin", "kangaroo", "butterfly",
  "anchor", "anvil", "backpack", "balloon", "battery", "bed", "bell", "blanket", "bottle", "broom",
  "bucket", "button", "cactus", "camera", "candle", "carriage", "chain", "chest",
  "compass", "crown", "diamond", "dice", "envelope", "feather", "flag",
  "flashlight", "fork", "ghost", "glasses", "glove", "hammer", "helmet", "horn", "ladder",
  "lamp", "lantern", "laptop", "lemon", "letter", "lightbulb", "lighthouse", "lock", "magnet", "map",
  "mirror", "mushroom", "needle", "nest", "newspaper", "notebook", "padlock", "paint", "paintbrush", "passport",
  "pillow", "ring", "scissors", "shield", "shovel", "skull", "soap",
  "spoon", "statue", "sword", "telescope", "tent", "ticket", "toothbrush", "torch", "treasure", "trophy",
  "umbrella", "violin", "wallet", "watch", "wheel", "windmill", "wrench",
  "avocado", "bacon", "bagel", "bread", "broccoli", "candy", "carrot", "cheese", "cherry", "chocolate",
  "coffee", "donut", "egg", "grapes", "hotdog", "lollipop", "milk", "onion", "pancake", "peach",
  "peanut", "pear", "pineapple", "popcorn", "potato", "pumpkin", "sandwich", "strawberry", "sushi", "taco", "tea", "watermelon",
  "cave", "comet", "desert", "earth", "fire", "forest", "galaxy", "island", "jungle", "lightning",
  "meteor", "ocean", "planet", "rain", "rainbow", "satellite", "sky", "snow", "snowflake", "space",
  "storm", "sunflower", "tornado", "waterfall", "wave",
  "ambulance", "astronaut", "automobile", "bus", "captain", "clown", "cowboy", "detective", "dragon", "driver",
  "firefighter", "ninja", "nurse", "pilot", "pirate", "police", "princess", "queen", "racer", "samurai",
  "ship", "submarine", "superhero", "tractor", "truck", "vampire", "witch", "zombie"
];

// Deduplicate words list
const WORDS = Array.from(new Set(RAW_WORDS));

/**
 * Industry-Standard Damerau-Levenshtein Distance Algorithm
 * Handles insertions, deletions, substitutions, and transpositions of adjacent characters.
 */
function damerauLevenshteinDistance(source, target) {
  if (!source) return target ? target.length : 0;
  if (!target) return source.length;

  const m = source.length;
  const n = target.length;
  const INF = m + n;

  const score = Array.from({ length: m + 2 }, () => new Array(n + 2).fill(0));
  score[0][0] = INF;

  for (let i = 0; i <= m; i++) {
    score[i + 1][0] = INF;
    score[i + 1][1] = i;
  }
  for (let j = 0; j <= n; j++) {
    score[0][j + 1] = INF;
    score[1][j + 1] = j;
  }

  const sd = {};
  const combined = source + target;
  for (let i = 0; i < combined.length; i++) {
    sd[combined[i]] = 0;
  }

  for (let i = 1; i <= m; i++) {
    let DB = 0;
    for (let j = 1; j <= n; j++) {
      const i1 = sd[target[j - 1]] || 0;
      const j1 = DB;

      let cost = 1;
      if (source[i - 1] === target[j - 1]) {
        cost = 0;
        DB = j;
      }

      score[i + 1][j + 1] = Math.min(
        score[i][j] + cost,
        score[i + 1][j] + 1,
        score[i][j + 1] + 1,
        score[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      );
    }
    sd[source[i - 1]] = i;
  }

  return score[m + 1][n + 1];
}

function normalizeWord(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Industry-Standard Guess Matching Evaluator
 * Returns { isCorrect: boolean, isClose: boolean }
 */
function checkGuessSimilarity(guessStr, targetWordStr) {
  const normGuess = normalizeWord(guessStr);
  const normTarget = normalizeWord(targetWordStr);

  if (!normGuess || !normTarget) return { isCorrect: false, isClose: false };

  // 1. Direct exact match
  if (normGuess === normTarget) {
    return { isCorrect: true, isClose: false };
  }

  // Strip spaces, hyphens, and underscores for variation matching (e.g. "icecream" vs "ice cream")
  const strippedGuess = normGuess.replace(/[\s\-_]/g, "");
  const strippedTarget = normTarget.replace(/[\s\-_]/g, "");

  if (strippedGuess.length > 0 && strippedGuess === strippedTarget) {
    return { isCorrect: true, isClose: false };
  }

  // 2. Minimum length check: Guess must be at least 3 chars long & at least 45% length of target
  if (strippedGuess.length < 3 || strippedGuess.length < Math.floor(strippedTarget.length * 0.45)) {
    return { isCorrect: false, isClose: false };
  }

  // 3. Damerau-Levenshtein distance calculation
  const distance = damerauLevenshteinDistance(strippedGuess, strippedTarget);
  const targetLen = strippedTarget.length;

  let isClose = false;
  if (targetLen <= 4) {
    // 3-4 letter words: distance must be 1
    isClose = distance === 1;
  } else if (targetLen <= 7) {
    // 5-7 letter words: distance must be 1
    isClose = distance === 1;
  } else {
    // 8+ letter words: distance 1 or 2, max 25% edit distance
    isClose = distance === 1 || (distance === 2 && (distance / targetLen) <= 0.25);
  }

  return { isCorrect: false, isClose };
}

// Initialize room manager
const roomManager = new RoomManager();

log("[SETUP] RoomManager initialized");

// Google Auth Verification Helper — decode JWT locally (no network call)
function verifyGoogleToken(token) {
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
    // Google GSI credential is a JWT: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    
    // Decode the payload (second part) from base64url
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    
    if (!payload.sub) throw new Error('Missing sub in JWT payload');
    
    log(`[AUTH] Google JWT decoded for: ${payload.name || payload.email} (sub: ${payload.sub})`);
    
    return {
      sub: payload.sub,
      email: payload.email || '',
      name: payload.name || payload.email?.split('@')[0] || 'Google User',
      picture: payload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${payload.sub}`
    };
  } catch (err) {
    log(`[AUTH] Google token decode failed: ${err.message}`);
    throw err;
  }
}

function handleSocketLeavePreviousRoom(socket, io, roomManager) {
  const previousRoomId = roomManager.playerToRoom.get(socket.id);
  if (previousRoomId) {
    log(`[LEAVE-PREVIOUS] Socket ${socket.id} leaving previous room ${previousRoomId}`);
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      const prevRoom = result.room;
      socket.leave(`room:${prevRoom.id}`);
      io.to(`room:${prevRoom.id}`).emit("room:player-left", { player: result.wasPlayer });
      if (result.newHost) {
        io.to(`room:${prevRoom.id}`).emit("room:host-changed", { newHostId: result.newHost });
      }
      io.to(`room:${prevRoom.id}`).emit("room:updated", prevRoom.toDetailedJSON());
    }
  }
}

log("[SETUP] Setting up socket.io connection handler");

io.on("connection", (socket) => {
  log(`[CONN] Socket connected: ${socket.id}`);

  // Send initial state
  socket.emit("leaderboard-update", db.getLeaderboard(10));
  socket.emit("server-stats", { 
    rooms: roomManager.getRoomCount(), 
    players: roomManager.getTotalPlayers() 
  });

  // Debug: Log all events
  socket.onAny((event, ...args) => {
    console.log(`[EVENT] ${socket.id} -> ${event}`, args.length > 0 ? `(${args.length} args)` : '');
  });

  // Helper to handle auto-rejoining active rooms if user was disconnected
  const handleAutoRejoin = (profile) => {
    if (!profile || !profile.id) return;
    const room = roomManager.findRoomByProfile(profile.id);
    if (!room) return;

    log(`[AUTO-REJOIN] Active or disconnected room ${room.code} found for user ${profile.name} (${profile.id})`);
    
    const result = roomManager.joinRoom(room.id, socket.id, profile);
    if (result.success) {
      socket.join(`room:${room.id}`);
      const roomData = room.toDetailedJSON();
      
      socket.emit("room:joined", { 
        room: roomData, 
        asHost: room.hostId === socket.id,
        asSpectator: result.asSpectator,
        reconnected: true
      });
      
      // Self-heal drawer state upon reload/reconnect
      if (room.gameState === 'word_selection' && room.currentDrawer === socket.id) {
        socket.emit("word-choices", room.wordChoices);
      } else if (room.gameState === 'drawing' && room.currentDrawer === socket.id) {
        socket.emit("drawer-word", room.currentWord);
      }

      // Send current drawing history to joining/reconnecting player
      if (room.gameState === 'drawing') {
        socket.emit("stroke:history", room.drawingHistory || []);
      }
      
      io.to(`room:${room.id}`).emit("room:player-joined", { 
        player: room.getPlayer(socket.id),
        reconnected: true 
      });
      io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
      broadcastStats();
    }
  };

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
        log(`[AUTH] Mock Firebase token decoded for: ${name} (uid: ${uid})`);

      } else {
        // Securely verify Firebase ID token via Admin SDK
        if (db.isFirebaseEnabled()) {
          const decodedToken = await db.verifyIdToken(token);
          uid = decodedToken.uid;
          email = decodedToken.email || '';
          name = decodedToken.name || decodedToken.displayName || email.split('@')[0] || 'User';
          picture = decodedToken.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
          log(`[AUTH] Secure Firebase token verified for: ${name} (uid: ${uid})`);
        } else {
          throw new Error('Firebase integration is disabled on this server.');
        }
      }

      const userProfile = await db.createUserOrUpdate(uid, {
        name,
        email,
        picture,
        isGuest: false
      });

      socket.userProfile = userProfile;
      socket.emit("auth-success", userProfile);
      broadcastStats();
      handleAutoRejoin(userProfile);
    } catch (err) {
      console.error('[AUTH] Firebase auth error:', err);
      socket.emit("auth-error", `Authentication failed: ${err.message}`);
    }
  });

  socket.on("auth-google", async (token) => {
    try {
      const googleProfile = verifyGoogleToken(token);
      const userProfile = await db.createUserOrUpdate(googleProfile.sub, {
        name: googleProfile.name,
        email: googleProfile.email,
        picture: googleProfile.picture,
        isGuest: false
      });
      socket.userProfile = userProfile;
      socket.emit("auth-success", userProfile);
      broadcastStats();
      handleAutoRejoin(userProfile);
    } catch (err) {
      console.error(err);
      socket.emit("auth-error", "Invalid Google credentials. Please try again.");
    }
  });

  socket.on("auth-guest", async (nickname) => {
    const cleanNick = nickname.trim().substring(0, 15) || 'Guest';
    const guestId = `guest-${Math.random().toString(36).substring(2, 11)}`;
    const userProfile = await db.createUserOrUpdate(guestId, {
      name: cleanNick,
      isGuest: true,
      picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanNick}`
    });
    socket.userProfile = userProfile;
    socket.emit("auth-success", userProfile);
    broadcastStats();
    handleAutoRejoin(userProfile);
  });

  socket.on("auth-resume", async (userId) => {
    const profile = await db.getUser(userId);
    if (profile) {
      socket.userProfile = profile;
      socket.emit("auth-success", profile);
      handleAutoRejoin(profile);
    } else {
      socket.emit("auth-expired");
    }
  });

  // ============= ROOM MANAGEMENT =============

  socket.on("room:create", (config, callback) => {
    try {
      handleSocketLeavePreviousRoom(socket, io, roomManager);
      const profile = socket.userProfile || {
        id: socket.id,
        name: config.hostName || 'Host',
        picture: config.hostPicture || '',
        isGuest: true
      };
      
      const room = roomManager.createRoom({
        ...config,
        hostId: socket.id,
        hostName: profile.name,
        creatorProfileId: profile.id
      });
      
      const result = roomManager.joinRoom(room.id, socket.id, profile);

      if (result.success) {
        socket.join(`room:${room.id}`);
        io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
        socket.emit("room:joined", { room: room.toDetailedJSON(), asHost: true });
        callback?.({ success: true, room: room.toDetailedJSON() });
        broadcastStats();
      } else {
        callback?.({ success: false, error: result.error });
      }
    } catch (err) {
      console.error('room:create error:', err);
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("room:join", (roomCode, userProfile, callback) => {
    try {
      handleSocketLeavePreviousRoom(socket, io, roomManager);
      const room = roomManager.getRoomByCode(roomCode);
      if (!room) {
        socket.emit("room:error", "Room not found");
        callback?.({ success: false, error: "Room not found" });
        return;
      }

      const result = roomManager.joinRoom(room.id, socket.id, userProfile);
      if (result.success) {
        socket.join(`room:${room.id}`);
        const roomData = room.toDetailedJSON();
        
        socket.emit("room:joined", { 
          room: roomData, 
          asHost: room.hostId === socket.id,
          asSpectator: result.asSpectator 
        });
        
        // Self-heal drawer state upon reload/reconnect
        if (room.gameState === 'word_selection' && room.currentDrawer === socket.id) {
          socket.emit("word-choices", room.wordChoices);
        } else if (room.gameState === 'drawing' && room.currentDrawer === socket.id) {
          socket.emit("drawer-word", room.currentWord);
        }

        // Send current drawing history to joining/reconnecting player
        if (room.gameState === 'drawing') {
          socket.emit("stroke:history", room.drawingHistory || []);
        }
        io.to(`room:${room.id}`).emit("room:player-joined", { player: room.getPlayer(socket.id) });
        io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
        callback?.({ success: true, room: roomData });
        broadcastStats();
        
        const playerCount = room.getPlayerCount();
        log(`[JOIN] Room ${room.code} join: ${playerCount}/${room.maxPlayers}, state=${room.gameState}`);
      } else {
        socket.emit("room:error", result.error);
        callback?.({ success: false, error: result.error });
      }
    } catch (err) {
      console.error('room:join error:', err);
      socket.emit("room:error", err.message);
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("room:list-public", (callback) => {
    const rooms = roomManager.getPublicRooms();
    socket.emit("room:public-list", rooms);
    callback?.(rooms);
  });

  socket.on("room:quick-play", (userProfile, callback) => {
    try {
      handleSocketLeavePreviousRoom(socket, io, roomManager);
      let room = roomManager.findBestPublicRoom();
      
      if (!room) {
        // Create a new public room
        room = roomManager.createRoom({
          name: `${userProfile.name}'s Room`,
          hostId: socket.id,
          hostName: userProfile.name,
          isPublic: true
        });
      }

      const result = roomManager.joinRoom(room.id, socket.id, userProfile);
      if (result.success) {
        socket.join(`room:${room.id}`);
        socket.emit("room:joined", { room: room.toDetailedJSON() });
        io.to(`room:${room.id}`).emit("room:player-joined", { player: room.getPlayer(socket.id) });
        io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
        callback?.({ success: true, room: room.toDetailedJSON() });
        broadcastStats();
      } else {
        callback?.({ success: false, error: result.error });
      }
    } catch (err) {
      console.error('room:quick-play error:', err);
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("room:leave", () => {
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      const room = result.room;
      socket.leave(`room:${room.id}`);
      io.to(`room:${room.id}`).emit("room:player-left", { player: result.wasPlayer });
      if (result.newHost) {
        io.to(`room:${room.id}`).emit("room:host-changed", { newHostId: result.newHost });
      }
      io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
    }
    broadcastStats();
  });

  socket.on("room:lock", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.hostId === socket.id) {
      room.isLocked = true;
      io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
    }
  });

  socket.on("room:unlock", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.hostId === socket.id) {
      room.isLocked = false;
      io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
    }
  });

  // ============= GAME ACTIONS =============

  socket.on("game:start", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    // Accept host by current socket ID or by profile ID (handles reconnect scenario)
    const profile = socket.userProfile;
    const isHostBySocket = room.hostId === socket.id;
    const isHostByProfile = profile && profile.id && room.creatorProfileId === profile.id;
    if (!isHostBySocket && !isHostByProfile) return;
    // If host reconnected, update hostId to current socket
    if (!isHostBySocket && isHostByProfile) {
      room.hostId = socket.id;
    }
    // Allow starting from waiting OR from game_end (play again)
    if (room.gameState === 'game_end') {
      room.resetGameState();
    }
    if (room.canStart()) {
      startGameRound(room);
    }
  });

  socket.on("game:skip-turn", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.hostId === socket.id && room.gameState !== 'waiting') {
      startNextRound(room);
    }
  });

  socket.on("game:reset", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    const profile = socket.userProfile;
    const isHostBySocket = room.hostId === socket.id;
    const isHostByProfile = profile && profile.id && room.creatorProfileId === profile.id;
    if (!isHostBySocket && !isHostByProfile) return;
    if (!isHostBySocket && isHostByProfile) room.hostId = socket.id;
    room.resetGameState();
    io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
  });

  socket.on("word:choose", (word) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.gameState === 'word_selection' && room.currentDrawer === socket.id) {
      if (room.wordChoices.includes(word)) {
        startDrawing(room, word);
      }
    }
  });



  socket.on("stroke:start", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    const canDraw = room.gameState === 'drawing' && room.currentDrawer === socket.id;
    if (canDraw) {
      room.drawingHistory.push({ ...data, type: 'start' });
      socket.to(`room:${room.id}`).emit("stroke:start", data);
    }
  });

  socket.on("stroke:move", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    const canDraw = room.gameState === 'drawing' && room.currentDrawer === socket.id;
    if (canDraw) {
      room.drawingHistory.push({ ...data, type: 'move' });
      socket.to(`room:${room.id}`).emit("stroke:move", data);
    }
  });

  socket.on("stroke:end", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    const canDraw = room.gameState === 'drawing' && room.currentDrawer === socket.id;
    if (canDraw) {
      room.drawingHistory.push({ ...data, type: 'end' });
      socket.to(`room:${room.id}`).emit("stroke:end", data);
    }
  });

  socket.on("canvas:clear", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    const canClear = room.gameState === 'drawing' && room.currentDrawer === socket.id;
    if (canClear) {
      room.drawingHistory = [];
      io.to(`room:${room.id}`).emit("canvas:clear");
    }
  });

  socket.on("canvas:undo", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;
    const canUndo = room.gameState === 'drawing' && room.currentDrawer === socket.id;
    if (canUndo && room.drawingHistory && room.drawingHistory.length > 0) {
      let lastStartIndex = -1;
      for (let i = room.drawingHistory.length - 1; i >= 0; i--) {
        if (room.drawingHistory[i].type === 'start') {
          lastStartIndex = i;
          break;
        }
      }
      if (lastStartIndex !== -1) {
        room.drawingHistory = room.drawingHistory.slice(0, lastStartIndex);
        io.to(`room:${room.id}`).emit("canvas:undo");
      }
    }
  });

  socket.on("message", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) return;

    const player = room.getPlayer(socket.id);
    if (!player) return;

    const messageText = (data.message || '').trim();
    if (!messageText) return;

    // In drawing phase, intercept guesses
    if (room.gameState === 'drawing') {
      if (socket.id === room.currentDrawer) {
        socket.emit("chat-message", {
          name: "System",
          message: "You are the Drawer! You cannot type in chat.",
          isSystem: true,
          dateTime: new Date().toISOString()
        });
        return;
      }

      if (player.hasGuessed) {
        socket.emit("chat-message", {
          name: "System",
          message: "You already guessed correctly! Keep silent for others.",
          isSystem: true,
          dateTime: new Date().toISOString()
        });
        return;
      }

      const matchResult = checkGuessSimilarity(messageText, room.currentWord);

      if (matchResult.isCorrect) {
        player.hasGuessed = true;
        const points = Math.max(30, Math.round(100 * (room.timer / room.roundDuration)));
        player.score += points;
        player.pointsGainedThisRound = points;
        player.correctGuessesInGameCount++;

        // Award points to the drawer in real-time based on how fast the guess was made
        const drawer = room.players[room.currentDrawer];
        let drawerPoints = 0;
        if (drawer) {
          drawerPoints = Math.max(10, Math.round(20 * (room.timer / room.roundDuration)));
          drawer.score += drawerPoints;
          drawer.pointsGainedThisRound = (drawer.pointsGainedThisRound || 0) + drawerPoints;
        }

        io.to(`room:${room.id}`).emit("correct-guess", {
          id: socket.id,
          name: player.name,
          points: points,
          drawerId: room.currentDrawer,
          drawerPoints: drawerPoints
        });

        io.to(`room:${room.id}`).emit("chat-message", {
          name: "System",
          message: `🎉 ${player.name} guessed the word! (+${points} pts) & ${drawer?.name || 'Drawer'} got +${drawerPoints} pts!`,
          isSystem: true,
          dateTime: new Date().toISOString()
        });

        socket.emit("play-correct-sound");

        // Broadcast room updated so scoreboard/checkmark updates immediately
        io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());

        const guessers = Object.values(room.players).filter(p => p.id !== room.currentDrawer);
        const correctCount = guessers.filter(p => p.hasGuessed).length;
        
        if (correctCount === guessers.length) {
          endRound(room);
        }
        return;
      }

      if (matchResult.isClose) {
        // 1. Broadcast the guess to the whole room so everyone sees it
        io.to(`room:${room.id}`).emit("chat-message", {
          name: player.name,
          message: messageText,
          dateTime: new Date().toISOString(),
          picture: player.picture,
          isSystem: false
        });
        // 2. Privately tell only the guesser they were close
        socket.emit("chat-message", {
          name: "System",
          message: `🔥 "${messageText}" is so close!`,
          isSystem: true,
          dateTime: new Date().toISOString()
        });
        return;
      }
    }

    // Normal message
    io.to(`room:${room.id}`).emit("chat-message", {
      name: player.name,
      message: messageText,
      dateTime: new Date().toISOString(),
      picture: player.picture,
      isSystem: false
    });
  });

  // ============= LEADERBOARD & STATS =============

  socket.on("request-leaderboard", () => {
    socket.emit("leaderboard-update", db.getLeaderboard(10));
  });

  // ============= DISCONNECT =============

  socket.on("disconnect", () => {
    log(`Socket disconnected: ${socket.id}`);
    const roomId = roomManager.playerToRoom.get(socket.id);
    if (roomId) {
      const room = roomManager.getRoom(roomId);
      if (room) {
        if (room.gameState !== 'waiting' && room.gameState !== 'game_end') {
          // Active game -> mark as disconnected with a grace period
          const result = room.markPlayerDisconnected(socket.id, () => {
            // Callback when grace period expires
            if (room.isEmpty()) {
              log(`[DC-EXPIRE-CLEANUP] Room ${room.id} is empty, deleting`);
              roomManager.deleteRoom(room.id);
            } else {
              io.to(`room:${room.id}`).emit("room:player-left", { player: result?.playerData });
              
              if (room.getPlayerCount() < 1) {
                log(`[GAME-RESET] No active players left in room ${room.code}, resetting to waiting`);
                room.gameState = 'waiting';
                room.clearTimers();
              }
              
              io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
            }
            broadcastStats();
          });
          
          roomManager.playerToRoom.delete(socket.id); // clean mapping
          
          if (result) {
            io.to(`room:${room.id}`).emit("room:player-disconnected", { 
              playerId: socket.id, 
              authId: result.playerData?.authId || '' 
            });
            if (result.newHost) {
              io.to(`room:${room.id}`).emit("room:host-changed", { newHostId: result.newHost });
            }
            
            if (room.getPlayerCount() < 1) {
              log(`[GAME-RESET] No active players left in room ${room.code}, resetting to waiting`);
              room.gameState = 'waiting';
              room.clearTimers();
            }
            
            io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
          }
        } else {
          // Lobby or game over -> remove permanently immediately
          const result = roomManager.leaveRoom(socket.id);
          if (result) {
            io.to(`room:${room.id}`).emit("room:player-left", { player: result.wasPlayer });
            if (result.newHost) {
              io.to(`room:${room.id}`).emit("room:host-changed", { newHostId: result.newHost });
            }
            io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
          }
        }
      } else {
        roomManager.playerToRoom.delete(socket.id);
      }
    }
    broadcastStats();
  });
});

// ============= GAME LOGIC =============

function startGameRound(room) {
  if (room.gameState !== 'waiting') {
    log(`[GAME] startGameRound called but room state=${room.gameState}, skipping`);
    return;
  }

  log(`[GAME] Starting game round for room ${room.code}, state: waiting -> starting`);
  
  room.gameState = 'starting';
  room.currentRound = 1;
  
  // Reset player scores
  Object.values(room.players).forEach(p => {
    p.score = 0;
    p.correctGuessesInGameCount = 0;
    p.drawingsInGameCount = 0;
  });

  io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
  log(`[GAME] Emitted room:updated, scheduling word selection in 2s`);
  
  setTimeout(() => {
    log(`[GAME] Starting word selection for room ${room.code}`);
    startWordSelection(room);
  }, 2000);
}

async function startWordSelection(room) {
  const playerIds = Object.keys(room.players);
  if (room.getPlayerCount() < 1) {
    room.gameState = 'waiting';
    io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
    return;
  }

  if (room.drawerIndex >= playerIds.length) {
    room.drawerIndex = 0;
    room.currentRound++;
    if (room.currentRound > room.maxRounds) {
      await endGame(room);
      return;
    }
  }

  room.gameState = 'word_selection';
  room.currentDrawer = playerIds[room.drawerIndex];
  const drawer = room.players[room.currentDrawer];
  
  if (drawer) {
    drawer.hasDrawnThisRound = true;
    drawer.drawingsInGameCount++;
    room.currentDrawerProfileId = drawer.authId;
  }

  // Ensure usedWords set exists on room instance
  if (!room.usedWords) {
    room.usedWords = new Set();
  }

  // Filter available words to avoid repeating used words in this match
  let availableWords = WORDS.filter(w => !room.usedWords.has(w.toLowerCase()));
  if (availableWords.length < 3) {
    room.usedWords.clear(); // Reset used words set if full dictionary used
    availableWords = [...WORDS];
  }

  const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
  room.wordChoices = shuffled.slice(0, 3);
  room.timer = room.wordSelectionDuration;

  io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
  io.to(room.currentDrawer).emit("word-choices", room.wordChoices);

  room.clearTimers();
  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(`room:${room.id}`).emit("timer-tick", room.timer);
    
    if (room.timer <= 0) {
      startDrawing(room, room.wordChoices[0]);
    }
  }, 1000);
}

function startDrawing(room, word) {
  room.gameState = 'drawing';
  room.currentWord = word.toLowerCase();
  
  if (!room.usedWords) room.usedWords = new Set();
  room.usedWords.add(room.currentWord);

  room.drawingHistory = [];
  room.timer = room.roundDuration;
  room.hintRevealed = 0;

  Object.values(room.players).forEach(p => {
    p.hasGuessed = false;
    p.pointsGainedThisRound = 0;
  });

  room.clearTimers();
  io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
  io.to(room.currentDrawer).emit("drawer-word", word);
  
  // Build initial masked word (letters -> '_', spaces stay)
  const wordChars = word.split('');
  const revealedArr = wordChars.map(c => /[a-zA-Z]/.test(c) ? '_' : c);
  const maskedWord = revealedArr.join('');
  room._revealedArr = revealedArr;
  io.to(`room:${room.id}`).emit("masked-word", maskedWord);

  io.to(`room:${room.id}`).emit("chat-message", {
    name: "System",
    message: `🎨 ${room.players[room.currentDrawer].name} is drawing! Start guessing!`,
    isSystem: true,
    dateTime: new Date().toISOString()
  });

  // Hint schedule: Hint 1 at 50% time remaining, Hint 2 at 25% time remaining
  const hint1Time = Math.floor(room.roundDuration * 0.50); // 50% time left
  const hint2Time = Math.floor(room.roundDuration * 0.25); // 25% time left
  let hintsFired = 0;

  function revealHintLetter() {
    const hiddenPositions = [];
    wordChars.forEach((c, i) => {
      if (/[a-zA-Z]/.test(c) && room._revealedArr[i] === '_') hiddenPositions.push(i);
    });
    if (hiddenPositions.length <= 1) return; // Keep at least 1 letter hidden
    const pick = hiddenPositions[Math.floor(Math.random() * hiddenPositions.length)];
    room._revealedArr[pick] = wordChars[pick];
    const hintMask = room._revealedArr.join('');
    io.to(`room:${room.id}`).emit("masked-word", hintMask);
    io.to(`room:${room.id}`).emit("chat-message", {
      name: "System",
      message: `💡 Hint: ${hintMask.replace(/_/g, '﹏')}`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });
  }

  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(`room:${room.id}`).emit("timer-tick", room.timer);

    // Reveal hints at exact thresholds
    if (hintsFired === 0 && room.timer <= hint1Time) {
      hintsFired = 1;
      revealHintLetter();
    } else if (hintsFired === 1 && room.timer <= hint2Time) {
      hintsFired = 2;
      revealHintLetter();
    }
    
    if (room.timer <= 0) {
      endRound(room);
    }
  }, 1000);
}

function endRound(room) {
  room.gameState = 'round_end';
  room.clearTimers();
  room.timer = 5;

  const guessers = Object.values(room.players).filter(p => p.id !== room.currentDrawer);
  const correctCount = guessers.filter(p => p.hasGuessed).length;
  
  const drawer = room.players[room.currentDrawer];
  let drawerPoints = 0;
  if (drawer) {
    drawerPoints = drawer.pointsGainedThisRound || 0;
  }

  io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
  io.to(`room:${room.id}`).emit("round-results", {
    word: room.currentWord,
    results: Object.values(room.players).map(p => ({
      id: p.id,
      name: p.name,
      pointsGained: p.pointsGainedThisRound,
      score: p.score
    }))
  });

  room.timerInterval = setInterval(() => {
    room.timer--;
    io.to(`room:${room.id}`).emit("timer-tick", room.timer);
    if (room.timer <= 0) {
      startNextRound(room);
    }
  }, 1000);
}

function startNextRound(room) {
  room.drawerIndex++;
  startWordSelection(room);
}

async function endGame(room) {
  room.gameState = 'game_end';
  room.clearTimers();
  room.timer = 0;

  // Save scores
  const updatePromises = Object.values(room.players).map(async (p) => {
    if (p.authId) {
      await db.updateUserStats(p.authId, {
        pointsGained: p.score,
        correctGuessIncrement: p.correctGuessesInGameCount,
        isDrawingIncrement: p.drawingsInGameCount
      });
    }
  });
  await Promise.all(updatePromises);

  const standings = Object.values(room.players).sort((a, b) => b.score - a.score);
  io.to(`room:${room.id}`).emit("room:updated", room.toDetailedJSON());
  io.to(`room:${room.id}`).emit("game-over", { standings });
  io.to(`room:${room.id}`).emit("leaderboard-update", db.getLeaderboard(10));
}

// ============= UTILITIES =============

function broadcastStats() {
  io.emit("server-stats", {
    rooms: roomManager.getRoomCount(),
    players: roomManager.getTotalPlayers()
  });
}
