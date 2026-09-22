// SIsta backend (Firebase).
//
// This module is the ONLY place that talks to Firebase. The rest of the app
// reaches it through the exported `Backend` object, mirroring the existing
// `Store` seam in main.js so callers keep `await`-ing the same shapes.
//
// The `firebaseConfig` below is PUBLIC ON PURPOSE. Firebase web config is not a
// secret — it identifies the project to the client, and all real security comes
// from Firestore/Storage security rules (see firestore.rules), not from hiding
// these values. (The Anthropic API key is different and stays server-side in the
// Cloudflare Worker — never put that here.)

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC8DI-uoHXR0KoOblHbGAJOAH7ne4zzre8',
  authDomain: 'sista-f8a17.firebaseapp.com',
  projectId: 'sista-f8a17',
  storageBucket: 'sista-f8a17.firebasestorage.app',
  messagingSenderId: '958178202053',
  appId: '1:958178202053:web:9747133b38b6bd560dbbac',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Turn a Firebase auth error into a friendly, user-facing string that matches
// the wording the old prototype used.
function mapAuthError(e) {
  const code = (e && e.code) || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with that email already exists — sign in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a moment and try again.';
    default:
      return (e && e.message) || 'Something went wrong. Please try again.';
  }
}

// Build the app-facing account object ({id, email, name, role}) from a Firebase
// user plus their profile doc (which holds name + role).
async function loadAccount(user) {
  let name = user.displayName || '';
  let role = 'student';
  try {
    const snap = await getDoc(doc(db, 'accounts', user.uid));
    if (snap.exists()) {
      const d = snap.data();
      if (d.name) name = d.name;
      if (d.role === 'leader' || d.role === 'student') role = d.role;
    }
  } catch (e) {
    /* offline / rules — fall back to auth profile */
  }
  return {
    id: user.uid,
    email: user.email || '',
    name: name || (user.email || '').split('@')[0] || 'User',
    role,
  };
}

export const Backend = {
  // Create an account. Returns { ok, account } | { ok:false, error }.
  async signUp(o) {
    const email = String(o.email || '').trim().toLowerCase();
    const name = String(o.name || '').trim();
    const role = o.role === 'leader' ? 'leader' : 'student';
    if (!email || email.indexOf('@') === -1) return { ok: false, error: 'Enter a valid email address.' };
    if (!o.password || String(o.password).length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
    if (!name) return { ok: false, error: 'Enter your name.' };
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, o.password);
      try { await updateProfile(cred.user, { displayName: name }); } catch (e) { /* non-fatal */ }
      try {
        await setDoc(
          doc(db, 'accounts', cred.user.uid),
          { name, role, email, createdAt: Date.now() },
          { merge: true }
        );
      } catch (e) { /* profile doc write may be blocked until rules deployed */ }
      return { ok: true, account: { id: cred.user.uid, email, name, role } };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  },

  // Sign in. Returns { ok, account } | { ok:false, error }.
  async signIn(o) {
    const email = String(o.email || '').trim().toLowerCase();
    try {
      const cred = await signInWithEmailAndPassword(auth, email, o.password);
      return { ok: true, account: await loadAccount(cred.user) };
    } catch (e) {
      return { ok: false, error: mapAuthError(e) };
    }
  },

  async signOut() {
    try { await fbSignOut(auth); } catch (e) { /* ignore */ }
  },

  // Subscribe to auth state. Calls cb(account|null) on every change AND once on
  // load with the restored session (Firebase persists login across reloads).
  // Returns an unsubscribe function.
  onAuthChanged(cb) {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { cb(null); return; }
      cb(await loadAccount(user));
    });
  },

  currentUid() {
    return auth.currentUser ? auth.currentUser.uid : null;
  },

  // Internals exposed for later stages (per-user data + shared classrooms).
  _db: db,
  _auth: auth,
};
