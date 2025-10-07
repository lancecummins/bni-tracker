'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy,
  TrendingUp,
  Users,
  Crown,
  Award,
  ArrowLeft,
  Calendar,
  Target,
  Zap,
  Star
} from 'lucide-react';
import {
  useSeasonTotals,
  useUsers,
  useTeams,
  useActiveSession
} from '@/lib/firebase/hooks';
import { Avatar } from '@/components/Avatar';

export default function SeasonDashboardPage() {
  const router = useRouter();
  const { session: activeSession } = useActiveSession();
  const { users } = useUsers();
  const { teams } = useTeams();
  const { userTotals, teamTotals, loading, weekCount } = useSeasonTotals('season-id');

  const totalWeeks = 12; // This should come from season config
  const progressPercentage = (weekCount / totalWeeks) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  // Get top performers
  const topUsers = userTotals.slice(0, 10);
  const topTeams = teamTotals.slice(0, teams.length);

  // Calculate category leaders
  const categoryLeaders = {
    attendance: { userId: '', total: 0 },
    one21s: { userId: '', total: 0 },
    referrals: { userId: '', total: 0 },
    tyfcb: { userId: '', total: 0 },
    visitors: { userId: '', total: 0 },
  };

  userTotals.forEach(userTotal => {
    Object.keys(categoryLeaders).forEach(category => {
      const catKey = category as keyof typeof categoryLeaders;
      if (userTotal.categoryTotals[catKey] > categoryLeaders[catKey].total) {
        categoryLeaders[catKey] = {
          userId: userTotal.userId,
          total: userTotal.categoryTotals[catKey]
        };
      }
    });
  });

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white overflow-hidden">
      <div className="h-full flex flex-col p-4">
        {/* Compact Header - Fixed Height */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <button
            onClick={() => router.push('/display')}
            className="text-white/70 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="text-yellow-400" size={24} />
            Season Dashboard
          </h1>

          {/* Season Progress Bar - Inline */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">
              Week {weekCount}/{totalWeeks}
            </span>
            <div className="w-32 bg-white/20 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-green-400 to-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Main Content Area - Flex Grow */}
        <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
          {/* Left Column - Team Standings */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users size={20} />
              Team Standings
            </h2>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {topTeams.map((teamTotal, index) => {
                const team = teams.find(t => t.id === teamTotal.teamId);
                if (!team) return null;

                return (
                  <motion.div
                    key={teamTotal.teamId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-3 rounded-lg ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-400'
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`text-lg font-bold ${
                          index === 0 ? 'text-yellow-400' : 'text-white/70'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold" style={{ color: team.color }}>
                            {team.name}
                          </h3>
                          <div className="text-xs text-white/60">
                            {teamTotal.weeklyWins > 0 && (
                              <span className="text-yellow-400">🏆 {teamTotal.weeklyWins} </span>
                            )}
                            <span>Avg: {teamTotal.averagePoints}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{teamTotal.totalPoints}</div>
                        <div className="text-xs text-white/60">total</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Middle Column - Individual Leaders */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Crown size={20} />
              Individual Leaders
            </h2>

            <div className="space-y-1 flex-1 overflow-y-auto">
              {topUsers.map((userTotal, index) => {
                const user = users.find(u => u.id === userTotal.userId);
                if (!user) return null;

                return (
                  <motion.div
                    key={userTotal.userId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      index === 0
                        ? 'bg-gradient-to-r from-green-500/30 to-blue-500/30 border border-green-400'
                        : 'bg-white/5'
                    }`}
                  >
                    <div className={`text-sm font-bold w-6 text-center ${
                      index === 0 ? 'text-green-400' : 'text-white/50'
                    }`}>
                      {index + 1}
                    </div>
                    <Avatar
                      src={user.avatarUrl}
                      fallbackSeed={`${user.firstName}${user.lastName}`}
                      size="sm"
                      className="border border-white/30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-white/60">
                        Avg: {userTotal.averagePoints}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{userTotal.totalPoints}</div>
                      <div className="text-xs text-white/60">total</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          {/* Right Column - Stats & Categories */}
          <div className="flex flex-col gap-4">
            {/* Category Champions */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex-1">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Award size={20} />
                Category Leaders
              </h2>

              <div className="grid grid-cols-2 gap-3">
            {Object.entries(categoryLeaders).map(([category, leader]) => {
              const user = users.find(u => u.id === leader.userId);
              const categoryLabel = category === 'one21s' ? '1-2-1s' :
                                   category === 'tyfcb' ? 'TYFCB' :
                                   category.toUpperCase();

              return (
                <div
                  key={category}
                  className="bg-white/5 rounded-lg p-3 text-center"
                >
                  <div className="text-xs font-medium text-white/70 mb-1">
                    {categoryLabel}
                  </div>
                  {user && leader.total > 0 ? (
                    <>
                      <div className="text-2xl font-bold text-white">
                        {leader.total}
                      </div>
                      <div className="text-xs text-white/80 truncate">
                        {user.firstName} {user.lastName}
                      </div>
                    </>
                  ) : (
                    <div className="text-white/30 text-sm">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

            {/* Season Stats */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Star size={20} />
                Season Stats
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {userTotals.reduce((sum, u) => sum + u.totalPoints, 0)}
                  </div>
                  <div className="text-xs text-white/70">Total Points</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {Math.max(...userTotals.map(u => u.bestWeek), 0)}
                  </div>
                  <div className="text-xs text-white/70">Best Individual</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {Math.max(...teamTotals.map(t => t.bestWeek), 0)}
                  </div>
                  <div className="text-xs text-white/70">Best Team</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">
                    {weekCount}/{totalWeeks}
                  </div>
                  <div className="text-xs text-white/70">Weeks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}