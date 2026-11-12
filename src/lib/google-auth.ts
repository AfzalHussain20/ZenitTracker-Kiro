/**
 * Google sign-in / sign-up helper.
 *
 * Anyone can sign in with Google — there is no domain allow-list. Internal
 * @sunnetwork.in accounts still get the enterprise perk (see entitlements.ts),
 * but that is a benefit, not a gate. First-time external users are routed to
 * onboarding so they can create an organisation and pick a plan.
 */
import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { isInternalEmail } from '@/lib/entitlements';

export interface GoogleAuthResult {
  user: User;
  /** True when this is the first time we see this user (no profile document). */
  isNewUser: boolean;
  isInternal: boolean;
  /** Where the caller should send the user next. */
  nextPath: string;
}

/**
 * Opens the Google account picker, signs the user in, and makes sure a
 * `users/{uid}` profile exists. Safe to call for both login and signup.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  if (!auth || !db) {
    throw new Error('Authentication service unavailable. Check Firebase configuration.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const internal = isInternalEmail(user.email);
  const profileRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(profileRef);

  let isNewUser = false;
  let hasOrg = false;

  if (snapshot.exists()) {
    const data = snapshot.data() as { orgId?: string; plan?: string };
    hasOrg = Boolean(data.orgId);
  } else {
    isNewUser = true;
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email ?? '',
      displayName:
        user.displayName || (user.email ? user.email.split('@')[0] : 'Zenit user'),
      photoURL: user.photoURL ?? null,
      role: 'tester',
      plan: internal ? 'enterprise' : 'free',
      authProvider: 'google',
      createdAt: new Date(),
    });
  }

  return {
    user,
    isNewUser,
    isInternal: internal,
    // Internal users skip onboarding. External users who have no organisation
    // yet need to create one before they can use the dashboard.
    nextPath: internal || hasOrg ? '/dashboard' : '/onboarding',
  };
}
