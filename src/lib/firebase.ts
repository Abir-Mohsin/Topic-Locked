import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0409758916",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:664747718798:web:b505758060180cc4f4f1df",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAy-Pgw9qDoR_a5mg6zF-vOIaF-I8HSh-w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0409758916.firebaseapp.com",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-c2d5961b-df3d-486b-bb56-4138062d8c40");
export const auth = getAuth(app);
