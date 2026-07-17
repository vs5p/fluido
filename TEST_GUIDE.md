# Fast Draw - Testing Guide

## Project Status

✅ **Backend**: Running on port 4000
✅ **Frontend**: Running on port 8081
✅ **Room Management**: Fully implemented with RoomManager
✅ **macOS Design**: Complete with sidebar drawer navigation
✅ **Authentication**: Guest login with socket integration

## How to Run

### Terminal 1: Backend
```cmd
cd c:\Users\Pravesh\Desktop\socketChat\backend
npm start
```
Server runs on http://localhost:4000

### Terminal 2: Frontend
```cmd
cd c:\Users\Pravesh\Desktop\socketChat\frontend
npm run dev
```
Frontend runs on http://localhost:8081 (or next available port)

## Features Implemented

### 1. **macOS Styled Navigation Drawer** ✅
- Left sidebar with profile section showing:
  - User avatar with fallback initial
  - Name and guest/verified badge
  - Collapsible stats section (Total Points, Games Played, Correct Guesses, High Score)
- Two navigation tabs:
  - **Play** - Home screen with game creation/joining options
  - **Leaderboard** - Global leaderboard with rankings
- Top player preview in sidebar when on leaderboard tab
- Professional sign out button

### 2. **Home/Play Screen** ✅
- Clean centered layout with:
  - **Create Room** button - Opens modal to set up private games
  - **Join Room** button - Opens modal to join with code or browse public rooms
  - **How to Play** section - 4-step guide with emojis
  - **Game Features Grid** - 4 feature cards highlighting key gameplay aspects

### 3. **Room Management** ✅
- **Create Room Modal**:
  - Room name input
  - Player count selector (2-12)
  - Max rounds selector (1-5)
  - Round duration selector (30-120s)
  - Public/private toggle
  - Error handling

- **Join Room Modal**:
  - Two modes: "Enter Code" & "Browse Rooms"
  - Browse mode shows real-time list of public available rooms
  - Each room shows: name, code, host name, player count
  - Join button for each room
  - Refresh button to reload room list
  - Code entry mode with 6-char code input

### 4. **Leaderboard Screen** ✅
- Displays top players with:
  - Medal emojis for top 3 (🥇🥈🥉)
  - Player avatar/initial
  - Player name and stats preview
  - Total points displayed prominently
  - Stats: Games Played, Correct Guesses
- Summary stats grid:
  - Top Player
  - Total Games Played (aggregate)
  - Active Players count

### 5. **Backend Room Management** ✅
- RoomManager class with full CRUD operations
- Room creation with configurable settings
- Join/leave operations with spectator support
- Public room listing and filtering
- Quick-play matching algorithm
- Room state transitions
- Auto-cleanup of idle rooms after 30 minutes
- Proper error handling

### 6. **Socket Integration** ✅
- Guest authentication without Firebase
- Room lifecycle events (joined, left, updated)
- Player list broadcasts
- Game state management
- Chat and messaging system
- Drawing canvas synchronization
- Proper disconnect handling

## Test Scenarios

### Scenario 1: Create and Join Room
1. Start both servers
2. Open http://localhost:8081
3. Authenticate as guest (auto-happens)
4. Click "Create Room" button
5. Enter room name "Test Game"
6. Set 4 players, 2 rounds, 60s duration
7. Click "Create Room"
8. Should show game lobby with room code
9. Share code with friend
10. Friend clicks "Join Room" → "Enter Code"
11. Enters the 6-character room code
12. Successfully joins the room

### Scenario 2: Browse Public Rooms
1. Open frontend as two separate browser instances
2. Instance 1: Create a public room (toggle "Public room" ON)
3. Instance 2: Click "Join Room" → "Browse Rooms"
4. Should see Instance 1's room in the list
5. Click "Join" button
6. Should successfully join

### Scenario 3: Profile & Stats
1. Click on profile card in sidebar (top section)
2. Stats section should expand showing:
   - Games Played
   - Total Points
   - Correct Guesses
   - High Score
3. Click again to collapse

### Scenario 4: Leaderboard Navigation
1. Click "Leaderboard" tab in sidebar
2. Should see list of top players (initially empty after start)
3. Play some games to populate data
4. Verify scores are displayed correctly
5. Navigate back to "Play" tab
6. Click "Leaderboard" again - should load data

### Scenario 5: Room Settings Persistence
1. Create room with specific settings (e.g., 6 players, 45s rounds)
2. Check room shows these settings in the room details
3. Settings should match what you configured

## Known Features & Design Decisions

### Authentication
- Firebase integration is optional (mock auth available)
- Guest login is automatic and requires just a nickname
- Socket-based authentication separate from Firebase
- Persistent user sessions via Zustand store

### Room Architecture
- Each room is independent with own game loop
- RoomManager tracks all active rooms
- Public rooms automatically cleaned up if idle >30min
- Support for spectators if room has more players

### Styling
- macOS-inspired dark theme
- Blue accent colors for interactive elements
- Gradient backgrounds for visual depth
- Smooth animations with Framer Motion
- Responsive design with Tailwind CSS

## Error Handling

The application includes comprehensive error handling:
- Network connection failures
- Room creation errors
- Join failures (room full, not found, locked)
- User authentication errors
- Socket disconnection and reconnection

Error messages display in:
- Modal dialogs
- Toast notifications
- Inline form validation

## Next Steps (Future Features)

- [ ] Implement actual drawing gameplay in rooms
- [ ] Add chat message system
- [ ] Implement game round timer and word selection
- [ ] Add sound effects for correct guesses
- [ ] Implement scoring system
- [ ] Add email/social authentication
- [ ] Persistent stats in database
- [ ] Replay/history system
- [ ] Mobile app version
- [ ] Admin moderation tools

## Troubleshooting

### Backend won't start
- Check port 4000 is not in use: `netstat -ano | findstr :4000`
- Kill process: `taskkill /PID <PID> /F`
- Ensure Node.js is installed: `node --version`

### Frontend won't start
- Check npm dependencies: `npm install`
- Clear node_modules if needed: `rmdir node_modules /s /q && npm install`
- Try different port if 8081 is busy

### Sockets not connecting
- Verify backend is running on 4000
- Check browser console for connection errors
- Ensure CORS is properly configured in backend
- Try refreshing the page

### Room codes not working
- Make sure you're entering the correct code (case-insensitive)
- Verify room exists and isn't full
- Check if room is locked
- Try creating a new room if the old one expired

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/MainLayout.tsx          (NEW - macOS drawer nav)
│   │   ├── home/HomeScreen.tsx            (UPDATED - simplified)
│   │   ├── leaderboard/LeaderboardScreen.tsx  (NEW)
│   │   ├── room/
│   │   │   ├── CreateRoomModal.tsx        (UPDATED)
│   │   │   └── JoinRoomModal.tsx          (UPDATED)
│   │   └── ... other components
│   ├── routes/index.tsx                   (UPDATED - new layout)
│   ├── store/
│   │   ├── gameStore.ts                   (existing)
│   │   └── roomStore.ts                   (updated with setIsInRoom)
│   └── lib/socket.ts                      (existing)
│
backend/
├── app.js                                 (COMPLETELY REWRITTEN)
├── RoomManager.js                         (existing)
├── db.js
└── package.json
```

## Contact & Support

For issues or questions during testing, check:
1. Browser console for JavaScript errors
2. Network tab for API call failures
3. Backend console for server errors
4. Ensure both services are running

---
**Last Updated**: July 1, 2026
**Version**: 1.0
