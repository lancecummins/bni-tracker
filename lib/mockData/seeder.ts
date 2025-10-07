import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { generateCompleteDataset } from './generator';
import {
  User,
  Team,
  Season,
  Session,
  Score,
  Achievement,
} from '@/lib/types';

// Collection names
const COLLECTIONS = {
  users: 'users',
  teams: 'teams',
  seasons: 'seasons',
  sessions: 'sessions',
  scores: 'scores',
  achievements: 'achievements',
};

// Clear all data from a collection
const clearCollection = async (collectionName: string): Promise<void> => {
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);

  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Cleared ${snapshot.size} documents from ${collectionName}`);
};

// Clear all collections
export const clearDatabase = async (): Promise<void> => {
  console.log('Clearing database...');

  for (const collectionName of Object.values(COLLECTIONS)) {
    await clearCollection(collectionName);
  }

  console.log('Database cleared successfully');
};

// Seed users to database
const seedUsers = async (users: User[]): Promise<Record<string, string>> => {
  console.log(`Seeding ${users.length} users...`);
  const userIdMap: Record<string, string> = {};

  const batch = writeBatch(db);

  users.forEach((user, index) => {
    const docRef = doc(collection(db, COLLECTIONS.users));
    const userId = docRef.id;
    userIdMap[`user-${index}`] = userId;

    batch.set(docRef, {
      ...user,
      id: userId,
    });
  });

  await batch.commit();
  console.log('Users seeded successfully');
  return userIdMap;
};

// Seed teams to database
const seedTeams = async (
  teams: Team[],
  userIdMap: Record<string, string>
): Promise<Record<string, string>> => {
  console.log(`Seeding ${teams.length} teams...`);
  const teamIdMap: Record<string, string> = {};

  const batch = writeBatch(db);

  teams.forEach((team, index) => {
    const docRef = doc(collection(db, COLLECTIONS.teams));
    const teamId = docRef.id;
    teamIdMap[`team-${index}`] = teamId;

    // Map the member IDs to real Firebase IDs
    const mappedMemberIds = team.memberIds.map((id) => userIdMap[id] || id);

    batch.set(docRef, {
      ...team,
      id: teamId,
      memberIds: mappedMemberIds,
      captainId: mappedMemberIds[0], // First member as captain
    });
  });

  await batch.commit();
  console.log('Teams seeded successfully');
  return teamIdMap;
};

// Update users with their team IDs
const updateUsersWithTeams = async (
  users: User[],
  userIdMap: Record<string, string>,
  teamIdMap: Record<string, string>
): Promise<void> => {
  console.log('Updating users with team assignments...');
  const batch = writeBatch(db);

  users.forEach((user, index) => {
    if (user.teamId) {
      const userId = userIdMap[`user-${index}`];
      const teamId = teamIdMap[user.teamId];

      if (userId && teamId) {
        const userRef = doc(db, COLLECTIONS.users, userId);
        batch.update(userRef, { teamId });
      }
    }
  });

  await batch.commit();
  console.log('User team assignments updated successfully');
};

// Seed season to database
const seedSeason = async (season: Season): Promise<string> => {
  console.log('Seeding season...');
  const docRef = doc(collection(db, COLLECTIONS.seasons));
  const seasonId = docRef.id;

  await setDoc(docRef, {
    ...season,
    id: seasonId,
  });

  console.log('Season seeded successfully');
  return seasonId;
};

// Seed sessions to database
const seedSessions = async (
  sessions: Session[],
  seasonId: string,
  adminUserId: string
): Promise<Record<string, string>> => {
  console.log(`Seeding ${sessions.length} sessions...`);
  const sessionIdMap: Record<string, string> = {};

  const batch = writeBatch(db);

  sessions.forEach((session, index) => {
    const docRef = doc(collection(db, COLLECTIONS.sessions));
    const sessionId = docRef.id;
    sessionIdMap[`session-${index}`] = sessionId;

    batch.set(docRef, {
      ...session,
      id: sessionId,
      seasonId,
      createdBy: adminUserId,
    });
  });

  await batch.commit();
  console.log('Sessions seeded successfully');
  return sessionIdMap;
};

// Seed scores to database
const seedScores = async (
  scores: Score[],
  userIdMap: Record<string, string>,
  sessionIdMap: Record<string, string>,
  teamIdMap: Record<string, string>,
  seasonId: string
): Promise<void> => {
  console.log(`Seeding ${scores.length} scores...`);

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  for (let i = 0; i < scores.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchScores = scores.slice(i, i + batchSize);

    batchScores.forEach((score) => {
      const docRef = doc(collection(db, COLLECTIONS.scores));

      // Map IDs to real Firebase IDs
      const mappedScore = {
        ...score,
        id: docRef.id,
        userId: userIdMap[score.userId] || score.userId,
        sessionId: sessionIdMap[score.sessionId] || score.sessionId,
        teamId: score.teamId ? (teamIdMap[score.teamId] || score.teamId) : null,
        seasonId,
      };

      batch.set(docRef, mappedScore);
    });

    await batch.commit();
    console.log(`Seeded batch ${Math.floor(i / batchSize) + 1} of scores`);
  }

  console.log('Scores seeded successfully');
};

// Seed achievements to database
const seedAchievements = async (achievements: Achievement[]): Promise<void> => {
  console.log(`Seeding ${achievements.length} achievements...`);

  const batch = writeBatch(db);

  achievements.forEach((achievement) => {
    const docRef = doc(collection(db, COLLECTIONS.achievements));
    batch.set(docRef, {
      ...achievement,
      id: docRef.id,
    });
  });

  await batch.commit();
  console.log('Achievements seeded successfully');
};

// Main seeding function
export const seedDatabase = async (
  userCount: number = 20,
  teamCount: number = 4,
  weeksToGenerate: number = 3,
  clearFirst: boolean = true
): Promise<void> => {
  try {
    console.log('Starting database seeding...');

    // Clear existing data if requested
    if (clearFirst) {
      await clearDatabase();
    }

    // Generate mock data
    const dataset = generateCompleteDataset(userCount, teamCount, weeksToGenerate);

    // Seed data in correct order
    const userIdMap = await seedUsers(dataset.users);
    const teamIdMap = await seedTeams(dataset.teams, userIdMap);

    // Update users with their team assignments
    await updateUsersWithTeams(dataset.users, userIdMap, teamIdMap);

    const seasonId = await seedSeason(dataset.season);
    const adminUserId = userIdMap['user-0']; // First user is admin
    const sessionIdMap = await seedSessions(dataset.sessions, seasonId, adminUserId);

    await seedScores(
      dataset.scores,
      userIdMap,
      sessionIdMap,
      teamIdMap,
      seasonId
    );

    await seedAchievements(dataset.achievements);

    console.log('Database seeding completed successfully!');

    // Return summary
    return {
      users: Object.keys(userIdMap).length,
      teams: Object.keys(teamIdMap).length,
      sessions: Object.keys(sessionIdMap).length,
      scores: dataset.scores.length,
      achievements: dataset.achievements.length,
    } as any;
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

// Reset database (clear and reseed)
export const resetDatabase = async (): Promise<void> => {
  await seedDatabase(20, 4, 3, true);
};