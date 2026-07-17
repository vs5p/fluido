// Test script to verify game mechanics
// Run: node test-game.js

const { io: ioClient } = require("socket.io-client");

const SOCKET_URL = "http://localhost:4000";
let player1, player2;
let room1, room2;

async function connect(name) {
  return new Promise((resolve) => {
    const socket = ioClient(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    const timeout = setTimeout(() => {
      console.error(`❌ [${name}] Connection timeout!`);
      process.exit(1);
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      console.log(`✅ [${name}] Socket connected (${socket.id})`);
      
      // Auto-authenticate as guest
      socket.emit("auth-guest", name);
      
      socket.on("auth-success", (profile) => {
        console.log(`✅ [${name}] Authenticated as ${profile.name}`);
        resolve({ socket, profile });
      });

      socket.on("auth-error", (error) => {
        console.error(`❌ [${name}] Auth failed: ${error}`);
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ [${name}] Disconnected`);
    });

    socket.on("error", (err) => {
      console.error(`❌ [${name}] Socket error:`, err);
    });

    socket.on("connect_error", (err) => {
      console.error(`❌ [${name}] Connection error:`, err);
    });
  });
}

async function setupListeners(socket, name) {
  socket.on("room:joined", (data) => {
    console.log(`📍 [${name}] Joined room ${data.room.code}, gameState=${data.room.gameState}`);
  });

  socket.on("room:updated", (data) => {
    console.log(`📊 [${name}] Room updated - gameState: ${data.gameState}, players: ${data.playerCount}/${data.maxPlayers}`);
  });

  socket.on("room:player-joined", (data) => {
    console.log(`👤 [${name}] ${data.player.name} joined`);
  });

  socket.on("word-choices", (words) => {
    console.log(`🎨 [${name}] Word choices: ${words.join(", ")}`);
  });

  socket.on("drawer-word", (word) => {
    console.log(`✏️  [${name}] You are drawing: ${word}`);
  });

  socket.on("masked-word", (masked) => {
    console.log(`🔍 [${name}] Masked word: ${masked}`);
  });

  socket.on("timer-tick", (time) => {
    if (time % 5 === 0 || time <= 3) {
      console.log(`⏱️  [${name}] Timer: ${time}s`);
    }
  });

  socket.on("game-state-update", (state) => {
    console.log(`🎮 [${name}] Game state: ${JSON.stringify(state)}`);
  });

  socket.on("room:error", (error) => {
    console.error(`❌ [${name}] Room error: ${error}`);
  });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log("\n🎮 ===== FAST DRAW GAME TEST =====\n");

  try {
    // Step 1: Connect two players
    console.log("📡 Connecting players...");
    const result1 = await connect("Alice");
    player1 = result1.socket;
    const profile1 = result1.profile;

    const result2 = await connect("Bob");
    player2 = result2.socket;
    const profile2 = result2.profile;

    await setupListeners(player1, "Alice");
    await setupListeners(player2, "Bob");

    console.log("\n📝 Creating room...");
    // Step 2: Player 1 creates a room
    room1 = await new Promise((resolve) => {
      player1.emit("room:create", {
        name: "Test Game",
        hostName: profile1.name,
        hostPicture: profile1.picture,
        maxPlayers: 4,
        maxRounds: 1,
        roundDuration: 60,
        wordSelectionDuration: 15,
        isPublic: true
      }, (response) => {
        console.log(`✅ Room created: ${response.room.code}`);
        resolve(response.room);
      });
    });

    await delay(1000);

    console.log("\n🚪 Player 2 joining room...");
    // Step 3: Player 2 joins the room
    room2 = await new Promise((resolve) => {
      player2.emit("room:join", room1.code, profile2, (response) => {
        if (response.success) {
          console.log(`✅ Player 2 joined successfully`);
          resolve(response.room);
        } else {
          console.error(`❌ Failed to join:`, response.error);
        }
      });
    });

    await delay(3000);

    console.log("\n✏️  Waiting for word selection (listening for 5 seconds)...");
    await delay(5000);

    console.log("\n🎨 Sending word choice: 'apple'...");
    // Player 1 (drawer) chooses a word
    player1.emit("word:choose", "apple");

    await delay(3000);

    console.log("\n💬 Sending guess: 'apple'...");
    // Player 2 (guesser) sends a guess
    player2.emit("message", { message: "apple" });

    await delay(5000);

    console.log("\n✅ Test completed!");
    console.log("\n📊 EXPECTED STATE TRANSITIONS:");
    console.log("1. Both join → gameState should become 'starting'");
    console.log("2. 2s later → gameState should become 'word_selection'");
    console.log("3. Drawer receives word-choices");
    console.log("4. 15s timeout or word chosen → gameState becomes 'drawing'");
    console.log("5. Players receive drawer-word and masked-word");
    console.log("6. Guesser can send chat messages");
    console.log("7. Correct guess should update room state");

    await delay(2000);
    process.exit(0);

  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

// Run test
test();
