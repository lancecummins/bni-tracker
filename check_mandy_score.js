const admin = require('firebase-admin');
const serviceAccount = require('./.firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkMandyScore() {
  const sessionId = 'jqr491JCfTUXHD3YHPP0';

  // Get all scores for this session
  const scoresSnapshot = await db.collection('scores')
    .where('sessionId', '==', sessionId)
    .get();

  console.log(`Found ${scoresSnapshot.size} scores for session`);

  // Find Mandy's score
  for (const doc of scoresSnapshot.docs) {
    const score = doc.data();
    const userDoc = await db.collection('users').doc(score.userId).get();
    const user = userDoc.data();

    if (user && user.firstName === 'Mandy') {
      console.log('\n=== MANDY SCORE ===');
      console.log('Score ID:', doc.id);
      console.log('User:', user.firstName, user.lastName);
      console.log('Metrics:', score.metrics);
      console.log('Custom Bonuses:', score.customBonuses);
      console.log('Total Points (stored):', score.totalPoints);

      // Calculate what it should be
      const settings = await db.collection('settings').doc('default').get();
      const pointValues = settings.data().pointValues;

      const metricsTotal =
        (score.metrics.attendance || 0) * pointValues.attendance +
        (score.metrics.one21s || 0) * pointValues.one21s +
        (score.metrics.referrals || 0) * pointValues.referrals +
        (score.metrics.tyfcb || 0) * pointValues.tyfcb +
        (score.metrics.visitors || 0) * pointValues.visitors;

      const bonusTotal = (score.customBonuses || []).reduce((sum, b) => sum + b.points, 0);
      const expectedTotal = metricsTotal + bonusTotal;

      console.log('\nCalculations:');
      console.log('Metrics Total:', metricsTotal);
      console.log('Bonus Total:', bonusTotal);
      console.log('Expected Total:', expectedTotal);
      console.log('Actual Total:', score.totalPoints);
      console.log('Difference:', expectedTotal - score.totalPoints);
    }
  }
}

checkMandyScore().then(() => process.exit(0)).catch(console.error);
