'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Users as UsersIcon, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { useUsers, useTeams } from '@/lib/firebase/hooks';
import { useDraftBySeasonId } from '@/lib/firebase/hooks/useDraft';
import { draftService } from '@/lib/firebase/services/draftService';
import { scoreService } from '@/lib/firebase/services';
import { LeaderboardEntry, User, Score, Team } from '@/lib/types';
import toast from 'react-hot-toast';

interface DraftPageProps {
  params: Promise<{
    seasonId: string;
    teamLeaderId: string;
  }>;
}

export default function DraftPage({ params }: DraftPageProps) {
  const resolvedParams = use(params);
  const { seasonId, teamLeaderId } = resolvedParams;
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { users, loading: usersLoading } = useUsers();
  const { teams } = useTeams();
  const { draft, loading: draftLoading, currentTurn } = useDraftBySeasonId(seasonId);
  const [previousSeasonStats, setPreviousSeasonStats] = useState<Map<string, LeaderboardEntry>>(new Map());
  const [picking, setPicking] = useState(false);
  const [sortBy, setSortBy] = useState<'team' | 'points' | 'attendance' | 'one21s' | 'referrals' | 'tyfcb' | 'visitors'>('points');
  const [showPickModal, setShowPickModal] = useState(false);
  const [userToPick, setUserToPick] = useState<User | null>(null);
  const [showUndraftedOnly, setShowUndraftedOnly] = useState(false);

  // Get current team leader
  const teamLeader = users.find(u => u.id === teamLeaderId);
  const currentTeamLeaderInfo = draft?.teamLeaders.find(tl => tl.userId === teamLeaderId);
  const currentTeam = teams.find(t => t.id === currentTeamLeaderInfo?.teamId);

  // Check if it's this team leader's turn
  const isMyTurn = currentTurn?.userId === teamLeaderId;

  // Check if current user is admin (for admin-only features)
  const currentUserData = currentUser?.email ? users.find(u => u.email === currentUser.email) : null;
  const isAdmin = currentUserData?.role === 'admin';

  // No authentication required - security through obscure URL
  const canAccessPage = true;

  // Get available users (not picked yet, not admin, not team leader)
  const availableUserIds = draft ? users
    .filter(u =>
      u.isActive &&
      u.role !== 'admin' &&
      u.role !== 'team-leader' &&
      !draft.picks.some(p => p.userId === u.id)
    )
    .map(u => u.id!)
    : [];

  // Load previous season stats
  useEffect(() => {
    const loadPreviousSeasonStats = async () => {
      if (!seasonId) return;

      try {
        // Get all seasons and find previous one
        const { seasonService } = await import('@/lib/firebase/services/seasonService');
        const allSeasons = await seasonService.getAll();
        const sortedSeasons = allSeasons.sort((a, b) =>
          b.createdAt.toMillis() - a.createdAt.toMillis()
        );

        console.log('All seasons:', sortedSeasons.map(s => ({ id: s.id, name: s.name })));
        console.log('Current season ID:', seasonId);

        const currentSeasonIndex = sortedSeasons.findIndex(s => s.id === seasonId);
        console.log('Current season index:', currentSeasonIndex);

        const previousSeason = currentSeasonIndex >= 0 && currentSeasonIndex < sortedSeasons.length - 1
          ? sortedSeasons[currentSeasonIndex + 1]
          : null;

        if (!previousSeason) {
          console.log('No previous season found');
          return;
        }

        console.log('Previous season:', { id: previousSeason.id, name: previousSeason.name });

        // Get all scores from previous season
        const { sessionService } = await import('@/lib/firebase/services/sessionService');
        const previousSeasonSessions = await sessionService.getBySeason(previousSeason.id!);

        // Use closed sessions if available, otherwise use all sessions
        let sessionsToUse = previousSeasonSessions.filter(s => s.status === 'closed' && !s.isArchived);

        if (sessionsToUse.length === 0) {
          // No closed sessions, use all non-archived sessions
          sessionsToUse = previousSeasonSessions.filter(s => !s.isArchived);
        }

        if (sessionsToUse.length === 0) {
          console.log('No sessions found in previous season');
          return;
        }

        console.log(`Loading stats from ${sessionsToUse.length} sessions in previous season`);

        // Fetch all scores
        const allScoresPromises = sessionsToUse.map(s => scoreService.getBySession(s.id!));
        const allScoresArrays = await Promise.all(allScoresPromises);
        const allScores = allScoresArrays.flat();

        // Calculate stats per user
        const userStatsMap = new Map<string, LeaderboardEntry>();

        // Group scores by user
        const userScoresMap = new Map<string, Score[]>();
        allScores.forEach(score => {
          if (!userScoresMap.has(score.userId)) {
            userScoresMap.set(score.userId, []);
          }
          userScoresMap.get(score.userId)!.push(score);
        });

        // Calculate averages
        users.forEach(user => {
          if (!user.id) return;

          const userScores = userScoresMap.get(user.id) || [];
          const numSessions = sessionsToUse.length;

          // Calculate totals
          const totalPoints = userScores.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
          const totalAttendance = userScores.reduce((sum, s) => sum + (s.metrics?.attendance || 0), 0);
          const totalOne21s = userScores.reduce((sum, s) => sum + (s.metrics?.one21s || 0), 0);
          const totalReferrals = userScores.reduce((sum, s) => sum + (s.metrics?.referrals || 0), 0);
          const totalTyfcb = userScores.reduce((sum, s) => sum + (s.metrics?.tyfcb || 0), 0);
          const totalVisitors = userScores.reduce((sum, s) => sum + (s.metrics?.visitors || 0), 0);

          // Calculate averages
          const avgPoints = Math.round((totalPoints / numSessions) * 10) / 10;
          const avgMetrics = {
            attendance: Math.round((totalAttendance / numSessions) * 10) / 10,
            one21s: Math.round((totalOne21s / numSessions) * 10) / 10,
            referrals: Math.round((totalReferrals / numSessions) * 10) / 10,
            tyfcb: Math.round((totalTyfcb / numSessions) * 10) / 10,
            visitors: Math.round((totalVisitors / numSessions) * 10) / 10,
            ceu: 0, // CEU was added later, so default to 0 for historical data
          };

          const previousTeam = teams.find(t => userScores[0]?.teamId === t.id);

          userStatsMap.set(user.id, {
            userId: user.id,
            user,
            teamId: previousTeam?.id,
            team: previousTeam,
            weeklyPoints: avgPoints,
            totalPoints: totalPoints,
            metrics: avgMetrics,
            position: 0,
          });
        });

        setPreviousSeasonStats(userStatsMap);
      } catch (error) {
        console.error('Error loading previous season stats:', error);
      }
    };

    loadPreviousSeasonStats();
  }, [seasonId, users, teams]);

  const handlePickClick = (userId: string) => {
    if (!draft?.id || !currentTeamLeaderInfo) {
      toast.error('Draft not found');
      return;
    }

    if (!isMyTurn && !isAdmin) {
      toast.error('It\'s not your turn to pick!');
      return;
    }

    const user = users.find(u => u.id === userId);
    if (!user) {
      toast.error('User not found');
      return;
    }

    setUserToPick(user);
    setShowPickModal(true);
  };

  const handleConfirmPick = async () => {
    if (!draft?.id || !currentTeamLeaderInfo || !userToPick) {
      return;
    }

    try {
      setPicking(true);
      setShowPickModal(false);
      await draftService.makePick(
        draft.id,
        userToPick.id!,
        currentTeamLeaderInfo.teamId,
        currentUser?.uid || teamLeaderId
      );
      toast.success(`${userToPick.firstName} ${userToPick.lastName} picked!`);
    } catch (error) {
      console.error('Error making pick:', error);
      toast.error('Failed to make pick');
    } finally {
      setPicking(false);
      setUserToPick(null);
    }
  };

  if (draftLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Access Control: Block unauthorized users
  if (!canAccessPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white/10 rounded-lg backdrop-blur-lg">
          <h1 className="text-2xl font-bold mb-2 text-red-400">Access Denied</h1>
          <p className="text-white/70 mb-4">
            You don't have permission to view this draft page. This page is only accessible to the team leader it belongs to or administrators.
          </p>
          <button
            onClick={() => router.push('/admin/draft-setup')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go to Draft Setup
          </button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No Active Draft</h1>
          <p className="text-white/70">The draft hasn't started yet or has been completed.</p>
        </div>
      </div>
    );
  }

  // Create leaderboard from available users + picked users
  const leaderboard: LeaderboardEntry[] = [];

  // Add all active users to leaderboard except admins
  users.forEach(user => {
    if (!user.id || user.role === 'admin' || !user.isActive) return;

    const stats = previousSeasonStats.get(user.id);
    const isPicked = draft.picks.some(p => p.userId === user.id);
    const pick = draft.picks.find(p => p.userId === user.id);
    const pickedTeam = pick ? teams.find(t => t.id === pick.teamId) : undefined;

    leaderboard.push({
      userId: user.id,
      user,
      teamId: pickedTeam?.id,
      team: pickedTeam,
      weeklyPoints: stats?.weeklyPoints || 0,
      totalPoints: stats?.totalPoints || 0,
      metrics: stats?.metrics || {
        attendance: 0,
        one21s: 0,
        referrals: 0,
        tyfcb: 0,
        visitors: 0,
        ceu: 0,
      },
      position: 0,
    });
  });

  // Filter by undrafted if needed
  const filteredLeaderboard = showUndraftedOnly
    ? leaderboard.filter(entry => {
        const isPicked = draft?.picks.some(p => p.userId === entry.userId);
        const isTeamLeader = users.find(u => u.id === entry.userId)?.role === 'team-leader';
        return !isPicked && !isTeamLeader;
      })
    : leaderboard;

  // Sort by selected metric
  filteredLeaderboard.sort((a, b) => {
    switch (sortBy) {
      case 'team':
        // Sort by team name, unpicked users at the end
        if (!a.team && !b.team) return 0;
        if (!a.team) return 1;
        if (!b.team) return -1;
        return a.team.name.localeCompare(b.team.name);
      case 'points':
        return b.weeklyPoints - a.weeklyPoints;
      case 'attendance':
        return b.metrics.attendance - a.metrics.attendance;
      case 'one21s':
        return b.metrics.one21s - a.metrics.one21s;
      case 'referrals':
        return b.metrics.referrals - a.metrics.referrals;
      case 'tyfcb':
        return b.metrics.tyfcb - a.metrics.tyfcb;
      case 'visitors':
        return b.metrics.visitors - a.metrics.visitors;
      default:
        return b.weeklyPoints - a.weeklyPoints;
    }
  });


  // Group picks by team
  const teamRosters = teams.map(team => {
    const teamLeaderInfo = draft?.teamLeaders.find(tl => tl.teamId === team.id);
    const teamLeaderUser = teamLeaderInfo ? users.find(u => u.id === teamLeaderInfo.userId) : null;
    const teamPicks = draft?.picks.filter(pick => pick.teamId === team.id) || [];
    const pickedUsers = teamPicks.map(pick => users.find(u => u.id === pick.userId)).filter(Boolean) as User[];

    return {
      team,
      teamLeader: teamLeaderUser,
      members: pickedUsers,
    };
  });

  // Sort rosters to put current team's roster at the top
  const sortedTeamRosters = [...teamRosters].sort((a, b) => {
    const aIsCurrentTeam = a.team.id === currentTeam?.id;
    const bIsCurrentTeam = b.team.id === currentTeam?.id;
    if (aIsCurrentTeam) return -1;
    if (bIsCurrentTeam) return 1;
    return 0;
  });

  // Check if draft is complete (all available users have been picked)
  const isDraftComplete = draft && availableUserIds.length === 0 && draft.status === 'in_progress';

  // Draft Complete Screen
  if (isDraftComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white p-8">
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-7xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500">
            LET'S GET READY TO RUMBLE!
          </h1>
          <p className="text-2xl text-white/80">The draft is complete! Here are your teams:</p>
        </motion.div>

        {/* Teams Grid */}
        <div className="grid grid-cols-4 gap-4">
          {teamRosters.map(({ team, teamLeader, members }, idx) => (
            <motion.div
              key={team.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.2, duration: 0.5 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border-4"
              style={{ borderColor: team.color }}
            >
              {/* Team Header */}
              <div className="text-center mb-6">
                {team.logoUrl && (
                  <img
                    src={team.logoUrl}
                    alt={`${team.name} logo`}
                    className="w-24 h-24 object-cover mx-auto mb-4"
                  />
                )}
                <h2 className="text-3xl font-bold mb-2" style={{ color: team.color }}>
                  {team.name}
                </h2>
                <p className="text-lg text-white/60">
                  {1 + members.length} {1 + members.length === 1 ? 'member' : 'members'}
                </p>
              </div>

              {/* Team Members */}
              <div className="space-y-3">
                {/* Team Leader */}
                {teamLeader && (
                  <div className="flex items-center gap-3 p-3 bg-yellow-500/20 rounded-lg border-2 border-yellow-500/50">
                    <img
                      src={teamLeader.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${teamLeader.firstName}${teamLeader.lastName}`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">
                        {teamLeader.firstName} {teamLeader.lastName}
                      </p>
                      <p className="text-xs text-yellow-400">Team Leader</p>
                    </div>
                  </div>
                )}

                {/* Picked Members */}
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    <img
                      src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}${member.lastName}`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <p className="font-semibold text-white truncate flex-1 min-w-0">
                      {member.firstName} {member.lastName}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Admin Button */}
        {isAdmin && (
          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/admin/draft-setup')}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-xl transition-colors"
            >
              Finalize Draft
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <div className="flex gap-4 p-4 pb-8">
        {/* Main Draft Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
          {isAdmin ? (
            <button
              onClick={() => router.push('/admin/draft-setup')}
              className="text-white/70 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              <ArrowLeft size={16} />
              <span>Back to Draft Setup</span>
            </button>
          ) : (
            <div className="w-32"></div>
          )}

          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={24} />
            <h1 className="text-2xl font-bold">
              {currentTeam?.name} - Team Draft
            </h1>
          </div>

          <div className="text-right">
            <div className="text-sm text-white/70">Round {Math.floor(draft.currentPickNumber / 4) + 1}</div>
            <div className="text-sm text-white/70">Pick {(draft.currentPickNumber % 4) + 1} of 4</div>
          </div>
        </div>

        {/* Current Turn Banner */}
        <div className={`mb-4 p-4 rounded-lg ${
          isMyTurn ? 'bg-green-500/20 border-2 border-green-500' : 'bg-white/10'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              {isMyTurn ? (
                <p className="text-lg font-bold text-green-300">🎯 {teamLeader?.firstName}, it's your turn to pick!</p>
              ) : currentTurn ? (
                <p className="text-lg font-bold text-white/90">
                  The <strong>{teams.find(t => t.id === currentTurn.teamId)?.name}</strong> are on the clock.
                </p>
              ) : (
                <p className="text-white/90">Draft completed!</p>
              )}
            </div>
            {isAdmin && (
              <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">ADMIN MODE</span>
            )}
          </div>
        </div>

        {/* Sort and Filter Controls */}
        <div className="mb-4 flex justify-end items-center gap-3">
          <button
            onClick={() => setShowUndraftedOnly(!showUndraftedOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              showUndraftedOnly
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={showUndraftedOnly}
              onChange={() => {}}
              className="w-4 h-4"
            />
            Show Undrafted Only
          </button>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2">
            <label className="text-sm text-white/70">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-white/20 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="team" className="bg-gray-900">Team</option>
              <option value="points" className="bg-gray-900">Points</option>
              <option value="attendance" className="bg-gray-900">Attendance</option>
              <option value="one21s" className="bg-gray-900">1-2-1s</option>
              <option value="referrals" className="bg-gray-900">Referrals</option>
              <option value="tyfcb" className="bg-gray-900">TYFCB</option>
              <option value="visitors" className="bg-gray-900">Visitors</option>
            </select>
          </div>
        </div>

        {/* User Cards */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
          <div className="space-y-2">
            {filteredLeaderboard.map((leader, index) => {
              const isPicked = draft.picks.some(p => p.userId === leader.userId);
              const isTeamLeader = users.find(u => u.id === leader.userId)?.role === 'team-leader';
              const isAvailable = availableUserIds.includes(leader.userId);
              const canPick = (isMyTurn || isAdmin) && isAvailable && !picking;

              // Get team for this user (either picked team or their assigned team if team leader)
              const userTeam = leader.team || (isTeamLeader ? teams.find(t => t.id === leader.user.teamId) : null);

              return (
                <motion.div
                  key={leader.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.02 * index }}
                  className={`relative grid grid-cols-[auto_300px_1fr_auto] items-center gap-6 p-6 rounded-xl overflow-hidden border-2 ${
                    (isPicked || isTeamLeader) ? 'border-white/30' : 'border-white/10'
                  } hover:border-white/20 transition-colors`}
                  style={{
                    backgroundColor: userTeam
                      ? userTeam.color
                      : 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {/* Pick Button or Team Logo */}
                  <div className="w-32 pr-6">
                    {isPicked && leader.team ? (
                      leader.team.logoUrl ? (
                        <img
                          src={leader.team.logoUrl}
                          alt={`${leader.team.name} logo`}
                          className="w-20 h-20 object-cover"
                        />
                      ) : (
                        <div
                          className="w-20 h-20 flex items-center justify-center text-white font-bold text-2xl"
                          style={{ backgroundColor: leader.team.color }}
                        >
                          {leader.team.name.charAt(0)}
                        </div>
                      )
                    ) : isTeamLeader ? (
                      (() => {
                        const leaderTeam = teams.find(t => t.id === leader.user.teamId);
                        return leaderTeam ? (
                          leaderTeam.logoUrl ? (
                            <img
                              src={leaderTeam.logoUrl}
                              alt={`${leaderTeam.name} logo`}
                              className="w-20 h-20 object-cover"
                            />
                          ) : (
                            <div
                              className="w-20 h-20 flex items-center justify-center text-white font-bold text-2xl"
                              style={{ backgroundColor: leaderTeam.color }}
                            >
                              {leaderTeam.name.charAt(0)}
                            </div>
                          )
                        ) : (
                          <div className="w-20"></div>
                        );
                      })()
                    ) : canPick ? (
                      <button
                        onClick={() => handlePickClick(leader.userId)}
                        disabled={picking}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        Pick {leader.user.firstName}
                      </button>
                    ) : (
                      <div className="w-20"></div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <img
                        src={leader.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${leader.user.firstName}${leader.user.lastName}`}
                        alt=""
                        className="w-20 h-20 rounded-full border-4 object-cover border-white/30"
                      />
                    </div>
                    <div className="min-w-0 flex-shrink">
                      <div className="text-2xl font-semibold flex items-center gap-3">
                        {leader.user.firstName} {leader.user.lastName}
                      </div>
                      {isPicked && leader.team && (
                        <div className="text-sm text-white/60 mt-1">
                          Picked by {leader.team.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics - Compact Grid */}
                  <div className="grid grid-cols-5 gap-6 text-base justify-self-center">
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">Attendance</div>
                      <div className="font-semibold text-3xl">
                        {leader.metrics.attendance}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">1-2-1s</div>
                      <div className="font-semibold text-3xl">
                        {leader.metrics.one21s}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">Referrals</div>
                      <div className="font-semibold text-3xl">
                        {leader.metrics.referrals}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">TYFCB</div>
                      <div className="font-semibold text-3xl">
                        {leader.metrics.tyfcb}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">Visitors</div>
                      <div className="font-semibold text-3xl">
                        {leader.metrics.visitors}
                      </div>
                    </div>
                  </div>

                  {/* Average Points */}
                  <div className="text-right">
                    <div className="text-5xl font-bold text-white">
                      {leader.weeklyPoints}
                    </div>
                    <div className="text-base text-white/50">
                      avg pts
                    </div>
                    <div className="text-sm text-white/40 mt-1">
                      total: {leader.totalPoints}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredLeaderboard.length === 0 && (
              <div className="text-center text-gray-400 text-2xl mt-20">
                {showUndraftedOnly ? 'No undrafted users available' : 'No data available'}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Team Rosters Sidebar */}
        <div className="w-80 flex flex-col gap-3">
          <h2 className="text-xl font-bold text-white mb-2">Team Rosters</h2>
          {sortedTeamRosters.map(({ team, teamLeader, members }) => (
            <div
              key={team.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border-2"
              style={{ borderColor: team.color }}
            >
              {/* Team Header */}
              <div className="flex items-center gap-3 mb-3">
                {team.logoUrl && (
                  <img
                    src={team.logoUrl}
                    alt={`${team.name} logo`}
                    className="w-12 h-12 object-cover"
                  />
                )}
                <div>
                  <h3 className="font-bold text-lg" style={{ color: team.color }}>
                    {team.name}
                  </h3>
                  <p className="text-xs text-white/60">
                    {1 + members.length} {1 + members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-2">
                {/* Team Leader */}
                {teamLeader && (
                  <div className="flex items-center gap-2 p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                    <img
                      src={teamLeader.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${teamLeader.firstName}${teamLeader.lastName}`}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {teamLeader.firstName} {teamLeader.lastName}
                      </p>
                      <p className="text-xs text-yellow-400">Team Leader</p>
                    </div>
                  </div>
                )}

                {/* Picked Members */}
                {members.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 p-2 bg-white/5 rounded-lg"
                  >
                    <img
                      src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}${member.lastName}`}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-white/60">Pick #{idx + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pick Confirmation Modal */}
        {showPickModal && userToPick && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-md w-full border-4 border-yellow-400 shadow-2xl"
            >
              <div className="text-center">
                <div className="mb-6">
                  <img
                    src={userToPick.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${userToPick.firstName}${userToPick.lastName}`}
                    alt=""
                    className="w-32 h-32 rounded-full border-4 border-yellow-400 object-cover mx-auto mb-4"
                  />
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {userToPick.firstName} {userToPick.lastName}
                  </h2>
                  <p className="text-xl text-white/80">
                    Pick for <span className="font-bold text-yellow-400">{currentTeam?.name}</span>?
                  </p>
                </div>

                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <div className="text-white/60">Avg Points</div>
                      <div className="text-2xl font-bold text-yellow-400">
                        {previousSeasonStats.get(userToPick.id!)?.weeklyPoints || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60">Total Points</div>
                      <div className="text-2xl font-bold text-white">
                        {previousSeasonStats.get(userToPick.id!)?.totalPoints || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60">Attendance</div>
                      <div className="text-2xl font-bold text-white">
                        {previousSeasonStats.get(userToPick.id!)?.metrics.attendance || 0}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-white/60 text-xs">1-2-1s</div>
                      <div className="text-xl font-bold text-white">
                        {previousSeasonStats.get(userToPick.id!)?.metrics.one21s || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs">Referrals</div>
                      <div className="text-xl font-bold text-white">
                        {previousSeasonStats.get(userToPick.id!)?.metrics.referrals || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs">TYFCB</div>
                      <div className="text-xl font-bold text-white">
                        {previousSeasonStats.get(userToPick.id!)?.metrics.tyfcb || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs">Visitors</div>
                      <div className="text-xl font-bold text-white">
                        {previousSeasonStats.get(userToPick.id!)?.metrics.visitors || 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowPickModal(false);
                      setUserToPick(null);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors text-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPick}
                    disabled={picking}
                    className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 text-lg"
                  >
                    {picking ? 'Picking...' : 'Confirm Pick!'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
