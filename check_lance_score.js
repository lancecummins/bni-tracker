const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkLanceScore() {
  try {
    // Find Lance by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'lance@nectafy.com')
      .get();
    
    if (usersSnapshot.empty) {
      console.log('Lance not found');
      return;
    }
    
    const lanceDoc = usersSnapshot.docs[0];
    const lanceId = lanceDoc.id;
    console.log('Lance ID:', lanceId);
    console.log('Lance data:', lanceDoc.data());
    
    // Find Week 3 - October 29, 2025 session
    const sessionsSnapshot = await db.collection('sessions')
      .where('weekNumber', '==', 3)
      .get();
    
    console.log('\nAll Week 3 sessions:');
    sessionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = data.date?.toDate();
      console.log(`- ${doc.id}: ${data.name}, Date: ${date}, Status: ${data.status}`);
    });
    
    // Find Lance's scores for any Week 3 session
    const scoresSnapshot = await db.collection('scores')
      .where('userId', '==', lanceId)
      .get();
    
    console.log('\nLance\'s scores:');
    scoresSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Session: ${data.sessionId}`);
      console.log(`Total Points: ${data.totalPoints}`);
      console.log('Metrics:', data.metrics);
      console.log('Custom Bonuses:', data.customBonuses);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkLanceScore();
