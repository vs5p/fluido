// Firebase initialization. Reads from VITE_* env vars at build time.
// Falls back to a local mock so the preview works without keys configured.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  browserLocalPersistence,
  setPersistence,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

let app: FirebaseApp | null = null;
if (firebaseConfigured && typeof window !== "undefined") {
  app = getApps()[0] ?? initializeApp(firebaseConfig);
}

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

const isMobile =
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export async function signInGoogle() {
  if (!auth) return mockSignIn({ provider: "google" });
  return isMobile
    ? signInWithRedirect(auth, googleProvider)
    : signInWithPopup(auth, googleProvider);
}

export async function signInEmail(email: string, password: string) {
  if (!auth) return mockSignIn({ email });
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpEmail(email: string, password: string, nickname?: string) {
  if (!auth) return mockSignIn({ email });
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (nickname && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: nickname });
  }
  return userCredential;
}

export async function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem('orbitdraw-user-id');
    localStorage.removeItem('orbitdraw-auth-provider');
  }
  if (!auth) {
    mockUser = null;
    mockListeners.forEach((cb) => cb(null));
    return;
  }
  return fbSignOut(auth);
}

export function onAuth(cb: (user: User | MockUser | null) => void) {
  if (!auth) {
    mockListeners.add(cb);
    cb(mockUser);
    return () => mockListeners.delete(cb);
  }
  return onAuthStateChanged(auth, cb);
}

// ----------------- Mock auth (when Firebase not configured) -----------------

export type MockUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
};

let mockUser: MockUser | null = null;
const mockListeners = new Set<(u: MockUser | null) => void>();

function mockSignIn(opts: { provider?: "google"; email?: string }) {
  const seed = opts.email ?? "guest-" + Math.random().toString(36).slice(2, 7);
  const isGoogle = opts.provider === "google";
  mockUser = {
    uid: (isGoogle ? "mock-google-" : "mock-") + seed,
    displayName: opts.email?.split("@")[0] ?? (isGoogle ? "Google Guest " : "Guest ") + seed.slice(-4),
    email: opts.email ?? null,
    photoURL: isGoogle ? `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}` : null,
  };
  mockListeners.forEach((cb) => cb(mockUser));
  return mockUser;
}
