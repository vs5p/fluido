const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let dbInstance = null; // Firestore database instance or null
let authInstance = null; // Firebase Auth instance or null
let isFirebase = false;
let isFirestoreActive = false; // Firestore database active status

// Path to local JSON database fallback
const DB_PATH = path.join(__dirname, 'data', 'database.json');

// Leaderboard cache to keep getLeaderboard synchronous
let leaderboardCache = [];

// Helper to initialize local database file structures
function initializeLocalDbFiles() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {} }, null, 2), 'utf8');
  }
}

function initDb() {
  if (dbInstance || isFirebase) return;

  // Check if Firebase is explicitly disabled in environment
  if (process.env.USE_FIREBASE === 'false') {
    console.warn('⚠️ [DB] Firebase is explicitly disabled via USE_FIREBASE=false. Running in local JSON database mode.');
    initializeLocalDbFiles();
    updateLeaderboardCache();
    setInterval(updateLeaderboardCache, 30000);
    return;
  }

  // 1. Try to find a Firebase Service Account key
  let serviceAccount = null;
  const envKeyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const defaultKeyPath = path.join(__dirname, 'firebase-service-account.json');

  if (envKeyPath && fs.existsSync(envKeyPath)) {
    try {
      serviceAccount = JSON.parse(fs.readFileSync(envKeyPath, 'utf8'));
      console.log(`[DB] Loading Firebase service account from environment path: ${envKeyPath}`);
    } catch (e) {
      console.error(`[DB] Failed to parse service account from ${envKeyPath}:`, e.message);
    }
  } else if (fs.existsSync(defaultKeyPath)) {
    try {
      serviceAccount = JSON.parse(fs.readFileSync(defaultKeyPath, 'utf8'));
      console.log(`[DB] Loading Firebase service account from default path: ${defaultKeyPath}`);
    } catch (e) {
      console.error(`[DB] Failed to parse service account from ${defaultKeyPath}:`, e.message);
    }
  }

  // 2. Fallback to Env variables if no JSON file found
  if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      };
      console.log('[DB] Loading Firebase service account from environment variables');
    } catch (e) {
      console.error('[DB] Failed to load credentials from env vars:', e.message);
    }
  }

  // 3. Initialize Firebase Admin or Fall back to database.json
  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.cert(serviceAccount)
      });
      const { getFirestore } = require('firebase-admin/firestore');
      const { getAuth } = require('firebase-admin/auth');
      dbInstance = getFirestore();
      authInstance = getAuth();
      isFirebase = true;
      isFirestoreActive = true;
      console.log('✨ [DB] Firebase Firestore database initialized successfully!');
    } catch (err) {
      console.error('❌ [DB] Firebase initialization failed, falling back to local JSON:', err.message);
    }
  } else {
    console.warn('⚠️ [DB] No Firebase credentials found. Running in local JSON database mode.');
  }

  // Initialize local DB structures if running local mode or if Firestore is inactive
  if (!isFirebase || !isFirestoreActive) {
    initializeLocalDbFiles();
  }

  // Initial populate of leaderboard cache
  updateLeaderboardCache();

  // Periodically refresh the leaderboard cache (every 30 seconds)
  setInterval(updateLeaderboardCache, 30000);
}

// Load database from local file (local-mode only)
function loadLocalDb() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[DB] Error loading local database, returning empty structure:', err);
    return { users: {} };
  }
}

// Save database to local file (local-mode only)
function saveLocalDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error writing to local database:', err);
  }
}

