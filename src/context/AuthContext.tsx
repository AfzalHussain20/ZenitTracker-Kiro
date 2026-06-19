"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import type { UserProfile } from '@/types';
import type { PlanTier } from '@/types/organization';
import { getEntitlements, isInternalEmail, type Entitlements } from '@/lib/entitlements';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserProfile['role'] | null;
  displayName: string;
  // SaaS entitlements
  plan: PlanTier;
  isPremium: boolean;
  isInternal: boolean;
  orgId: string | null;
  entitlements: Entitlements;
}

const defaultEntitlements = getEntitlements(null, 'free');

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userRole: null,
  displayName: '',
  plan: 'free',
  isPremium: false,
  isInternal: false,
  orgId: null,
  entitlements: defaultEntitlements,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserProfile['role'] | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [storedPlan, setStoredPlan] = useState<PlanTier | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user) {
          // Refresh the session cookie so middleware doesn't expire it mid-session
          document.cookie = "firebase-auth-session=true; path=/; max-age=86400";
          setDisplayName(user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Tester');
          setLoading(false);
          // Fetch Firestore profile in background — doesn't block render
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              const userData = docSnap.data() as UserProfile & { plan?: PlanTier; orgId?: string };
              setUserRole(userData.role || 'tester');
              setStoredPlan(userData.plan ?? 'free');
              setOrgId(userData.orgId ?? null);
              const name = userData.displayName || user.displayName || user.email?.split('@')[0] || 'Tester';
              setDisplayName(name.split(' ')[0]);
            } else {
              setUserRole('tester');
              setStoredPlan('free');
              const name = user.displayName || user.email?.split('@')[0] || 'Tester';
              setDisplayName(name.split(' ')[0]);
            }
          } catch (e) {
            console.error("Auth User Fetch Error", e);
            setDisplayName(user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'Tester');
          }
        } else {
          setUserRole(null);
          setDisplayName('');
          setStoredPlan(null);
          setOrgId(null);
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const entitlements = getEntitlements(user?.email, storedPlan);

  const value: AuthContextType = {
    user,
    loading,
    userRole,
    displayName,
    plan: entitlements.plan,
    isPremium: entitlements.isPremium,
    isInternal: isInternalEmail(user?.email),
    orgId,
    entitlements,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
