import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config';
import { Draft, DraftPick, Team, Score } from '@/lib/types';

export const draftService = {
  /**
   * Create a new draft for a season
   */
  async create(seasonId: string, teamLeaders: Draft['teamLeaders']): Promise<string> {
    const draftData: Omit<Draft, 'id'> = {
      seasonId,
      status: 'in_progress',
      teamLeaders,
      picks: [],
      currentPickNumber: 0,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'drafts'), draftData);
    return docRef.id;
  },

  /**
   * Get draft by ID
   */
  async getById(id: string): Promise<Draft | null> {
    const docRef = doc(db, 'drafts', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as Draft;
  },

  /**
   * Get active draft for a season
   */
  async getBySeasonId(seasonId: string): Promise<Draft | null> {
    const q = query(
      collection(db, 'drafts'),
      where('seasonId', '==', seasonId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Draft;
  },

  /**
   * Record a draft pick
   */
  async makePick(
    draftId: string,
    userId: string,
    teamId: string,
    pickedBy: string
  ): Promise<void> {
    const draft = await this.getById(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    // Calculate round and pick number
    const pickNumber = draft.currentPickNumber;
    const round = Math.floor(pickNumber / draft.teamLeaders.length) + 1;

    const newPick: DraftPick = {
      userId,
      teamId,
      round,
      pickNumber,
      pickedBy,
      timestamp: Timestamp.now(),
    };

    const docRef = doc(db, 'drafts', draftId);
    await updateDoc(docRef, {
      picks: [...draft.picks, newPick],
      currentPickNumber: draft.currentPickNumber + 1,
    });
  },

  /**
   * Get current turn info (which team leader should pick)
   */
  getCurrentTurn(draft: Draft): {
    teamId: string;
    userId: string;
    draftPosition: number;
  } | null {
    if (draft.status === 'completed') {
      return null;
    }

    // Standard draft order: position repeats (1,2,3,4, 1,2,3,4, ...)
    const currentPosition = (draft.currentPickNumber % draft.teamLeaders.length) + 1;

    const currentLeader = draft.teamLeaders.find(
      leader => leader.draftPosition === currentPosition
    );

    return currentLeader || null;
  },

  /**
   * Calculate draft order based on previous season standings (worst to first)
   */
  async calculateDraftOrder(previousSeasonId: string): Promise<{
    teamId: string;
    totalPoints: number;
  }[]> {
    // Get all teams from previous season
    const teamsQuery = query(
      collection(db, 'teams'),
      where('seasonId', '==', previousSeasonId)
    );
    const teamsSnapshot = await getDocs(teamsQuery);

    if (teamsSnapshot.empty) {
      // Return empty array if no teams found - caller will handle it
      return [];
    }

    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Team[];

    // Get all scores from previous season
    const scoresQuery = query(
      collection(db, 'scores'),
      where('seasonId', '==', previousSeasonId)
    );
    const scoresSnapshot = await getDocs(scoresQuery);
    const scores = scoresSnapshot.docs.map(doc => doc.data()) as Score[];

    // Calculate total points per team
    const teamPoints = teams.map(team => {
      const teamScores = scores.filter(score => score.teamId === team.id);
      const totalPoints = teamScores.reduce((sum, score) => sum + score.totalPoints, 0);

      return {
        teamId: team.id!,
        totalPoints,
      };
    });

    // Sort by points ascending (worst team first)
    return teamPoints.sort((a, b) => a.totalPoints - b.totalPoints);
  },

  /**
   * Get available users for drafting (active, not admin, not team leader, not already picked)
   */
  async getAvailableUsers(draft: Draft): Promise<string[]> {
    const usersQuery = query(
      collection(db, 'users'),
      where('isActive', '==', true)
    );
    const usersSnapshot = await getDocs(usersQuery);

    // Filter out admins, team leaders, and already-picked users
    const pickedUserIds = draft.picks.map(pick => pick.userId);
    const teamLeaderIds = draft.teamLeaders.map(leader => leader.userId);

    const availableUsers = usersSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(user =>
        user.role !== 'admin' &&
        !teamLeaderIds.includes(user.id!) &&
        !pickedUserIds.includes(user.id!)
      )
      .map(user => user.id!);

    return availableUsers;
  },

  /**
   * Finalize draft and assign all picks to teams
   */
  async finalize(draftId: string): Promise<void> {
    const draft = await this.getById(draftId);
    if (!draft) {
      throw new Error('Draft not found');
    }

    const batch = writeBatch(db);

    // Update all users with their team assignments
    for (const pick of draft.picks) {
      const userRef = doc(db, 'users', pick.userId);
      batch.update(userRef, {
        teamId: pick.teamId,
      });
    }

    // Update draft status
    const draftRef = doc(db, 'drafts', draftId);
    batch.update(draftRef, {
      status: 'completed',
      completedAt: Timestamp.now(),
    });

    await batch.commit();
  },

  /**
   * Admin override: assign any user to any team (doesn't go through draft pick flow)
   */
  async adminAssign(
    draftId: string,
    userId: string,
    teamId: string,
    adminId: string
  ): Promise<void> {
    await this.makePick(draftId, userId, teamId, adminId);
  },

  /**
   * Subscribe to draft changes in real-time
   */
  subscribe(draftId: string, callback: (draft: Draft | null) => void): Unsubscribe {
    const docRef = doc(db, 'drafts', draftId);

    return onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({ id: snapshot.id, ...snapshot.data() } as Draft);
    });
  },

  /**
   * Subscribe to draft by season ID
   */
  subscribeBySeasonId(
    seasonId: string,
    callback: (draft: Draft | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'drafts'),
      where('seasonId', '==', seasonId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          callback(null);
          return;
        }

        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() } as Draft);
      },
      (error) => {
        console.error('Firestore snapshot error:', error);
        if (onError) {
          onError(error as Error);
        }
      }
    );
  },
};
