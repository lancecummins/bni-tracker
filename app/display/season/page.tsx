'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowLeft } from 'lucide-react';
import { Team, Session, Score } from '@/lib/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Image from 'next/image';
import { scoreService } from '@/lib/firebase/services';
import { useActiveSeason } from '@/lib/firebase/hooks';
import { SeasonSelector } from '@/components';

interface TeamSeasonStats {
  team: Team;
  weeklyWins: number;
  totalPoints: number;
}

export default function SeasonStandingsPage() {
  const router = useRouter();
  const { season: activeSeason } = useActiveSeason();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamSeasonStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Set selected season to active season when it loads
  useEffect(() => {
    if (activeSeason && !selectedSeasonId) {
      setSelectedSeasonId(activeSeason.id!);
    }
  }, [activeSeason, selectedSeasonId]);

  useEffect(() => {
    const loadSeasonStats = async () => {
      if (!selectedSeasonId) return;

      setLoading(true);
      try {
        // Get all sessions and teams (winner logic matches admin sessions page)
        // Note: We don't require an active session to view season standings
        const [allSessionsSnapshot, allTeams] = await Promise.all([
          getDocs(collection(db, 'sessions')),
          getDocs(collection(db, 'teams'))
        ]);

        const allSessions = allSessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Session));

        console.log('[Season] Loaded all sessions:', allSessions.length);

        const teamsData = allTeams.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Team));

        // Filter to this season's non-archived closed sessions
        const closedSessions = allSessions.filter(s =>
          s.seasonId === selectedSeasonId &&
          s.status === 'closed' &&
          !s.isArchived
        );
        console.log('[Season] Total sessions:', allSessions.length, 'Closed non-archived for this season:', closedSessions.length);

        // Load scores for all closed sessions
        const sessionScoresMap = new Map<string, Score[]>();
        for (const session of closedSessions) {
          if (session.id) {
            const scores = await scoreService.getBySession(session.id);
            sessionScoresMap.set(session.id, scores);
          }
        }

        // Calculate weekly winners
        const weeklyWinsMap = new Map<string, number>();
        const totalPointsMap = new Map<string, number>();

        closedSessions.forEach(session => {
          if (!session.id) return;

          const sessionScores = sessionScoresMap.get(session.id) || [];
          const weeklyTeamPoints = new Map<string, number>();

          // Match admin sessions page: team total = sum of score totalPoints by teamId + session teamCustomBonuses only (no "All In")
          sessionScores.forEach(score => {
            if (score.teamId) {
              const current = weeklyTeamPoints.get(score.teamId) || 0;
              weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
            }
          });

          (session.teamCustomBonuses || []).forEach(b => {
            weeklyTeamPoints.set(b.teamId, (weeklyTeamPoints.get(b.teamId) || 0) + b.points);
          });

          // Find weekly winner (same logic as admin sessions page)
          let maxPoints = 0;
          let winningTeamId = '';
          weeklyTeamPoints.forEach((points, teamId) => {
            if (points > maxPoints) {
              maxPoints = points;
              winningTeamId = teamId;
            }
          });

          if (winningTeamId) {
            weeklyWinsMap.set(winningTeamId, (weeklyWinsMap.get(winningTeamId) || 0) + 1);
          }

          // Season points: sum these same weekly totals per team (consistent with sessions page)
          weeklyTeamPoints.forEach((points, teamId) => {
            totalPointsMap.set(teamId, (totalPointsMap.get(teamId) || 0) + points);
          });
        });

        // Build team stats
        const teamStats: TeamSeasonStats[] = teamsData.map(team => ({
          team,
          weeklyWins: weeklyWinsMap.get(team.id!) || 0,
          totalPoints: totalPointsMap.get(team.id!) || 0
        })).sort((a, b) => {
          if (b.weeklyWins !== a.weeklyWins) {
            return b.weeklyWins - a.weeklyWins;
          }
          return b.totalPoints - a.totalPoints;
        });

        console.log('[Season] Team stats calculated:', teamStats);
        setTeams(teamStats);
      } catch (error) {
        console.error('[Season] Error loading season stats:', error);
      } finally {
        console.log('[Season] Setting loading to false');
        setLoading(false);
      }
    };

    console.log('[Season] Component mounted, loading stats');
    loadSeasonStats();
  }, [selectedSeasonId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <Image
              src="/bni-game-logo.png"
              alt="BNI Competition Tracker"
              width={200}
              height={67}
              className="object-contain"
              priority
            />
            <div>
              <h1 className="text-5xl font-bold mb-1">
                Season Standings
              </h1>
              <p className="text-xl text-blue-200">
                Weekly Wins Through {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedSeasonId && (
              <SeasonSelector
                selectedSeasonId={selectedSeasonId}
                onSeasonChange={setSelectedSeasonId}
              />
            )}
            <button
              onClick={() => router.push('/display')}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Team Standings */}
      <div className="max-w-5xl mx-auto">
        {teams.length === 0 ? (
          <div className="text-center text-white/60 text-xl mt-12">
            No season data available yet. Complete and close at least one week to see standings.
          </div>
        ) : (
        <AnimatePresence mode="wait">
          <div className="space-y-4">
            {teams.map((teamStats, index) => (
              <motion.div
                key={teamStats.team.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden ${
                  index === 0 ? 'ring-4 ring-yellow-400' : ''
                }`}
              >
                {/* Colored bar */}
                <div className="h-4" style={{ backgroundColor: teamStats.team.color || '#3B82F6' }} />

                <div className="flex items-stretch">
                  {/* Team Logo */}
                  {teamStats.team.logoUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={teamStats.team.logoUrl}
                        alt={`${teamStats.team.name} logo`}
                        className="h-full w-48 object-cover"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      {/* Team Info */}
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-1">
                          {teamStats.team.name}
                        </h2>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-center">
                      <div className="text-sm text-white/70 mb-2">
                        Weekly Wins
                      </div>
                      <div className="text-6xl font-bold text-yellow-400">
                        {teamStats.weeklyWins}
                      </div>
                      <div className="text-lg text-white/60 mt-2">
                        {teamStats.totalPoints.toLocaleString()} Season Points
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
        )}
      </div>
    </div>
  );
}
