/**
 * Cleanup Script: Remove Duplicate Teams
 *
 * This script finds and deletes duplicate teams that were created
 * when testing the season creation flow.
 *
 * Run with: node scripts/cleanup-duplicate-teams.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
// You'll need to set your Firebase service account credentials
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function findDuplicateTeams() {
  console.log('\n🔍 Searching for duplicate teams...\n');

  const teamsSnapshot = await db.collection('teams').get();

  // Group teams by name
  const teamsByName = {};
  teamsSnapshot.docs.forEach(doc => {
    const team = { id: doc.id, ...doc.data() };
    if (!teamsByName[team.name]) {
      teamsByName[team.name] = [];
    }
    teamsByName[team.name].push(team);
  });

  // Find duplicates
  const duplicates = {};
  Object.keys(teamsByName).forEach(name => {
    if (teamsByName[name].length > 1) {
      duplicates[name] = teamsByName[name];
    }
  });

  if (Object.keys(duplicates).length === 0) {
    console.log('✅ No duplicate teams found!');
    return null;
  }

  console.log(`Found ${Object.keys(duplicates).length} team(s) with duplicates:\n`);

  Object.keys(duplicates).forEach(name => {
    console.log(`📋 Team: ${name}`);
    duplicates[name].forEach((team, idx) => {
      const createdAt = team.createdAt?.toDate?.() || 'Unknown date';
      console.log(`  ${idx + 1}. ID: ${team.id.substring(0, 8)}... | Season: ${team.seasonId?.substring(0, 8)}... | Created: ${createdAt}`);
    });
    console.log('');
  });

  return duplicates;
}

async function deleteDuplicates(duplicates) {
  const teamsToDelete = [];

  // For each duplicate group, keep the oldest one, delete the rest
  Object.keys(duplicates).forEach(name => {
    const teams = duplicates[name];
    // Sort by createdAt, oldest first
    teams.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA - dateB;
    });

    // Delete all except the first (oldest)
    for (let i = 1; i < teams.length; i++) {
      teamsToDelete.push(teams[i]);
    }
  });

  console.log(`\n⚠️  Will delete ${teamsToDelete.length} duplicate team(s):\n`);
  teamsToDelete.forEach(team => {
    console.log(`  - ${team.name} (ID: ${team.id.substring(0, 8)}...)`);
  });

  return new Promise((resolve) => {
    rl.question('\nProceed with deletion? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const batch = db.batch();
        teamsToDelete.forEach(team => {
          batch.delete(db.collection('teams').doc(team.id));
        });

        await batch.commit();
        console.log(`\n✅ Deleted ${teamsToDelete.length} duplicate team(s)!`);
      } else {
        console.log('\n❌ Cancelled deletion.');
      }
      resolve();
    });
  });
}

async function main() {
  try {
    const duplicates = await findDuplicateTeams();

    if (duplicates) {
      await deleteDuplicates(duplicates);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
