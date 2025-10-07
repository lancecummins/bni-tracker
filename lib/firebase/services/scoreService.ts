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
import { Score, ScoreMetrics, PointValues } from '@/lib/types';

const COLLECTION_NAME = 'scores';

export const scoreService = {
  // Get all scores
  async getAll(): Promise<Score[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('totalPoints', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Score));
  },

  // Get score by ID
  async getById(id: string): Promise<Score | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Score;
  },

  // Get scores by session
  async getBySession(sessionId: string): Promise<Score[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('sessionId', '==', sessionId),
      orderBy('totalPoints', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Score));
  },

  // Get scores by user and season
  async getByUserAndSeason(userId: string, seasonId: string): Promise<Score[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('seasonId', '==', seasonId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Score));
  },

  // Get scores by team and session
  async getByTeamAndSession(teamId: string, sessionId: string): Promise<Score[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('teamId', '==', teamId),
      where('sessionId', '==', sessionId),
      orderBy('totalPoints', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Score));
  },

  // Calculate total points from metrics
  calculateTotalPoints(metrics: ScoreMetrics, pointValues: PointValues): number {
    const attendance = (metrics?.attendance || 0) * (pointValues?.attendance || 0);
    const one21s = (metrics?.one21s || 0) * (pointValues?.one21s || 0);
    const referrals = (metrics?.referrals || 0) * (pointValues?.referrals || 0);
    const tyfcb = (metrics?.tyfcb || 0) * (pointValues?.tyfcb || 0);
    const visitors = (metrics?.visitors || 0) * (pointValues?.visitors || 0);

    const total = attendance + one21s + referrals + tyfcb + visitors;
    return isNaN(total) ? 0 : total;
  },

  // Create or update score
  async upsert(score: Omit<Score, 'id'>): Promise<string> {
    // Check if score already exists for this user/session
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', score.userId),
      where('sessionId', '==', score.sessionId)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Update existing score
      const existingId = snapshot.docs[0].id;
      await updateDoc(doc(db, COLLECTION_NAME, existingId), {
        ...score,
        updatedAt: Timestamp.now(),
      });
      return existingId;
    } else {
      // Create new score
      const docRef = doc(collection(db, COLLECTION_NAME));
      await setDoc(docRef, {
        ...score,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    }
  },

  // Update score metrics
  async updateMetrics(
    id: string,
    metrics: ScoreMetrics,
    pointValues: PointValues
  ): Promise<void> {
    const totalPoints = this.calculateTotalPoints(metrics, pointValues);
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      metrics,
      totalPoints,
      updatedAt: Timestamp.now(),
    });
  },

  // Update score (generic update method)
  async update(id: string, updates: Partial<Score>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  // Get published scores by session (for display screens)
  async getPublishedBySession(sessionId: string): Promise<Score[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('sessionId', '==', sessionId),
      where('isDraft', '==', false),
      orderBy('totalPoints', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Score));
  },

  // Subscribe to session scores (all scores including drafts - for admin)
  subscribeToSession(sessionId: string, callback: (scores: Score[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('sessionId', '==', sessionId),
      orderBy('totalPoints', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Score));
      callback(scores);
    });
  },

  // Subscribe to published session scores (for display screens)
  subscribeToPublishedSession(sessionId: string, callback: (scores: Score[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('sessionId', '==', sessionId),
      where('isDraft', '==', false),
      orderBy('totalPoints', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Score));
      callback(scores);
    });
  },

  // Subscribe to user scores
  subscribeToUser(userId: string, callback: (scores: Score[]) => void): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Score));
      callback(scores);
    });
  },

  // Get team totals for a session
  async getTeamTotals(sessionId: string): Promise<Record<string, number>> {
    const scores = await this.getBySession(sessionId);
    const teamTotals: Record<string, number> = {};

    scores.forEach((score) => {
      if (score.teamId) {
        if (!teamTotals[score.teamId]) {
          teamTotals[score.teamId] = 0;
        }
        teamTotals[score.teamId] += score.totalPoints;
      }
    });

    return teamTotals;
  },
};