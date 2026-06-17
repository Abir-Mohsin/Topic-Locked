import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  studentName: string | null;
  studentBatch: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentBatch, setStudentBatch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let docUnsubscribe: (() => void) | null = null;
    
    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (docUnsubscribe) {
        docUnsubscribe();
        docUnsubscribe = null;
      }
      setUser(user);
      if (user) {
        const docRef = doc(db, "users", user.uid);
        docUnsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setIsAdmin(data.role === "admin");
            setStudentName(data.name || user.displayName || "Unknown Student");
            setStudentBatch(data.batch || null);
          } else {
            // It might not exist immediately during registration, wait for it
            setIsAdmin(false);
            setStudentName(user.displayName || "Unknown Student");
            setStudentBatch(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user document:", error);
          setIsAdmin(false);
          setLoading(false);
        });
      } else {
        setIsAdmin(false);
        setStudentName(null);
        setStudentBatch(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (docUnsubscribe) {
        docUnsubscribe();
      }
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, studentName, studentBatch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