// Periodically/asynchronously updates the in-memory leaderboard cache
async function updateLeaderboardCache() {
  if (isFirebase && isFirestoreActive) {
    try {
      const snapshot = await dbInstance.collection('users')
        .orderBy('stats.totalPoints', 'desc')
        .limit(10)
        .get();
      
      const newLeaderboard = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        newLeaderboard.push({
          id: data.id,
          name: data.name,
          picture: data.picture,
          isGuest: data.isGuest,
          totalPoints: data.stats?.totalPoints || 0,
          gamesPlayed: data.stats?.gamesPlayed || 0,
          highScore: data.stats?.highScore || 0
        });
      });
      leaderboardCache = newLeaderboard;
    } catch (err) {
      console.error('[DB] Failed to update leaderboard cache from Firestore:', err.message);
      const errMsg = err.message || '';
      if (errMsg.includes('API has not been used') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('NOT_FOUND')) {
        console.warn('⚠️ [DB] Firestore API is disabled or not set up. Falling back to local JSON database for storage, but Firebase Auth will remain active if initialized.');
        isFirestoreActive = false;
        initializeLocalDbFiles();
        await updateLeaderboardCache();
      }
    }
  } else {
    try {
      const db = loadLocalDb();
      leaderboardCache = Object.values(db.users)
        .sort((a, b) => (b.stats?.totalPoints || 0) - (a.stats?.totalPoints || 0))
        .slice(0, 10)
        .map(user => ({
          id: user.id,
          name: user.name,
          picture: user.picture,
          isGuest: user.isGuest,
          totalPoints: user.stats?.totalPoints || 0,
          gamesPlayed: user.stats?.gamesPlayed || 0,
          highScore: user.stats?.highScore || 0
        }));
    } catch (err) {
      console.error('[DB] Failed to update local leaderboard cache:', err.message);
    }
  }
}

/**
 * Get user by ID
 * @param {string} id - The user ID or Guest ID
 */
async function getUser(id) {
  initDb();
  if (isFirebase && isFirestoreActive) {
    try {
      const doc = await dbInstance.collection('users').doc(id).get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      console.error(`[DB] Error fetching user ${id} from Firestore:`, err.message);
      const errMsg = err.message || '';
      if (errMsg.includes('API has not been used') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('NOT_FOUND')) {
        console.warn('⚠️ [DB] Firestore API is disabled or not set up. Falling back to local JSON database for storage.');
        isFirestoreActive = false;
        initializeLocalDbFiles();
        return getUser(id); // Retry with local DB
      }
      return null;
    }
  } else {
    const db = loadLocalDb();
    return db.users[id] || null;
  }
}

/**
 * Create or update a user record
 * @param {string} id - Google ID, Firebase UID, or Guest ID
 * @param {object} profile - { name, email, picture, isGuest }
 */
async function createUserOrUpdate(id, profile) {
  initDb();
  if (isFirebase && isFirestoreActive) {
    try {
      const docRef = dbInstance.collection('users').doc(id);
      const doc = await docRef.get();
      
      let user;
      if (!doc.exists) {
        // New user initial template
        user = {
          id,
          name: profile.name,
          email: profile.email || '',
          picture: profile.picture || '',
          isGuest: !!profile.isGuest,
          stats: {
            totalPoints: 0,
            gamesPlayed: 0,
            correctGuesses: 0,
            drawingsMade: 0,
            highScore: 0
          },
          createdAt: new Date().toISOString()
        };
        await docRef.set(user);
        console.log(`[DB] Created new user profile in Firestore: ${profile.name} (${id})`);
      } else {
        // Update basic profile details
        user = doc.data();
        user.name = profile.name;
        if (profile.picture) user.picture = profile.picture;
        if (profile.email) user.email = profile.email;
        
        await docRef.update({
          name: user.name,
          picture: user.picture,
          email: user.email
        });
        console.log(`[DB] Updated user profile in Firestore: ${profile.name} (${id})`);
      }
      
      // Async update local leaderboard cache
      updateLeaderboardCache();
      return user;
    } catch (err) {
      console.error(`[DB] Error creating/updating user ${id} in Firestore:`, err.message);
      const errMsg = err.message || '';
      if (errMsg.includes('API has not been used') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('NOT_FOUND')) {
        console.warn('⚠️ [DB] Firestore API is disabled or not set up. Falling back to local JSON database for storage.');
        isFirestoreActive = false;
        initializeLocalDbFiles();
        return createUserOrUpdate(id, profile); // Retry with local DB
      }
      return null;
    }
  } else {
    const db = loadLocalDb();
    
    if (!db.users[id]) {
      // New user initial template
      db.users[id] = {
        id,
        name: profile.name,
        email: profile.email || '',
        picture: profile.picture || '',
        isGuest: !!profile.isGuest,
        stats: {
          totalPoints: 0,
          gamesPlayed: 0,
          correctGuesses: 0,
          drawingsMade: 0,
          highScore: 0
        },
        createdAt: new Date().toISOString()
      };
    } else {
      // Update basic profile details
      db.users[id].name = profile.name;
      if (profile.picture) db.users[id].picture = profile.picture;
      if (profile.email) db.users[id].email = profile.email;
    }
    
    saveLocalDb(db);
    updateLeaderboardCache();
    return db.users[id];
  }
}

