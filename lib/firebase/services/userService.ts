import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { User } from '@/lib/types';

const COLLECTION_NAME = 'users';

export const userService = {
  // Get all users
  async getAll(): Promise<User[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('firstName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as User));
  },

  // Get user by ID
  async getById(id: string): Promise<User | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as User;
  },

  // Get users by team
  async getByTeam(teamId: string): Promise<User[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('teamId', '==', teamId),
      orderBy('firstName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as User));
  },

  // Get active users
  async getActive(): Promise<User[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true),
      orderBy('firstName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as User));
  },

  // Create user
  async create(user: Omit<User, 'id'>): Promise<string> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(docRef, user);
    return docRef.id;
  },

  // Update user
  async update(id: string, data: Partial<User>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  // Delete user
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // Subscribe to all users
  subscribeToAll(callback: (users: User[]) => void): Unsubscribe {
    const q = query(collection(db, COLLECTION_NAME), orderBy('firstName'));

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as User));
      callback(users);
    });
  },

  // Subscribe to team users
  subscribeToTeam(teamId: string, callback: (users: User[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('teamId', '==', teamId),
      orderBy('firstName')
    );

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as User));
      callback(users);
    });
  },
};