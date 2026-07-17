# Fast Draw - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Start the Production Backend
```bash
# Use the new production backend
node app-production.js
```

You should see:
```
✨ Fast Draw Server running on port 4000
```

### Step 3: Start the Frontend
```bash
cd ../frontend
npm install
npm run dev
```

## 🎮 Features Implemented

### ✅ Backend (100% Complete)
- **Multi-Room System**: Create unlimited public/private rooms
- **Quick Play**: Auto-matching to best available room
- **Room Codes**: 6-character codes for easy joining
- **Host Controls**: Kick, skip turn, lock/unlock, start/end game
- **Smooth Drawing**: Interpolated strokes, no more dotted lines
- **Smart Guessing**: Case-insensitive, ignores punctuation/spaces
- **Hint System**: Gradual letter reveals
- **Scoring**: Time-based with drawer bonuses
- **Spectators**: Watch games without playing
- **Countdowns**: For game start, rounds, word selection
- **Anti-Cheat**: Server-side validation
- **Reconnection**: 30-second grace period
- **Auto-Cleanup**: Idle rooms removed after 30 minutes

### ⏳ Frontend (30% Complete - Needs Work)
- ✅ Authentication (Google + Guest)
- ✅ Smooth canvas drawing
- ✅ Basic game flow
- ⏳ Home screen with navigation
- ⏳ Create/Join room modals
- ⏳ Waiting lobby
- ⏳ Countdown animations
- ⏳ Word selection UI
- ⏳ Round results
- ⏳ Game over screen
- ⏳ Dashboard with stats
- ⏳ Leaderboard page
- ⏳ Sounds & animations

## 🧪 Testing the Backend

### Test 1: Health Check
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "healthy",
  "rooms": 0,
  "players": 0,
  "uptime": 5.123
}
```

### Test 2: Public Rooms API
```bash
curl http://localhost:4000/api/rooms/public
```

### Test 3: Socket.io Connection
Open browser console at `http://localhost:5173` and test:
```javascript
// In browser console
const socket = io('http://localhost:4000');
socket.on('connect', () => console.log('Connected!', socket.id));
socket.emit('auth-guest', 'TestUser');
socket.on('auth-success', (profile) => console.log('Profile:', profile));
```

## 📝 Backend API Reference

### Socket Events (Client → Server)

#### Authentication
- `auth-google(token)` - Authenticate with Google OAuth token
- `auth-guest(nickname)` - Join as guest with nickname
- `auth-resume(userId)` - Resume previous session

#### Room Management
- `room:create(config)` - Create new room with configuration
- `room:join(roomCode)` - Join room by 6-char code
- `room:quick-play()` - Auto-join or create public room
- `room:leave()` - Leave current room
- `room:list-public()` - Get list of public rooms
- `room:lock()` - Lock room (host only)
- `room:unlock()` - Unlock room (host only)

#### Game Controls
- `game:start()` - Start game countdown (host only)
- `game:skip-turn()` - Skip current drawer's turn (host only)
- `game:end()` - End game early (host only)
- `game:kick-player(socketId)` - Remove player (host only)

#### Word Selection
- `word:choose(word)` - Choose word from 3 options (drawer only)

#### Drawing
- `stroke:start(data)` - Start new stroke
- `stroke:move(data)` - Continue stroke
- `stroke:end(data)` - End stroke
- `canvas:clear()` - Clear entire canvas

#### Chat & Guessing
- `message(data)` - Send chat message or guess
- `/votekick <name>` - Vote to kick player

#### Misc
- `request-leaderboard()` - Get global leaderboard

### Socket Events (Server → Client)

#### Authentication Responses
- `auth-success(profile)` - Authentication successful
- `auth-error(message)` - Authentication failed
- `auth-expired()` - Session expired

#### Room Events
- `room:joined(data)` - Successfully joined room
- `room:error(message)` - Room action failed
- `room:public-list(rooms[])` - List of public rooms
- `room:player-joined(player)` - Another player joined
- `room:player-left(player)` - Player left
- `room:host-changed(data)` - New host assigned
- `room:updated(data)` - Room settings changed

#### Game State
- `game-state-update(state)` - Game state changed
- `players-update(players[])` - Player list updated
- `countdown-tick(data)` - Countdown tick
- `timer-tick(seconds)` - Round timer tick

#### Word & Drawing
- `word-choices(words[])` - Word options (drawer only)
- `drawer-word(word)` - Full word (drawer only)
- `masked-word(masked)` - Masked word (guessers)
- `stroke:start(data)` - New stroke started
- `stroke:move(data)` - Stroke continued
- `stroke:end(data)` - Stroke ended
- `stroke:history(strokes[])` - Drawing history on join
- `canvas:clear()` - Canvas cleared

