'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy,
  Crown,
  Star,
  ArrowLeft,
  TrendingUp,
  Award,
  Users
} from 'lucide-react';
import {
  useStaticActiveSession,
  useStaticTeams
} from '@/lib/firebase/hooks/useStaticData';
import { useStaticLeaderboard, useStaticTeamStandings } from '@/lib/firebase/hooks/useStaticCompositeData';
import { Team } from '@/lib/types';

export default function TeamDisplayPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const { session: activeSession } = useStaticActiveSession();
  const { teams } = useStaticTeams();
  const { leaderboard } = useStaticLeaderboard(activeSession?.id || null, false); // Use false to match main display
  const { standings } = useStaticTeamStandings(activeSession?.id || null, false); // Use false to match main display

  const [team, setTeam] = useState<Team | null>(null);

  // Find the team
  useEffect(() => {
    const foundTeam = teams.find(t => t.id === teamId);
    setTeam(foundTeam || null);
  }, [teams, teamId]);

  // Get team members from leaderboard
  const teamMembers = leaderboard.filter(entry => entry.teamId === teamId);

  // Sort team members by points (highest first)
  const sortedMembers = [...teamMembers].sort((a, b) => b.weeklyPoints - a.weeklyPoints);

  // Get team standings to find bonus points
  const teamStanding = standings.find(s => s.teamId === teamId);
  const bonusPoints = teamStanding?.bonusPoints || 0;

  // Calculate team total (includes bonus)
  const individualTotal = sortedMembers.reduce((sum, member) => sum + member.weeklyPoints, 0);
  const teamTotal = individualTotal + bonusPoints;

  // Find MVP (member with most points)
  const mvp = sortedMembers[0];

  // Check which categories earned the "All In" bonus
  const checkAllInCategories = () => {
    const categories = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;
    const allInCategories: string[] = [];

    categories.forEach(category => {
      if (teamMembers.length > 0 && teamMembers.every(member => member.metrics[category] >= 1)) {
        allInCategories.push(category);
      }
    });

    return allInCategories;
  };

  const allInCategories = checkAllInCategories();

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading team data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white overflow-hidden">
      <div className="h-full flex flex-col p-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <button
            onClick={() => router.push('/display')}
            className="text-white/70 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-4">
            <h1
              className="text-2xl font-bold"
              style={{ color: team.color }}
            >
              {team.name}
            </h1>
            <span className="text-sm text-white/60">
              {teamMembers.length} Members • Week {activeSession?.weekNumber || 0}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Trophy size={20} style={{ color: team.color }} />
            <div className="text-right">
              <div className="text-2xl font-bold">{teamTotal}</div>
              <div className="text-xs text-white/60">
                Total Points
                {bonusPoints > 0 && (
                  <span className="text-green-400 ml-1">+{bonusPoints} bonus</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Left Side - Stats and Info */}
          <div className="w-80 flex flex-col gap-3">
            {/* Team Stats */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3">
              <h3 className="text-sm font-semibold mb-2 text-white/80">Team Stats</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold">{Math.round(teamTotal / Math.max(teamMembers.length, 1))}</div>
                  <div className="text-xs text-white/60">Avg/Member</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold">{team.weeklyWins || 0}</div>
                  <div className="text-xs text-white/60">Wins</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold">#{teams.findIndex(t => t.id === teamId) + 1}</div>
                  <div className="text-xs text-white/60">Rank</div>
                </div>
              </div>
            </div>

            {/* All In Bonuses */}
            {allInCategories.length > 0 && (
              <div className="bg-green-500/20 rounded-xl p-3 border border-green-400/50">
                <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1">
                  <Trophy size={16} />
                  All In Bonuses
                </h3>
                <div className="flex flex-wrap gap-1">
                  {allInCategories.map(category => (
                    <span
                      key={category}
                      className="px-2 py-0.5 bg-green-400/30 text-green-300 rounded-full text-xs font-medium"
                    >
                      {category === 'one21s' ? '1-2-1s' : category === 'tyfcb' ? 'TYFCB' : category.toUpperCase()} ✓
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* MVP Card */}
            {mvp && (
              <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 rounded-xl p-3 border border-yellow-400">
                <h3 className="text-sm font-semibold text-yellow-300 mb-2 flex items-center gap-1">
                  <Crown size={16} />
                  Team MVP
                </h3>
                <div className="flex items-center gap-3">
                  <img
                    src={mvp.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${mvp.user.firstName}${mvp.user.lastName}`}
                    alt=""
                    className="w-12 h-12 rounded-full border-2 border-yellow-400"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-white">
                      {mvp.user.firstName} {mvp.user.lastName}
                    </div>
                    <div className="text-xs text-white/80">Leading scorer</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-400">{mvp.weeklyPoints}</div>
                    <div className="text-xs text-white/60">points</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Team Roster */}
          <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users size={20} />
              Team Roster
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2">
            {sortedMembers.map((member, index) => {
              const isMVP = index === 0;

              return (
                <motion.div
                  key={member.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={`
                    flex items-center justify-between p-2 rounded-lg
                    ${isMVP
                      ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/50'
                      : 'bg-white/5 hover:bg-white/10 transition-colors'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      text-lg font-bold w-8 text-center
                      ${isMVP ? 'text-yellow-400' : 'text-white/50'}
                    `}>
                      {index + 1}
                    </div>
                    <div className="relative">
                      <img
                        src={member.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user.firstName}${member.user.lastName}`}
                        alt=""
                        className={`w-10 h-10 rounded-full border ${
                          isMVP ? 'border-yellow-400' : 'border-white/30'
                        }`}
                      />
                      {isMVP && (
                        <Crown className="absolute -top-1 -right-1 text-yellow-400" size={14} />
                      )}
                    </div>
                    <div className="min-w-0 flex-shrink">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        {member.user.firstName} {member.user.lastName}
                        {isMVP && (
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-400 text-black rounded-full font-bold">
                            MVP
                          </span>
                        )}
                      </div>
                      <div className="text-white/60 text-xs truncate">
                        {member.user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Metrics - Compact Grid */}
                    <div className="grid grid-cols-6 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-white/40 text-xs">ATT</div>
                        <div className="font-semibold text-sm">{member.metrics.attendance}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/40 text-xs">121</div>
                        <div className="font-semibold text-sm">{member.metrics.one21s}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/40 text-xs">REF</div>
                        <div className="font-semibold text-sm">{member.metrics.referrals}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/40 text-xs">TYF</div>
                        <div className="font-semibold text-sm">{member.metrics.tyfcb}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/40 text-xs">VIS</div>
                        <div className="font-semibold text-sm">{member.metrics.visitors}</div>
                      </div>
                    </div>

                    {/* Total Points */}
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        isMVP ? 'text-yellow-400' : 'text-white'
                      }`}>
                        {member.weeklyPoints}
                      </div>
                      <div className="text-xs text-white/50">points</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {sortedMembers.length === 0 && (
              <div className="text-center py-8 text-white/50">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No scores recorded yet for this week</p>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}