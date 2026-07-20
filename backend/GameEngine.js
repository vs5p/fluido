// Game Engine - Handles game logic, state transitions, and scoring
const { WORDS, getWordChoices } = require('./words');

class GameEngine {
  constructor(room, io, db) {
    this.room = room;
    this.io = io;
    this.db = db;
  }

  // Broadcast to all players and spectators in room
  broadcast(event, data) {
    const sockets = [...Object.keys(this.room.players), ...Object.keys(this.room.spectators)];
    sockets.forEach(socketId => {
      this.io.to(socketId).emit(event, data);
    });
  }

  // Broadcast game state update
  broadcastGameState() {
    this.broadcast('game-state-update', this.getGamePayload());
  }

  // Broadcast player list
  broadcastPlayers() {
    this.broadcast('players-update', Object.values(this.room.players));
  }

  // Get game state payload
  getGamePayload() {
    return {
      gameState: this.room.gameState,
      currentRound: this.room.currentRound,
      maxRounds: this.room.maxRounds,
      currentDrawer: this.room.currentDrawer,
      timer: this.room.timer,
      startCountdown: this.room.startCountdown,
      roomCode: this.room.code,
      roomName: this.room.name,
      isLocked: this.room.isLocked
    };
  }

  // Start game countdown (3-2-1)
  startGameCountdown() {
    if (this.room.gameState !== 'waiting' || !this.room.canStart()) {
      return false;
    }

    this.room.setState('starting');
    this.room.startCountdown = 3;
    this.broadcastGameState();

    this.broadcast('chat-message', {
      name: 'System',
      message: 'Game starting soon! Get ready!',
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    this.room.startCountdownInterval = setInterval(() => {
      this.room.startCountdown--;
      
      if (this.room.startCountdown > 0) {
        this.broadcast('countdown-tick', {
          count: this.room.startCountdown,
          type: 'game-start'
        });
        this.broadcastGameState();
      } else {
        clearInterval(this.room.startCountdownInterval);
        this.room.startCountdownInterval = null;
        this.startGame();
      }
    }, 1000);

    return true;
  }

  // Start the game
  startGame() {
    this.room.currentRound = 1;
    
    // Reset all player scores
    Object.values(this.room.players).forEach(player => {
      player.score = 0;
      player.correctGuessesInGameCount = 0;
      player.drawingsInGameCount = 0;
      player.hasDrawnThisRound = false;
    });

    this.broadcast('chat-message', {
      name: 'System',
      message: '🎨 The game has started! Good luck everyone!',
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    this.startNewRound();
  }

  // Start a new round
  startNewRound() {
    console.log(`Room ${this.room.id}: Round ${this.room.currentRound}/${this.room.maxRounds} starting`);
    
    // Mark all players as not having drawn this round
    Object.values(this.room.players).forEach(player => {
      player.hasDrawnThisRound = false;
    });

    // Set up drawer rotation
    this.room.drawersInRound = Object.keys(this.room.players);
    if (this.room.randomDrawerOrder) {
      this.room.drawersInRound.sort(() => Math.random() - 0.5);
    }
    this.room.drawerIndex = 0;

    this.startWordSelection();
  }

  // Start word selection phase
  async startWordSelection() {
    const playerIds = Object.keys(this.room.players);
    if (this.room.getPlayerCount() < 1) {
      this.resetToWaiting('Not enough players. Returning to lobby.');
      return;
    }

    // Check if round is complete
    if (this.room.drawerIndex >= this.room.drawersInRound.length) {
      this.room.currentRound++;
      if (this.room.currentRound > this.room.maxRounds) {
        await this.endGame();
      } else {
        this.startNewRound();
      }
      return;
    }

    // Get next drawer
    const nextDrawer = this.room.drawersInRound[this.room.drawerIndex];
    if (!nextDrawer || !this.room.players[nextDrawer]) {
      this.room.drawerIndex++;
      this.startWordSelection();
      return;
    }

    this.room.setState('word_selection');
    this.room.currentDrawer = nextDrawer;
    this.room.players[nextDrawer].hasDrawnThisRound = true;
    this.room.players[nextDrawer].drawingsInGameCount++;

    // Get 3 random words
    try {
      if (!this.room.usedWords) this.room.usedWords = new Set();
      this.room.wordChoices = getWordChoices(this.room.difficulty, 3, this.room.usedWords, this.room.customWords);
    } catch (err) {
      if (!this.room.usedWords) this.room.usedWords = new Set();
      this.room.wordChoices = getWordChoices(this.room.difficulty, 3, this.room.usedWords, this.room.customWords);
    }

    this.room.timer = this.room.wordSelectionDuration;
    this.broadcastGameState();

    // Send word choices to drawer only
    this.io.to(nextDrawer).emit('word-choices', this.room.wordChoices);

    const drawerName = this.room.players[nextDrawer].name;
    this.broadcast('chat-message', {
      name: 'System',
      message: `${drawerName} is choosing a word...`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    // Start selection timer
    this.room.clearTimers();
    this.room.timerInterval = setInterval(() => {
      this.room.timer--;
      this.broadcast('timer-tick', this.room.timer);
      
      if (this.room.timer <= 0) {
        clearInterval(this.room.timerInterval);
        this.room.timerInterval = null;
        // Auto-select first word
        this.startDrawing(this.room.wordChoices[0]);
      }
    }, 1000);
  }

  // Start drawing phase
  startDrawing(word) {
    if (this.room.gameState !== 'word_selection') {
      return;
    }

    this.room.setState('drawing');
    this.room.currentWord = word.toLowerCase().trim();
    this.room.drawingHistory = [];
    this.room.hintRevealed = 0;

    // Reset all player states
    Object.values(this.room.players).forEach(player => {
      player.hasGuessed = false;
      player.pointsGainedThisRound = 0;
    });

    this.room.timer = this.room.roundDuration;
    this.broadcastGameState();

    // Send full word to drawer
    this.io.to(this.room.currentDrawer).emit('drawer-word', this.room.currentWord);

    // Send masked word to others
    const wordChars = this.room.currentWord.split('');
    const revealedArr = wordChars.map(c => /[a-zA-Z]/.test(c) ? '_' : c);
    this.room._revealedArr = revealedArr;
    const maskedWord = revealedArr.join('');
    this.broadcast('masked-word', maskedWord);
    this.broadcast('canvas:clear');

    const drawerName = this.room.players[this.room.currentDrawer].name;
    this.broadcast('chat-message', {
      name: 'System',
      message: `🎨 ${drawerName} is drawing! Start guessing!`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    // Dynamic hint mechanics: Scale number of hints & timing based on word length
    const letterCount = wordChars.filter(c => /[a-zA-Z]/.test(c)).length;

    let maxHints = 1;
    if (letterCount <= 4) {
      maxHints = 1;
    } else if (letterCount <= 7) {
      maxHints = 2;
    } else if (letterCount <= 11) {
      maxHints = 3;
    } else {
      maxHints = 4;
    }

    const maxAllowed = Math.max(1, Math.floor(letterCount * 0.70));
    maxHints = Math.min(maxHints, maxAllowed);

    let hintThresholds = [];
    if (maxHints === 1) {
      hintThresholds = [0.45];
    } else if (maxHints === 2) {
      hintThresholds = [0.60, 0.30];
    } else if (maxHints === 3) {
      hintThresholds = [0.65, 0.40, 0.20];
    } else {
      hintThresholds = [0.70, 0.50, 0.30, 0.15];
    }

    const hintTimes = hintThresholds.map(pct => Math.floor(this.room.roundDuration * pct));
    let hintsFired = 0;

    this.room.clearTimers();
    this.room.timerInterval = setInterval(() => {
      this.room.timer--;
      this.broadcast('timer-tick', this.room.timer);

      // Reveal hints at dynamic thresholds if enabled
      if (this.room.enableHints) {
        if (hintsFired < maxHints && hintTimes[hintsFired] !== undefined && this.room.timer <= hintTimes[hintsFired]) {
          hintsFired++;
          this.revealHint();
        }
      }

      if (this.room.timer <= 0) {
        clearInterval(this.room.timerInterval);
        this.room.timerInterval = null;
        this.endRound();
      }
    }, 1000);
  }

  // Reveal a hint letter
  revealHint() {
    const wordChars = this.room.currentWord.split('');
    if (!this.room._revealedArr) {
      this.room._revealedArr = wordChars.map(c => /[a-zA-Z]/.test(c) ? '_' : c);
    }
    const hiddenPositions = [];
    wordChars.forEach((c, i) => {
      if (/[a-zA-Z]/.test(c) && this.room._revealedArr[i] === '_') {
        hiddenPositions.push(i);
      }
    });

    const letterCount = wordChars.filter(c => /[a-zA-Z]/.test(c)).length;
    const minHiddenRequired = Math.max(1, Math.floor(letterCount * 0.25));
    if (hiddenPositions.length <= minHiddenRequired) return;
    
    const pick = hiddenPositions[Math.floor(Math.random() * hiddenPositions.length)];
    this.room._revealedArr[pick] = wordChars[pick];
    const hintMask = this.room._revealedArr.join('');
    
    this.broadcast('masked-word', hintMask);
    this.broadcast('chat-message', {
      name: 'System',
      message: `💡 Hint: ${hintMask.replace(/_/g, '﹏')}`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });
  }

  // Process a guess
  processGuess(socketId, guess) {
    if (this.room.gameState !== 'drawing') {
      return { correct: false, error: 'Not in drawing phase' };
    }

    const player = this.room.players[socketId];
    if (!player) {
      return { correct: false, error: 'Not a player' };
    }

    if (socketId === this.room.currentDrawer) {
      return { correct: false, error: 'Drawer cannot guess' };
    }

    if (player.hasGuessed) {
      return { correct: false, error: 'Already guessed correctly' };
    }

    // Normalize guess and word
    const normGuess = guess.toLowerCase().trim();
    const normWord = this.room.currentWord.toLowerCase().trim();
    const strippedGuess = normGuess.replace(/[\s\-_]/g, '');
    const strippedWord = normWord.replace(/[\s\-_]/g, '');

    // Check if correct
    if (normGuess === normWord || (strippedGuess.length > 0 && strippedGuess === strippedWord)) {
      player.hasGuessed = true;

      // Award points based on time remaining
      const timePercent = this.room.timer / this.room.roundDuration;
      const points = Math.max(30, Math.round(100 * timePercent));
      player.pointsGainedThisRound = points;
      player.score += points;
      player.correctGuessesInGameCount++;

      this.broadcast('correct-guess', {
        id: socketId,
        name: player.name,
        points: points
      });

      this.broadcast('chat-message', {
        name: 'System',
        message: `🎉 ${player.name} guessed the word! (+${points} points)`,
        isSystem: true,
        dateTime: new Date().toISOString()
      });

      this.io.to(socketId).emit('play-sound', 'correct');

      // Check if all guessers have guessed
      const guessers = Object.values(this.room.players).filter(p => p.id !== this.room.currentDrawer);
      const correctCount = guessers.filter(p => p.hasGuessed).length;

      if (correctCount === guessers.length) {
        clearInterval(this.room.timerInterval);
        this.room.timerInterval = null;
        this.endRound();
      }

      this.broadcastPlayers();
      return { correct: true };
    }

    // Check for industry-standard close guess
    if (strippedGuess.length >= 3 && strippedGuess.length >= Math.floor(strippedWord.length * 0.45)) {
      const editDistance = this.getEditDistance(strippedGuess, strippedWord);
      const wordLen = strippedWord.length;
      let isClose = false;

      if (wordLen <= 7) {
        isClose = editDistance === 1;
      } else {
        isClose = editDistance === 1 || (editDistance === 2 && (editDistance / wordLen) <= 0.25);
      }

      if (isClose) {
        return { correct: false, close: true };
      }
    }

    return { correct: false };
  }

  // End the current round
  endRound() {
    if (this.room.gameState !== 'drawing') {
      return;
    }

    this.room.setState('round_end');

    // Calculate drawer bonus points
    const guessers = Object.values(this.room.players).filter(p => p.id !== this.room.currentDrawer);
    const correctCount = guessers.filter(p => p.hasGuessed).length;
    
    let drawerPointsGained = 0;
    if (correctCount > 0 && guessers.length > 0 && this.room.players[this.room.currentDrawer]) {
      drawerPointsGained = Math.min(50, correctCount * 15);
      this.room.players[this.room.currentDrawer].pointsGainedThisRound = drawerPointsGained;
      this.room.players[this.room.currentDrawer].score += drawerPointsGained;
    }

    this.room.timer = 10;
    this.broadcastGameState();

    const results = Object.values(this.room.players).map(p => ({
      id: p.id,
      name: p.name,
      picture: p.picture,
      pointsGained: p.pointsGainedThisRound,
      score: p.score,
      hasGuessed: p.hasGuessed
    })).sort((a, b) => b.score - a.score);

    this.broadcast('round-results', {
      word: this.room.currentWord,
      drawer: this.room.players[this.room.currentDrawer]?.name || 'Unknown',
      drawerPoints: drawerPointsGained,
      results: results
    });

    this.broadcast('chat-message', {
      name: 'System',
      message: `Round over! The word was "${this.room.currentWord}".`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    // Start timer for next round
    this.room.clearTimers();
    this.room.timerInterval = setInterval(() => {
      this.room.timer--;
      this.broadcast('timer-tick', this.room.timer);
      
      if (this.room.timer <= 0) {
        clearInterval(this.room.timerInterval);
        this.room.timerInterval = null;
        this.room.drawerIndex++;
        this.startWordSelection();
      }
    }, 1000);
  }

  // End the game
  async endGame() {
    this.room.setState('game_end');
    this.room.timer = 15;
    this.broadcastGameState();

    // Save scores to database
    const updatePromises = Object.values(this.room.players).map(async (player) => {
      if (player.authId && !player.isGuest) {
        await this.db.updateUserStats(player.authId, {
          pointsGained: player.score,
          correctGuessIncrement: player.correctGuessesInGameCount,
          isDrawingIncrement: player.drawingsInGameCount,
          gameScore: player.score
        });
      }
    });
    await Promise.all(updatePromises);

    const standings = Object.values(this.room.players)
      .map(p => ({
        id: p.id,
        authId: p.authId,
        name: p.name,
        picture: p.picture,
        score: p.score,
        correctGuesses: p.correctGuessesInGameCount,
        drawings: p.drawingsInGameCount
      }))
      .sort((a, b) => b.score - a.score);

    this.broadcast('game-over', { standings });

    // Update leaderboard
    this.broadcast('leaderboard-update', this.db.getLeaderboard(10));

    this.broadcast('chat-message', {
      name: 'System',
      message: `🏆 Game Over! Winner: ${standings[0]?.name || 'Nobody'} with ${standings[0]?.score || 0} points!`,
      isSystem: true,
      dateTime: new Date().toISOString()
    });

    // Auto-return to waiting after timer
    this.room.clearTimers();
    this.room.timerInterval = setInterval(() => {
      this.room.timer--;
      this.broadcast('timer-tick', this.room.timer);
      
      if (this.room.timer <= 0) {
        clearInterval(this.room.timerInterval);
        this.room.timerInterval = null;
        this.resetToWaiting('Returning to lobby...');
      }
    }, 1000);
  }

  // Reset to waiting state
  resetToWaiting(message) {
    if (message) {
      this.broadcast('chat-message', {
        name: 'System',
        message: message,
        isSystem: true,
        dateTime: new Date().toISOString()
      });
    }

    this.room.resetGameState();
    this.broadcastGameState();
    this.broadcastPlayers();
  }

  // Skip current turn (host control)
  skipTurn() {
    if (this.room.gameState === 'word_selection' || this.room.gameState === 'drawing') {
      clearInterval(this.room.timerInterval);
      this.room.timerInterval = null;
      
      this.broadcast('chat-message', {
        name: 'System',
        message: 'Turn skipped by host.',
        isSystem: true,
        dateTime: new Date().toISOString()
      });

      this.endRound();
      return true;
    }
    return false;
  }

  // Calculate edit distance (Levenshtein)
  getEditDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}

module.exports = GameEngine;
