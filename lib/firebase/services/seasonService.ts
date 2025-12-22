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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Season } from '@/lib/types';

const COLLECTION_NAME = 'seasons';

export const seasonService = {
  // Get all seasons
  async getAll(): Promise<Season[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('startDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Season));
  },

  // Get season by ID
  async getById(id: string): Promise<Season | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Season;
  },

  // Get current active season
  async getActive(): Promise<Season | null> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    // There should only be one active season
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as Season;
  },

  // Create a new season
  async create(season: Omit<Season, 'id'>): Promise<string> {
    const batch = writeBatch(db);

    // First, deactivate any currently active seasons
    const activeSeasons = await getDocs(
      query(collection(db, COLLECTION_NAME), where('isActive', '==', true))
    );

    activeSeasons.docs.forEach((doc) => {
      batch.update(doc.ref, { isActive: false });
    });

    // Create the new season
    const docRef = doc(collection(db, COLLECTION_NAME));
    batch.set(docRef, {
      ...season,
      isActive: true,
      currentWeek: 1,
      createdAt: Timestamp.now(),
    });

    await batch.commit();
    return docRef.id;
  },

  // Update season
  async update(id: string, data: Partial<Season>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...data,
    });
  },

  // Close season (deactivate)
  async close(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isActive: false,
      endDate: Timestamp.now(), // Update end date to actual close date
    });
  },

  // Activate a season (and deactivate others)
  async activate(id: string): Promise<void> {
    const batch = writeBatch(db);

    // Deactivate all seasons
    const allSeasons = await getDocs(collection(db, COLLECTION_NAME));
    allSeasons.docs.forEach((doc) => {
      batch.update(doc.ref, { isActive: false });
    });

    // Activate the specified season
    const docRef = doc(db, COLLECTION_NAME, id);
    batch.update(docRef, { isActive: true });

    await batch.commit();
  },

  // Subscribe to active season
  subscribeToActive(callback: (season: Season | null) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true)
    );

    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        callback({
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        } as Season);
      }
    });
  },

  // Subscribe to all seasons
  subscribeToAll(callback: (seasons: Season[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('startDate', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const seasons = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Season));
      callback(seasons);
    });
  },

  // Helper: Check if all sessions in a season are closed
  async areAllSessionsClosed(seasonId: string): Promise<boolean> {
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('seasonId', '==', seasonId),
      where('status', '!=', 'closed')
    );

    const openSessions = await getDocs(sessionsQuery);
    return openSessions.empty;
  },

  // Helper: Update existing teams for new season (reuses teams instead of duplicating)
  async duplicateTeamsForNewSeason(
    previousSeasonId: string,
    newSeasonId: string
  ): Promise<void> {
    const teamsQuery = query(
      collection(db, 'teams'),
      where('seasonId', '==', previousSeasonId)
    );

    const teamsSnapshot = await getDocs(teamsQuery);
    const batch = writeBatch(db);

    teamsSnapshot.docs.forEach((teamDoc) => {
      // Update existing team to new season instead of creating duplicates
      batch.update(teamDoc.ref, {
        seasonId: newSeasonId,
        memberIds: [], // Clear members for draft
        captainId: null,
        teamLeaderId: null,
        totalPoints: 0,
        weeklyWins: 0,
      });
    });

    await batch.commit();
  },

  // Helper: Unassign all users from teams (for new season)
  async unassignAllUsersFromTeams(): Promise<void> {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);

    usersSnapshot.docs.forEach((userDoc) => {
      batch.update(userDoc.ref, { teamId: null });
    });

    await batch.commit();
  },
};
