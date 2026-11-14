import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { BookmarkItem, HazardCategory } from '../types/sar';

const app = initializeApp(firebaseConfig);
export const db = getFirestoreWithConfig();
export const auth = getAuth(app);

import { getFirestore } from 'firebase/firestore';

function getFirestoreWithConfig() {
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export async function ensureUserProfile(user: User) {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = (user.displayName || user.email?.split('@')[0] || 'SAR Researcher').slice(0, 120);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: user.uid,
        displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserBookmarks(
  userId: string,
  onData: (items: BookmarkItem[]) => void,
  onError: (message: string) => void
) {
  const path = `users/${userId}/bookmarks`;
  const q = query(
    collection(db, 'users', userId, 'bookmarks'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: BookmarkItem[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          const createdTs = data.createdAt as Timestamp | undefined;
          const updatedTs = data.updatedAt as Timestamp | undefined;
          const sortMs = updatedTs?.toMillis
            ? updatedTs.toMillis()
            : createdTs?.toMillis
              ? createdTs.toMillis()
              : 0;
          return {
            sortMs,
            item: {
              id: d.id,
              siteId: String(data.siteId ?? ''),
              title: String(data.title ?? ''),
              region: String(data.region ?? ''),
              lat: Number(data.lat ?? 0),
              lng: Number(data.lng ?? 0),
              hazardCategory: (data.hazardCategory as HazardCategory) ?? 'flood',
              note: String(data.note ?? ''),
              createdAt: createdTs?.toDate
                ? createdTs.toDate().toISOString()
                : new Date().toISOString(),
            } satisfies BookmarkItem,
          };
        })
        .sort((a, b) => b.sortMs - a.sortMs)
        .map((entry) => entry.item);
      onData(items);
    },
    (error) => {
      onError(error.message);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'aoi_site';
}

export async function saveUserBookmark(
  user: User,
  payload: {
    siteId: string;
    title: string;
    region: string;
    lat: number;
    lng: number;
    hazardCategory: HazardCategory;
    note: string;
  }
) {
  await ensureUserProfile(user);
  const safeSiteId = sanitizeId(payload.siteId);
  const path = `users/${user.uid}/bookmarks/${safeSiteId}`;
  const ref = doc(db, 'users', user.uid, 'bookmarks', safeSiteId);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        title: payload.title.trim().slice(0, 160),
        note: payload.note.trim().slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: user.uid,
        siteId: safeSiteId,
        title: payload.title.trim().slice(0, 160),
        region: payload.region.trim().slice(0, 120),
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        hazardCategory: payload.hazardCategory,
        note: payload.note.trim().slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserBookmark(userId: string, bookmarkId: string) {
  const safeId = sanitizeId(bookmarkId);
  const path = `users/${userId}/bookmarks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'bookmarks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
