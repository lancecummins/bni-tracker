'use client';

import { useState } from 'react';
import { seasonService, settingsService } from '@/lib/firebase/services';
import { useSeasons, useSettings, useActiveSeason } from '@/lib/firebase/hooks';
import { AlertCircle, CheckCircle, Database, Loader, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Timestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function MigrateSeasonPage() {
  const { seasons } = useSeasons();
  const { season: activeSeason } = useActiveSeason();
  const { settings } = useSettings();
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [fixingSessions, setFixingSessions] = useState(false);
  const [sessionsFixed, setSessionsFixed] = useState(false);

  const handleMigrate = async () => {
    if (seasons.length > 0) {
      toast.error('Seasons already exist. Migration not needed.');
      return;
    }

    if (!confirm('This will create an initial season from your current settings. Continue?')) {
      return;
    }

    try {
      setMigrating(true);

      // Create initial season from settings
      const seasonSettings = settings?.seasonSettings || {
        name: 'Current Season',
        weekCount: 12,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      const initialSeason = {
        name: seasonSettings.name || 'Season 1',
        startDate: Timestamp.fromDate(new Date(seasonSettings.startDate)),
        endDate: Timestamp.fromDate(new Date(seasonSettings.endDate)),
        weekCount: seasonSettings.weekCount || 12,
        currentWeek: 1,
        isActive: true,
        pointValues: settings?.pointValues || {
          attendance: 10,
          one21s: 15,
          referrals: 25,
          tyfcb: 20,
          visitors: 15,
        },
        bonusValues: settings?.bonusValues || {
          attendance: 50,
          one21s: 50,
          referrals: 100,
          tyfcb: 75,
          visitors: 50,
        },
        createdAt: Timestamp.now(),
      };

      const seasonId = await seasonService.create(initialSeason);

      toast.success('Initial season created successfully!');
      setMigrationComplete(true);
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Failed to migrate. See console for details.');
    } finally {
      setMigrating(false);
    }
  };

  const handleFixOldSessions = async () => {
    if (!activeSeason?.id) {
      toast.error('No active season found. Create a season first.');
      return;
    }

    if (!confirm('This will update all sessions with seasonId "season-id" to use your current active season. Continue?')) {
      return;
    }

    try {
      setFixingSessions(true);

      // Find all sessions with old hardcoded season-id
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('seasonId', '==', 'season-id')
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);

      if (sessionsSnapshot.empty) {
        toast('No old sessions found to fix.');
        setFixingSessions(false);
        return;
      }

      toast(`Found ${sessionsSnapshot.size} sessions to update...`);

      // Update in batches (Firestore limit is 500 per batch)
      const batchSize = 500;
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      sessionsSnapshot.docs.forEach((doc) => {
        currentBatch.update(doc.ref, { seasonId: activeSeason.id });
        operationCount++;

        if (operationCount === batchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      // Push the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Commit all batches
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        toast(`Batch ${i + 1}/${batches.length} committed`);
      }

      // Also update scores with old season-id
      const scoresQuery = query(
        collection(db, 'scores'),
        where('seasonId', '==', 'season-id')
      );
      const scoresSnapshot = await getDocs(scoresQuery);

      if (!scoresSnapshot.empty) {
        toast(`Found ${scoresSnapshot.size} scores to update...`);

        const scoreBatches = [];
        let scoreBatch = writeBatch(db);
        let scoreOpCount = 0;

        scoresSnapshot.docs.forEach((doc) => {
          scoreBatch.update(doc.ref, { seasonId: activeSeason.id });
          scoreOpCount++;

          if (scoreOpCount === batchSize) {
            scoreBatches.push(scoreBatch);
            scoreBatch = writeBatch(db);
            scoreOpCount = 0;
          }
        });

        if (scoreOpCount > 0) {
          scoreBatches.push(scoreBatch);
        }

        for (let i = 0; i < scoreBatches.length; i++) {
          await scoreBatches[i].commit();
        }

        toast.success(`Updated ${scoresSnapshot.size} scores!`);
      }

      // Also update teams with old season-id
      const teamsQuery = query(
        collection(db, 'teams'),
        where('seasonId', '==', 'season-id')
      );
      const teamsSnapshot = await getDocs(teamsQuery);

      if (!teamsSnapshot.empty) {
        const teamBatch = writeBatch(db);
        teamsSnapshot.docs.forEach((doc) => {
          teamBatch.update(doc.ref, { seasonId: activeSeason.id });
        });
        await teamBatch.commit();
        toast.success(`Updated ${teamsSnapshot.size} teams!`);
      }

      toast.success(`Migration complete! Updated ${sessionsSnapshot.size} sessions.`);
      setSessionsFixed(true);
    } catch (error) {
      console.error('Fix sessions error:', error);
      toast.error('Failed to fix sessions. See console for details.');
    } finally {
      setFixingSessions(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-blue-600" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Season Migration</h1>
            <p className="text-gray-600">One-time setup to create your initial season</p>
          </div>
        </div>

        {seasons.length > 0 ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle size={20} />
              <span className="font-medium">Migration already complete!</span>
            </div>
            <p className="mt-2 text-sm text-green-700">
              You have {seasons.length} season(s) in your database. You can manage them from the Seasons page.
            </p>
          </div>
        ) : migrationComplete ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle size={20} />
              <span className="font-medium">Migration successful!</span>
            </div>
            <p className="mt-2 text-sm text-green-700">
              Your initial season has been created. You can now use the Seasons page to manage it.
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertCircle size={20} />
                <span className="font-medium">No seasons found</span>
              </div>
              <p className="text-sm text-yellow-700">
                Your database doesn't have any seasons yet. This migration will create an initial season using
                your current settings configuration.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">What this migration does:</h3>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600">
                  <li>Creates a new season with your current point values and bonus settings</li>
                  <li>Sets the season as active</li>
                  <li>Preserves all existing users, teams, sessions, and scores</li>
                  <li>Does NOT modify any existing data</li>
                </ul>
              </div>

              {settings && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Season Configuration Preview:</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Name:</strong> {settings.seasonSettings?.name || 'Season 1'}</p>
                    <p><strong>Weeks:</strong> {settings.seasonSettings?.weekCount || 12}</p>
                    <p>
                      <strong>Point Values:</strong> Attendance: {settings.pointValues.attendance},
                      1-2-1s: {settings.pointValues.one21s},
                      Referrals: {settings.pointValues.referrals},
                      TYFCB: {settings.pointValues.tyfcb},
                      Visitors: {settings.pointValues.visitors}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {migrating ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Running Migration...
                  </>
                ) : (
                  <>
                    <Database size={20} />
                    Run Migration
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Fix Old Sessions Section */}
      {seasons.length > 0 && activeSeason && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="text-orange-600" size={32} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Fix Old Sessions</h2>
              <p className="text-gray-600">Update legacy data to use new season system</p>
            </div>
          </div>

          {sessionsFixed ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle size={20} />
                <span className="font-medium">Sessions fixed successfully!</span>
              </div>
              <p className="mt-2 text-sm text-green-700">
                All old sessions, scores, and teams have been updated to use your current season.
                You can now view them properly in the Sessions page.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-orange-800 mb-2">
                  <AlertCircle size={20} />
                  <span className="font-medium">Legacy Data Detected</span>
                </div>
                <p className="text-sm text-orange-700">
                  You have sessions, scores, and teams with the old hardcoded <code className="bg-orange-100 px-1 py-0.5 rounded">season-id</code> value.
                  This migration will update them to use your current active season: <strong>{activeSeason.name}</strong>
                </p>
              </div>

              <div className="space-y-3 mb-4">
                <h3 className="font-semibold text-gray-900">What this migration does:</h3>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600">
                  <li>Finds all sessions with <code className="bg-gray-100 px-1 py-0.5 rounded">seasonId: "season-id"</code></li>
                  <li>Updates them to use your active season's actual ID</li>
                  <li>Also updates related scores and teams</li>
                  <li>Does NOT modify any other data</li>
                  <li>Safe to run multiple times (idempotent)</li>
                </ul>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-sm text-blue-800">
                <strong>Note:</strong> Make sure you've created a backup before running this migration!
                You can create one from the <a href="/admin/backup" className="underline font-semibold">Backup page</a>.
              </div>

              <button
                onClick={handleFixOldSessions}
                disabled={fixingSessions}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {fixingSessions ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    Fixing Sessions...
                  </>
                ) : (
                  <>
                    <RefreshCw size={20} />
                    Fix Old Sessions & Scores
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">After Migration</h3>
        <p className="text-sm text-blue-800">
          Once the migration is complete, you can manage seasons from the <strong>Seasons</strong> page in the admin menu.
          You'll be able to create new seasons, close old ones, and view historical data.
        </p>
      </div>
    </div>
  );
}
