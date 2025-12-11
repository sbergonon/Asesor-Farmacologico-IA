
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import type { UserRole, UserProfile, UserPermissions } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  permissions: UserPermissions;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string, institution: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Centralized Permission Logic
const getPermissions = (role: UserRole | null): UserPermissions => {
  const isPro = role === 'professional' || role === 'admin';
  const isAdmin = role === 'admin';

  return {
    canAccessDashboard: isPro,
    canAccessBatchAnalysis: isPro,
    canViewAdvancedHistory: isPro,
    canManageUsers: isAdmin,
    canExportData: isPro,
    canManagePatients: isPro, // Restricted to Pro/Admin
    canConfigureSystem: isAdmin, // Superuser only
    canAccessInvestigator: isPro, // Pro only
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Fetch or create user profile in Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            // User exists, get data
            setUserProfile(userDocSnap.data() as UserProfile);
          } else {
            // New user, create profile with default role 'personal'
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: 'personal', // Default role
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Fallback minimal profile if DB fails
          setUserProfile({
             uid: currentUser.uid,
             email: currentUser.email,
             displayName: currentUser.displayName,
             photoURL: currentUser.photoURL,
             role: 'personal',
             createdAt: new Date().toISOString()
          });
        }
      } else {
        // If not in demo mode (checked via a specific user ID logic or local state), reset
        if (user?.uid !== 'demo-user') {
            setUser(null);
            setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Error signing in with Email:", error);
        throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string, institution: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Update the user's display name immediately
        if (userCredential.user) {
            await updateProfile(userCredential.user, {
                displayName: name
            });
            // Force reload to get updated profile in auth state logic if needed, 
            // though the onAuthStateChanged triggers usually handle the subsequent DB creation.
            // We manually trigger profile creation here to ensure the name is saved to Firestore.
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            const newProfile: UserProfile = {
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              displayName: name,
              photoURL: null,
              role: 'personal',
              institution: institution,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
        }
    } catch (error) {
        console.error("Error registering with Email:", error);
        throw error;
    }
  };

  const resetPassword = async (email: string) => {
      try {
          await firebaseSendPasswordResetEmail(auth, email);
      } catch (error) {
          console.error("Error sending password reset email:", error);
          throw error;
      }
  };

  const loginAsDemo = async () => {
      setLoading(true);
      // Create a fake user object conforming to Firebase User interface (partially)
      const demoUser: Partial<User> = {
          uid: 'demo-user',
          displayName: 'Demo Admin',
          email: 'demo@example.com',
          photoURL: null,
          emailVerified: true,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          refreshToken: '',
          tenantId: null,
          delete: async () => {},
          getIdToken: async () => 'demo-token',
          getIdTokenResult: async () => ({} as any),
          reload: async () => {},
          toJSON: () => ({}),
          phoneNumber: null,
      };

      const demoProfile: UserProfile = {
          uid: 'demo-user',
          email: 'demo@example.com',
          displayName: 'Demo Admin',
          photoURL: null,
          role: 'admin', // Admin role for testing all features including settings
          institution: 'System Demo',
          createdAt: new Date().toISOString(),
      };

      setUser(demoUser as User);
      setUserProfile(demoProfile);
      setLoading(false);
  };

  const logout = async () => {
    try {
      if (user?.uid === 'demo-user') {
          setUser(null);
          setUserProfile(null);
      } else {
          await signOut(auth);
      }
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const userRole = userProfile?.role || null;
  
  // Memoize permissions to avoid unnecessary re-renders
  const permissions = useMemo(() => getPermissions(userRole), [userRole]);

  return (
    <AuthContext.Provider value={{ user, userProfile, userRole, permissions, loading, signInWithGoogle, loginAsDemo, loginWithEmail, registerWithEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
