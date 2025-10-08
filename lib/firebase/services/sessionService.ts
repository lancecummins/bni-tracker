import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Session, SessionStatus } from '@/lib/types';

const COLLECTION_NAME = 'sessions';

export const sessionService = {
  // Get all sessions
  async getAll(): Promise<Session[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Session));
  },

  // Get session by ID
  async getById(id: string): Promise<Session | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Session;
  },

  // Get sessions by season
  async getBySeason(seasonId: string): Promise<Session[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('seasonId', '==', seasonId),
      orderBy('weekNumber')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Session));
  },

  // Get current active session
  async getActive(): Promise<Session | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'open')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as Session;
  },

  // Create session
  async create(session: Omit<Session, 'id'>): Promise<string> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(docRef, {
      ...session,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  // Open session (change status to 'open')
  async open(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      status: 'open' as SessionStatus,
    });
  },

  // Close session
  async close(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      status: 'closed' as SessionStatus,
      closedAt: Timestamp.now(),
    });
  },

  // Archive session
  async archive(id: string, archived: boolean = true): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isArchived: archived,
    });
  },

  // Update session
  async update(id: string, data: Partial<Session>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  // Subscribe to active session
  subscribeToActive(callback: (session: Session | null) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'open')
    );

    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        callback({
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        } as Session);
      }
    });
  },

  // Subscribe to season sessions
  subscribeToSeason(seasonId: string, callback: (sessions: Session[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('seasonId', '==', seasonId),
      orderBy('weekNumber')
    );

    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Session));
      callback(sessions);
    });
  },

  // Subscribe to all sessions
  subscribeToAll(callback: (sessions: Session[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Session));
      callback(sessions);
    });
  },
};