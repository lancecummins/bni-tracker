'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowLeft } from 'lucide-react';
import { Team, Session, Score, Settings, User } from '@/lib/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Image from 'next/image';
import { scoreService, sessionService, settingsService, userService } from '@/lib/firebase/services';

interface TeamSeasonStats {
  team: Team;
  weeklyWins: number;
  totalPoints: number;
}

export default function SeasonStandingsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSeasonStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeasonStats = async () => {
      setLoading(true);
      try {
        // Get active season
        const activeSession = await sessionService.getActive();
        if (!activeSession?.seasonId) {
          setLoading(false);
          return;
        }

        // Get all sessions, settings, teams, and users
        const [allSessions, settings, allTeams, users] = await Promise.all([
          sessionService.getBySeason(activeSession.seasonId),
          settingsService.get(),
          getDocs(collection(db, 'teams')),
          userService.getAll()
        ]);

        const teamsData = allTeams.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Team));

        // Filter to non-archived closed sessions
        const closedSessions = allSessions.filter(s => s.status === 'closed' && !s.isArchived);

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

          // Calculate member points for each team
          sessionScores.forEach(score => {
            if (score.teamId) {
              const current = weeklyTeamPoints.get(score.teamId) || 0;
              weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
            }
          });

          // Add team bonuses
          weeklyTeamPoints.forEach((memberPoints, teamId) => {
            let bonusPoints = 0;

            // Get team members and scores
            const teamMembers = users.filter(u =>
              u.teamId === teamId &&
              u.isActive &&
              (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin')
            );
            const teamScores = sessionScores.filter(s => s.teamId === teamId);

            // "All In" bonuses - only if all team members have scores
            if (teamScores.length === teamMembers.length && teamMembers.length > 0) {
              const categoryList = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;
              categoryList.forEach(category => {
                const allMembersHaveCategory = teamMembers.every(member => {
                  const score = sessionScores.find(s => s.userId === member.id);
                  return score && score.metrics[category] > 0;
                });
                if (allMembersHaveCategory && settings?.bonusValues) {
                  bonusPoints += settings.bonusValues[category];
                }
              });
            }

            // Custom team bonuses
            const customBonuses = session.teamCustomBonuses?.filter(b => b.teamId === teamId) || [];
            bonusPoints += customBonuses.reduce((sum, b) => sum + b.points, 0);

            const totalPoints = memberPoints + bonusPoints;
            weeklyTeamPoints.set(teamId, totalPoints);

            // Add to season totals
            totalPointsMap.set(teamId, (totalPointsMap.get(teamId) || 0) + totalPoints);
          });

          // Find weekly winner
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

        setTeams(teamStats);
      } catch (error) {
        console.error('Error loading season stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeasonStats();
  }, []);

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
          <button
            onClick={() => router.push('/display')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        </div>
      </div>

      {/* Team Standings */}
      <div className="max-w-5xl mx-auto">
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
      </div>
    </div>
  );
}
