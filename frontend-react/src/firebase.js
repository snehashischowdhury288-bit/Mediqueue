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

const getEnv = (key, fallback) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", getEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "YOUR_API_KEY")),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", getEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "mediqueue-be7b5.firebaseapp.com")),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", getEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "mediqueue-be7b5")),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "mediqueue-be7b5.appspot.com")),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", getEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "101893593720293612054")),
  appId: getEnv("VITE_FIREBASE_APP_ID", getEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "1:1018935937202:web:be7b5"))
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

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
