
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, Auth, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, Firestore } from "firebase/firestore";
import { FirebaseConfig, AIConfig } from "../types";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export const firebaseService = {
  initialize: (config: FirebaseConfig) => {
    try {
      if (getApps().length === 0) {
        app = initializeApp(config);
      } else {
        app = getApps()[0];
      }
      auth = getAuth(app);
      db = getFirestore(app);
      return true;
    } catch (error) {
      console.error("Firebase Initialization Failed:", error);
      return false;
    }
  },

  isInitialized: () => !!app,

  login: async () => {
    if (!auth) throw new Error("Firebase not initialized");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  },

  logout: async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  },

  onAuthChange: (callback: (user: User | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Saves user preferences to Firestore.
   * Note: We deliberately exclude API keys (OpenRouter key, Firebase config) 
   * from cloud sync for security.
   */
  saveUserData: async (uid: string, data: {
    followedSubs: string[];
    blockedCount: number;
    blockedCommentCount: number;
    aiConfig: AIConfig;
  }) => {
    if (!db) return;
    
    // Filter sensitive keys from AI Config before syncing
    const safeAiConfig = {
      ...data.aiConfig,
      openRouterKey: undefined // Do not sync
    };

    try {
      await setDoc(doc(db, "users", uid), {
        followedSubs: data.followedSubs,
        stats: {
          blockedCount: data.blockedCount,
          blockedCommentCount: data.blockedCommentCount
        },
        preferences: safeAiConfig,
        lastUpdated: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error("Failed to save user data:", error);
    }
  },

  getUserData: async (uid: string) => {
    if (!db) return null;
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      return null;
    }
  }
};
