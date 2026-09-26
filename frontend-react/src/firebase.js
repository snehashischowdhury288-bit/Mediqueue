import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  serverTimestamp,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction
} from "firebase/firestore";

/**
 * Helper to safely extract environment variable with verified fallback
 */
const getEnv = (key, fallback) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    const val = import.meta.env[key];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    const val = process.env[key];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  }
  return fallback;
};

// Verified Authentic Firebase Configuration for mediqueue-be7b5
export const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "AIzaSyDhsyeP8UsaaqDwc0hBrQhI5fgZUU7a8IM")),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "mediqueue-be7b5.firebaseapp.com")),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "mediqueue-be7b5")),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "mediqueue-be7b5.firebasestorage.app")),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "412236635274")),
  appId: getEnv("VITE_FIREBASE_APP_ID", getEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "1:412236635274:web:16ca21f0d83ade16fda173"))
};

// Guard against duplicate instance initialization crashes
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication with Google Auth Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore database instance
export const db = getFirestore(app);

/**
 * Universal Firebase Auth Error Translator
 * Maps raw Firebase error codes to user-friendly messages while logging the exact code.
 */
export function getFriendlyAuthErrorMessage(err) {
  if (!err) return "An unexpected error occurred. Please try again.";
  const code = err.code || (err.message && err.message.match(/\((auth\/[^)]+)\)/)?.[1]) || "";
  console.error(`[Firebase Auth Error Code: ${code || 'UNKNOWN'}]:`, err.message || err);

  switch (code) {
    case 'auth/email-already-in-use':
      return "This email address is already registered. Please sign in instead.";
    case 'auth/invalid-email':
      return "Please enter a valid email address.";
    case 'auth/user-not-found':
      return "No account exists with this email address. Please register first.";
    case 'auth/wrong-password':
      return "Incorrect password. Please verify your credentials.";
    case 'auth/invalid-credential':
      return "Invalid email or password. Please verify your credentials and try again.";
    case 'auth/weak-password':
      return "Password is too weak. Please choose a password with at least 6 characters.";
    case 'auth/popup-closed-by-user':
      return "Google sign-in popup was closed before completing.";
    case 'auth/popup-blocked':
      return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
    case 'auth/cancelled-popup-request':
      return "Google sign-in request was cancelled. Please try again.";
    case 'auth/network-request-failed':
      return "Network error. Please check your internet connection and try again.";
    case 'auth/too-many-requests':
      return "Access temporarily blocked due to multiple failed login attempts. Please try again later.";
    case 'auth/user-disabled':
      return "This user account has been disabled by the administrator.";
    case 'auth/operation-not-allowed':
      return "This authentication provider is not enabled in Firebase.";
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return "Firebase API key error. Please verify the project credentials.";
    case 'auth/requires-recent-login':
      return "Please sign in again to complete this sensitive operation.";
    default:
      if (err.message) {
        // Strip technical 'Firebase: ' prefix if present
        return err.message.replace(/^Firebase:\s*/, '').replace(/\(auth\/[^)]+\)\.?/, '').trim() || "Authentication failed. Please try again.";
      }
      return "Authentication failed. Please verify your details and try again.";
  }
}

export {
  serverTimestamp,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  onAuthStateChanged
};

export default app;
