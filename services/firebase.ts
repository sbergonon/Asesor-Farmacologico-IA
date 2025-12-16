
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Helper function to safely get environment variables
// This prevents crashes if import.meta.env is undefined in certain environments
const getEnvVar = (key: string): string => {
  // Priority 1: import.meta.env (Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore access errors
  }

  // Priority 2: process.env (Node/Webpack/System)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore access errors
  }

  return '';
};

// Use placeholders to prevent initial crash if variables are missing
// This allows the app to load and show UI errors or work in Demo mode
const apiKey = getEnvVar('VITE_FIREBASE_API_KEY');

// Flag to check if configuration is valid (not empty and not the placeholder)
export const isFirebaseConfigured = !!apiKey && apiKey !== "AIzaSy_PLACEHOLDER_KEY";

const firebaseConfig = {
  // Fallback to a placeholder prevents "auth/invalid-api-key" crash at startup
  apiKey: apiKey || "AIzaSy_PLACEHOLDER_KEY",
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || "placeholder.firebaseapp.com",
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || "placeholder-project",
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID')
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export default app;
