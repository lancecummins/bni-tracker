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
import { Team } from '@/lib/types';

const COLLECTION_NAME = 'teams';

export const teamService = {
  // Get all teams
  async getAll(): Promise<Team[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Team));
  },

  // Get team by ID
  async getById(id: string): Promise<Team | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Team;
  },

  // Get teams by season
  async getBySeason(seasonId: string): Promise<Team[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('seasonId', '==', seasonId),
      orderBy('totalPoints', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Team));
  },

  // Create team
  async create(team: Omit<Team, 'id'>): Promise<string> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    await setDoc(docRef, team);
    return docRef.id;
  },

  // Update team
  async update(id: string, data: Partial<Team>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  // Add member to team
  async addMember(teamId: string, userId: string): Promise<void> {
    const team = await this.getById(teamId);
    if (!team) throw new Error('Team not found');

    const updatedMembers = [...team.memberIds, userId];
    await this.update(teamId, { memberIds: updatedMembers });
  },

  // Remove member from team
  async removeMember(teamId: string, userId: string): Promise<void> {
    const team = await this.getById(teamId);
    if (!team) throw new Error('Team not found');

    const updatedMembers = team.memberIds.filter((id) => id !== userId);
    await this.update(teamId, { memberIds: updatedMembers });
  },

  // Delete team
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // Subscribe to all teams
  subscribeToAll(callback: (teams: Team[]) => void): Unsubscribe {
    const q = query(collection(db, COLLECTION_NAME), orderBy('totalPoints', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const teams = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Team));
      callback(teams);
    });
  },

  // Subscribe to season teams
  subscribeToSeason(seasonId: string, callback: (teams: Team[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('seasonId', '==', seasonId),
      orderBy('totalPoints', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const teams = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Team));
      callback(teams);
    });
  },
};