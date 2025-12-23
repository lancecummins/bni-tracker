import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Firebase config (from your project)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixTeamSeasons() {
  console.log('🔍 Checking team seasonIds...\n');

  // Get ALL seasons first to show current state
  const allSeasonsSnapshot = await getDocs(collection(db, 'seasons'));
  const allSeasons = allSeasonsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  console.log(`📅 All Seasons (${allSeasons.length}):\n`);
  allSeasons.forEach((season: any) => {
    console.log(`  ${season.isActive ? '🟢' : '⚪'} ${season.name} (ID: ${season.id}) - Active: ${season.isActive}`);
  });
  console.log('\n');

  // Get active season
  const seasonsQuery = query(
    collection(db, 'seasons'),
    where('isActive', '==', true)
  );
  const seasonsSnapshot = await getDocs(seasonsQuery);

  if (seasonsSnapshot.empty) {
    console.log('❌ No active season found!');
    console.log('💡 Tip: Create a season at /admin/seasons-management or activate an existing one');
    return;
  }

  const activeSeason = {
    id: seasonsSnapshot.docs[0].id,
    ...seasonsSnapshot.docs[0].data(),
  } as any;

  console.log(`✅ Active Season: ${activeSeason.name} (ID: ${activeSeason.id})\n`);

  // Get all teams
  const teamsSnapshot = await getDocs(collection(db, 'teams'));
  const teams = teamsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  console.log(`📊 Found ${teams.length} teams:\n`);

  // Check each team's seasonId
  const teamsToFix: any[] = [];
  teams.forEach((team: any) => {
    const isCorrect = team.seasonId === activeSeason.id;
    console.log(`  ${isCorrect ? '✅' : '❌'} ${team.name} - seasonId: ${team.seasonId || 'NULL'}`);

    if (!isCorrect) {
      teamsToFix.push(team);
    }
  });

  console.log('\n');

  if (teamsToFix.length === 0) {
    console.log('🎉 All teams have correct seasonId!');
    return;
  }

  console.log(`⚠️  ${teamsToFix.length} teams need to be updated to season: ${activeSeason.id}\n`);
  console.log('🔧 Updating teams...');

  // Update teams to active season
  const batch = writeBatch(db);

  teamsToFix.forEach((team: any) => {
    const teamRef = doc(db, 'teams', team.id);
    batch.update(teamRef, { seasonId: activeSeason.id });
  });

  await batch.commit();

  console.log('✅ Teams updated successfully!\n');
  console.log('🎯 Next steps:');
  console.log('  1. Visit /admin/teams to assign team leaders');
  console.log('  2. Visit /admin/draft-setup to start the draft');
}

fixTeamSeasons()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