/**
 * Record stats update for a user at the end of a game/round
 * @param {string} id - Google ID, Firebase UID, or Guest ID
 * @param {object} updates - { pointsGained, correctGuessIncrement, isDrawingIncrement, gameScore }
 */
async function updateUserStats(id, updates = {}) {
  initDb();
  const { pointsGained = 0, correctGuessIncrement = 0, isDrawingIncrement = 0, gameScore = 0 } = updates;

  if (isFirebase && isFirestoreActive) {
    try {
      const docRef = dbInstance.collection('users').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        console.warn(`[DB] Attempted to update stats for non-existent user ${id}`);
        return null;
      }
      
      const userData = doc.data();
      const stats = userData.stats || {
        totalPoints: 0,
        gamesPlayed: 0,
        correctGuesses: 0,
        drawingsMade: 0,
        highScore: 0
      };

      stats.totalPoints = (stats.totalPoints || 0) + pointsGained;
      stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
      stats.correctGuesses = (stats.correctGuesses || 0) + correctGuessIncrement;
      stats.drawingsMade = (stats.drawingsMade || 0) + isDrawingIncrement;

      if (gameScore > (stats.highScore || 0)) {
        stats.highScore = gameScore;
      }

      await docRef.update({ stats });
      userData.stats = stats;
      
      // Async update leaderboard cache
      updateLeaderboardCache();
      return userData;
    } catch (err) {
      console.error(`[DB] Error updating stats for user ${id} in Firestore:`, err.message);
      const errMsg = err.message || '';
      if (errMsg.includes('API has not been used') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('NOT_FOUND')) {
        console.warn('⚠️ [DB] Firestore API is disabled or not set up. Falling back to local JSON database for storage.');
        isFirestoreActive = false;
        initializeLocalDbFiles();
        return updateUserStats(id, updates); // Retry with local DB
      }
      return null;
    }
  } else {
    const db = loadLocalDb();
    const user = db.users[id];
    if (!user) return null;

    user.stats.totalPoints += pointsGained;
    user.stats.gamesPlayed += 1;
    user.stats.correctGuesses += correctGuessIncrement;
    user.stats.drawingsMade += isDrawingIncrement;

    if (gameScore > user.stats.highScore) {
      user.stats.highScore = gameScore;
    }

    saveLocalDb(db);
    updateLeaderboardCache();
    return user;
  }
}

/**
 * Retrieve sorted leaderboard
 * @param {number} limit - Max number of entries
 */
function getLeaderboard(limit = 10) {
  initDb();
  return leaderboardCache.slice(0, limit);
}

/**
 * Verify Firebase ID Token
 * @param {string} token
 */
async function verifyIdToken(token) {
  initDb();
  if (!isFirebase || !authInstance) {
    throw new Error('Firebase Auth is not initialized or enabled.');
  }
  return authInstance.verifyIdToken(token);
}

module.exports = {
  admin,
  isFirebaseEnabled: () => isFirebase,
  getUser,
  createUserOrUpdate,
  updateUserStats,
  getLeaderboard,
  verifyIdToken
};