#### Guessing & Scoring
- `correct-guess(data)` - Player guessed correctly
- `round-results(data)` - Round ended with results
- `game-over(data)` - Game ended with final standings

#### Chat
- `chat-message(message)` - Chat message received

#### Misc
- `server-stats(data)` - Server statistics
- `leaderboard-update(data)` - Updated leaderboard
- `play-sound(soundName)` - Play sound effect
- `kicked(message)` - Kicked from room

## 🎨 Room Configuration Options

```javascript
{
  name: "My Awesome Room",           // Room display name
  isPublic: true,                    // Public (listed) or Private
  maxPlayers: 8,                     // 2-12 players
  maxRounds: 3,                      // 1-10 rounds
  roundDuration: 60,                 // 30, 45, 60, 90, or 120 seconds
  wordSelectionDuration: 15,         // Seconds to choose word
  difficulty: "medium",              // easy, medium, hard
  customWords: ["cat", "dog"],       // Array of custom words
  allowSpectators: true,             // Allow spectators
  enableHints: true,                 // Gradual hint reveals
  enableChat: true,                  // Enable chat
  randomDrawerOrder: true            // Randomize drawer order
}
```

## 🐛 Troubleshooting

### Backend won't start
- Check if port 4000 is available: `netstat -ano | findstr :4000`
- Try a different port: Set `PORT=4001` in `.env`

### "Cannot find module" errors
```bash
cd backend
npm install
```

### Socket connection fails
- Check backend is running
- Verify CORS is enabled (it is in `app-production.js`)
- Check firewall settings

### Drawing is still dotted
- Make sure you're using the new backend: `node app-production.js`
- Clear browser cache
- Check frontend is using new stroke events

## 📊 Backend Architecture

```
app-production.js
├── Room Manager
│   ├── Create/Delete Rooms
│   ├── Join/Leave Rooms
│   ├── Quick Play Matching
│   └── Public Room Listing
├── Game Engine (per room)
│   ├── State Machine
│   ├── Countdown System
│   ├── Word Selection
│   ├── Drawing Phase
│   ├── Guessing System
│   ├── Scoring System
│   └── Round/Game Management
└── Socket.io Handlers
    ├── Authentication
    ├── Room Events
    ├── Game Events
    ├── Drawing Events
    ├── Chat/Guessing
    └── Leaderboard
```

## 🔄 Migration from Old Backend

The old `app.js` used a single global game state. The new `app-production.js` uses:

- **Multiple rooms**: Each room has independent game state
- **Room Manager**: Centralized room lifecycle management
- **Game Engine**: Reusable game logic per room
- **Better events**: Separate stroke:start/move/end instead of generic "draw"
- **State machine**: Enforced valid state transitions
- **Host controls**: Full moderation capabilities

To switch:
```bash
# Backup old version
cp app.js app.js.old

# Use production version
node app-production.js

# Or rename and use as default
cp app-production.js app.js
npm start
```

## 📦 Dependencies

### Backend
- `express` (^5.2.1) - Web server
- `socket.io` (^4.8.3) - Real-time communication
- `dotenv` (^17.4.2) - Environment variables
- `cors` (^2.8.5) - CORS middleware

### Frontend
- `react` (^19.2.0) - UI framework
- `socket.io-client` (^4.8.3) - Socket client
- `zustand` (^5.0.13) - State management
- `framer-motion` (^12.38.0) - Animations
- `@tanstack/react-router` (^1.168.25) - Routing
- `firebase` (^12.13.0) - Authentication
- Plus UI components (Radix UI)

## 🎯 Next Steps

1. **Test the backend** with multiple browser tabs to simulate different players
2. **Create frontend room components** (see `IMPLEMENTATION_PROGRESS.md`)
3. **Update `socket.ts`** with new room events
4. **Create home screen** with navigation
5. **Add animations** with Framer Motion
6. **Implement sounds** for better UX
7. **Add responsive design** for mobile/tablet
8. **Deploy** to production server

## 💡 Tips

- Use `/votekick <name>` in chat to start kick vote
- Room codes are always 6 characters (e.g., "A3F2E1")
- Quick Play automatically creates a room if none exist
- Spectators can watch but not play
- Hints reveal one letter every 15 seconds (if enabled)
- Drawer earns points when others guess correctly
- Close guesses show "so close!" message

## 📞 Support

For issues or questions:
- Check `IMPLEMENTATION_PROGRESS.md` for detailed status
- Check `PRODUCTION_IMPLEMENTATION_PLAN.md` for full architecture
- Review console logs in browser DevTools
- Check backend terminal for error messages

## 🎉 Have Fun!

The backend is production-ready. Once the frontend is complete, you'll have a fully functional multiplayer drawing game!
