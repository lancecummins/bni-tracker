'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, Crown, TrendingUp, ChevronDown } from 'lucide-react';
import { useStaticActiveSession, useStaticSeasonSessions, useStaticSession, useStaticUsers, useStaticTeams } from '@/lib/firebase/hooks/useStaticData';
import { useStaticLeaderboard } from '@/lib/firebase/hooks/useStaticCompositeData';
import { scoreService } from '@/lib/firebase/services';
import { shownUsersStore } from '@/lib/utils/revealedUsersStore';
import { LeaderboardEntry } from '@/lib/types';

type ViewMode = 'session' | 'average' | 'rising';
type MetricType = 'points' | 'attendance' | 'one21s' | 'referrals' | 'tyfcb' | 'visitors';

export default function DisplayChartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('session');
  const [averageLeaderboard, setAverageLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [risingStarsLeaderboard, setRisingStarsLeaderboard] = useState<(LeaderboardEntry & {
    improvement: number;
    average: number;
    averageMetrics: {
      attendance: number;
      one21s: number;
      referrals: number;
      tyfcb: number;
      visitors: number;
    }
  })[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('points');
  const [showMetricDropdown, setShowMetricDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { session: activeSession } = useStaticActiveSession();
  const sessionId = sessionIdParam || activeSession?.id || null;
  const { sessions: allSeasonSessions } = useStaticSeasonSessions(activeSession?.seasonId || null);
  const { session: selectedSession } = useStaticSession(sessionId);

  // Use the selected session if available, otherwise fall back to active session
  const displaySession = selectedSession || activeSession;

  // Get ALL users including those without teams (like admin)
  const { leaderboard: rawLeaderboard } = useStaticLeaderboard(sessionId, false, refreshKey);
  const { users } = useStaticUsers();
  const { teams } = useStaticTeams();

  // Load all users with scores into the revealed store so they show up in the leaderboard
  useEffect(() => {
    const loadShownUsers = async () => {
      if (sessionId) {
        console.log('[Chart] Loading scores for sessionId:', sessionId);
        const scores = await scoreService.getBySession(sessionId);
        console.log('[Chart] Total scores found:', scores.length);
        console.log('[Chart] All scores:', scores.map(s => ({
          userId: s.userId,
          sessionId: s.sessionId,
          teamId: s.teamId,
          totalPoints: s.totalPoints
        })));
        const userIds = scores.map(s => s.userId);
        console.log('[Chart] Loading revealed users:', userIds);
        shownUsersStore.setShownUsers(userIds);
        // Force refresh after setting shown users
        setRefreshKey(prev => prev + 1);
      }
    };
    loadShownUsers();
  }, [sessionId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMetricDropdown(false);
      }
    };

    if (showMetricDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMetricDropdown]);

  // Calculate average leaderboard when switching to average view
  useEffect(() => {
    const calculateAverages = async () => {
      if (viewMode !== 'average' || !activeSession?.seasonId) return;

      // Get all closed sessions from this season (excluding archived sessions)
      const closedSessions = allSeasonSessions.filter(s => s.status === 'closed' && !s.isArchived);

      if (closedSessions.length === 0) {
        setAverageLeaderboard([]);
        return;
      }

      const numClosedSessions = closedSessions.length;
      console.log('[Averages] Number of closed sessions:', numClosedSessions);
      console.log('[Averages] Closed sessions:', closedSessions.map(s => s.name));

      // Fetch all scores from all closed sessions
      const allScoresPromises = closedSessions.map(s => scoreService.getBySession(s.id!));
      const allScoresArrays = await Promise.all(allScoresPromises);
      const allScores = allScoresArrays.flat();

      // Group scores by user
      const userScoresMap = new Map<string, {
        scores: number[],
        attendance: number[],
        one21s: number[],
        referrals: number[],
        tyfcb: number[],
        visitors: number[]
      }>();

      allScores.forEach(score => {
        // Skip scores without valid metrics
        if (!score.metrics || score.totalPoints === undefined || score.totalPoints === null) {
          return;
        }

        if (!userScoresMap.has(score.userId)) {
          userScoresMap.set(score.userId, {
            scores: [],
            attendance: [],
            one21s: [],
            referrals: [],
            tyfcb: [],
            visitors: []
          });
        }
        const userData = userScoresMap.get(score.userId)!;
        userData.scores.push(score.totalPoints || 0);
        userData.attendance.push(score.metrics.attendance || 0);
        userData.one21s.push(score.metrics.one21s || 0);
        userData.referrals.push(score.metrics.referrals || 0);
        userData.tyfcb.push(score.metrics.tyfcb || 0);
        userData.visitors.push(score.metrics.visitors || 0);
      });

      // Calculate averages for ALL active users (including those who didn't attend all sessions)
      const avgEntries: LeaderboardEntry[] = [];

      // Get all active users (members, team-leaders, admins)
      const allActiveUsers = users.filter(u =>
        u.isActive &&
        u.id &&
        (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin')
      );

      allActiveUsers.forEach((user) => {
        const userData = userScoresMap.get(user.id!);
        const team = teams.find(t => t.id === user.teamId);

        // Calculate user's average only from sessions after they joined
        const userCreatedAt = user.createdAt?.toMillis?.() || 0;

        // Filter closed sessions to only include those after user joined
        const validClosedSessions = closedSessions.filter(s => {
          const sessionDate = s.date?.toMillis?.() || 0;
          return sessionDate >= userCreatedAt;
        });

        const numValidSessions = validClosedSessions.length;

        // Helper function to safely calculate average across valid sessions only
        const safeAvg = (arr: number[] = []) => {
          if (numValidSessions === 0) return 0;

          // Add zeros for missing sessions (after they joined)
          const totalValues = userData && arr && arr.length > 0 ? [...arr] : [];
          const missingSessions = numValidSessions - totalValues.length;
          for (let i = 0; i < missingSessions; i++) {
            totalValues.push(0);
          }

          const sum = totalValues.reduce((s, v) => s + (isNaN(v) ? 0 : v), 0);
          const avg = sum / numValidSessions;
          return isNaN(avg) ? 0 : Math.round(avg * 10) / 10;
        };

        const avgPoints = safeAvg(userData?.scores);

        if (user.firstName === 'Lance') {
          console.log('[Averages] Lance data:', {
            hasUserData: !!userData,
            scoresArray: userData?.scores,
            numValidSessions,
            avgPoints
          });
        }

        const avgMetrics = {
          attendance: safeAvg(userData?.attendance),
          one21s: safeAvg(userData?.one21s),
          referrals: safeAvg(userData?.referrals),
          tyfcb: safeAvg(userData?.tyfcb),
          visitors: safeAvg(userData?.visitors)
        };

        avgEntries.push({
          userId: user.id!,
          user,
          teamId: user.teamId,
          team: team || undefined,
          weeklyPoints: avgPoints,
          totalPoints: avgPoints,
          metrics: avgMetrics,
          position: 0
        });
      });

      // Sort by average points
      avgEntries.sort((a, b) => b.weeklyPoints - a.weeklyPoints);

      setAverageLeaderboard(avgEntries);
    };

    calculateAverages();
  }, [viewMode, allSeasonSessions, activeSession, users, teams]);

  // Calculate rising stars when switching to rising view
  useEffect(() => {
    const calculateRisingStars = async () => {
      if (viewMode !== 'rising' || !activeSession?.seasonId || !sessionId) return;

      // Get all closed sessions from this season (excluding archived sessions)
      const closedSessions = allSeasonSessions.filter(s => s.status === 'closed' && !s.isArchived);

      if (closedSessions.length === 0) {
        setRisingStarsLeaderboard([]);
        return;
      }

      // Fetch all scores from all closed sessions
      const allScoresPromises = closedSessions.map(s => scoreService.getBySession(s.id!));
      const allScoresArrays = await Promise.all(allScoresPromises);
      const allScores = allScoresArrays.flat();

      // Group scores by user
      const userScoresMap = new Map<string, {
        scores: number[],
        attendance: number[],
        one21s: number[],
        referrals: number[],
        tyfcb: number[],
        visitors: number[]
      }>();

      allScores.forEach(score => {
        // Skip scores without valid metrics
        if (!score.metrics || score.totalPoints === undefined || score.totalPoints === null) {
          return;
        }

        if (!userScoresMap.has(score.userId)) {
          userScoresMap.set(score.userId, {
            scores: [],
            attendance: [],
            one21s: [],
            referrals: [],
            tyfcb: [],
            visitors: []
          });
        }
        const userData = userScoresMap.get(score.userId)!;
        userData.scores.push(score.totalPoints || 0);
        userData.attendance.push(score.metrics.attendance || 0);
        userData.one21s.push(score.metrics.one21s || 0);
        userData.referrals.push(score.metrics.referrals || 0);
        userData.tyfcb.push(score.metrics.tyfcb || 0);
        userData.visitors.push(score.metrics.visitors || 0);
      });

      // Get current session's leaderboard to compare against
      const risingEntries: (LeaderboardEntry & {
        improvement: number;
        average: number;
        averageMetrics: {
          attendance: number;
          one21s: number;
          referrals: number;
          tyfcb: number;
          visitors: number;
        }
      })[] = [];

      rawLeaderboard.forEach((currentEntry) => {
        const user = currentEntry.user;
        const userData = userScoresMap.get(user.id!);

        // Skip if user has no historical data
        if (!userData || userData.scores.length === 0) return;

        // Calculate user's average only from sessions after they joined
        const userCreatedAt = user.createdAt?.toMillis?.() || 0;

        // Filter scores to only include those from sessions after user joined
        const validClosedSessions = closedSessions.filter(s => {
          const sessionDate = s.date?.toMillis?.() || 0;
          return sessionDate >= userCreatedAt;
        });

        const numValidSessions = validClosedSessions.length;
        if (numValidSessions === 0) return; // No valid sessions to compare

        // Helper function to calculate average across valid sessions only
        const calculateAvg = (arr: number[] = []) => {
          if (arr.length === 0) return 0;

          // Add zeros for sessions they missed (after joining)
          const totalValues = [...arr];
          const missingSessions = numValidSessions - arr.length;
          for (let i = 0; i < missingSessions; i++) {
            totalValues.push(0);
          }

          const sum = totalValues.reduce((s, v) => s + (isNaN(v) ? 0 : v), 0);
          const avg = sum / numValidSessions;
          return isNaN(avg) ? 0 : avg;
        };

        const avgPoints = calculateAvg(userData.scores);
        const avgMetrics = {
          attendance: calculateAvg(userData.attendance),
          one21s: calculateAvg(userData.one21s),
          referrals: calculateAvg(userData.referrals),
          tyfcb: calculateAvg(userData.tyfcb),
          visitors: calculateAvg(userData.visitors)
        };

        // Calculate improvement percentage for selected metric
        const currentValue = getMetricValue(currentEntry, selectedMetric);
        const avgValue = selectedMetric === 'points' ? avgPoints : avgMetrics[selectedMetric];

        // Only show users who improved (positive gain)
        if (currentValue <= avgValue) return;

        const improvement = avgValue > 0 ? ((currentValue - avgValue) / avgValue) * 100 : 100;

        risingEntries.push({
          ...currentEntry,
          improvement,
          average: avgValue,
          averageMetrics: avgMetrics
        });
      });

      // Sort by improvement percentage (highest first)
      risingEntries.sort((a, b) => b.improvement - a.improvement);

      setRisingStarsLeaderboard(risingEntries);
    };

    calculateRisingStars();
  }, [viewMode, allSeasonSessions, activeSession, sessionId, rawLeaderboard, users, selectedMetric]);

  console.log('[Chart] Leaderboard entries:', rawLeaderboard.map(l => ({ name: `${l.user.firstName} ${l.user.lastName}`, points: l.weeklyPoints })));
  console.log('[Chart] showAdmin parameter:', showAdmin);

  // Helper function to get metric value
  const getMetricValue = (entry: LeaderboardEntry, metric: MetricType): number => {
    if (metric === 'points') return entry.weeklyPoints;
    return entry.metrics[metric] || 0;
  };

  // Helper function to get metric label
  const getMetricLabel = (metric: MetricType): string => {
    switch (metric) {
      case 'points': return 'Points';
      case 'attendance': return 'Attendance';
      case 'one21s': return '1-2-1s';
      case 'referrals': return 'Referrals';
      case 'tyfcb': return 'TYFCB';
      case 'visitors': return 'Visitors';
    }
  };

  // Use appropriate leaderboard based on view mode
  const displayLeaderboard = viewMode === 'average' ? averageLeaderboard : viewMode === 'rising' ? risingStarsLeaderboard : rawLeaderboard;

  // Filter out Lance (admin without team) unless showadmin=true
  let leaders = showAdmin
    ? displayLeaderboard
    : displayLeaderboard.filter(entry => entry.user.email !== 'lance@nectafy.com');

  // Sort by selected metric (but not for rising stars - they're already sorted by improvement)
  if (viewMode !== 'rising') {
    leaders = [...leaders].sort((a, b) => getMetricValue(b, selectedMetric) - getMetricValue(a, selectedMetric));
  }

  // Calculate max score from non-admin users only (for percentage calculations)
  const nonAdminLeaders = leaders.filter(entry => entry.user.email !== 'lance@nectafy.com');
  const maxScore = nonAdminLeaders[0] ? getMetricValue(nonAdminLeaders[0], selectedMetric) : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <div className="flex flex-col p-4 pb-8">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push(`/display${sessionIdParam ? `?sessionId=${sessionIdParam}` : ''}`)}
            className="text-white/70 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={24} />
            <h1 className="text-2xl font-bold">
              {viewMode === 'session'
                ? `${getMetricLabel(selectedMetric)} Leaders from ${displaySession?.name || 'Session'}`
                : viewMode === 'average'
                ? `${getMetricLabel(selectedMetric)} Averages Through ${displaySession?.name || 'Session'}`
                : `${getMetricLabel(selectedMetric)} Rising Stars from ${displaySession?.name || 'Session'}`
              }
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode buttons */}
            <button
              onClick={() => setViewMode('session')}
              className={`px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1 ${
                viewMode === 'session' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <span>This Week</span>
            </button>

            <button
              onClick={() => setViewMode('rising')}
              className={`px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1 ${
                viewMode === 'rising' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <TrendingUp size={16} />
              <span>Rising Stars</span>
            </button>

            <button
              onClick={() => setViewMode('average')}
              className={`px-3 py-1.5 rounded-lg transition-colors text-sm flex items-center gap-1 ${
                viewMode === 'average' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <span>Averages</span>
            </button>

            {/* Metric Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowMetricDropdown(!showMetricDropdown)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm flex items-center gap-1"
              >
                <span>{getMetricLabel(selectedMetric)}</span>
                <ChevronDown size={16} />
              </button>

              {showMetricDropdown && (
                <div className="absolute right-0 mt-1 bg-white text-gray-900 rounded-lg shadow-lg overflow-hidden z-10 min-w-[140px]">
                  {(['points', 'attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as MetricType[]).map((metric) => (
                    <button
                      key={metric}
                      onClick={() => {
                        setSelectedMetric(metric);
                        setShowMetricDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${
                        selectedMetric === metric ? 'bg-blue-50 font-semibold' : ''
                      }`}
                    >
                      {getMetricLabel(metric)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="text-white/50 hover:text-white/80 transition-colors text-xs underline"
            >
              {showAdmin ? 'Hide Admin' : 'Show Admin'}
            </button>
          </div>
        </div>

        {/* Leader Cards */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4">
          <div className="space-y-2">
            {leaders.map((leader, index) => {
              // Don't apply colored fill to admin
              const isAdmin = leader.user.email === 'lance@nectafy.com';
              const metricValue = getMetricValue(leader, selectedMetric);
              const scorePercentage = isAdmin ? 0 : (metricValue / maxScore) * 100;

              return (
                <motion.div
                  key={leader.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="relative grid grid-cols-[300px_1fr_auto] items-center gap-6 p-6 rounded-xl overflow-hidden border-2 border-white/10 hover:border-white/20 transition-colors"
                  style={{
                    background: viewMode === 'rising' || isAdmin
                      ? 'rgba(255, 255, 255, 0.05)'
                      : `linear-gradient(to right, rgba(236, 72, 153, 0.5) 0%, rgba(236, 72, 153, 0.5) ${scorePercentage}%, rgba(255, 255, 255, 0.05) ${scorePercentage}%, rgba(255, 255, 255, 0.05) 100%)`
                  }}
                >
                  <div className="flex items-center gap-6">
                    {!isAdmin && (
                      <div className="text-3xl font-bold w-12 text-center text-white/50">
                        {index + 1}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="w-12"></div>
                    )}
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
                      {leader.team && (
                        <div className="text-sm text-white/60 mt-1">
                          {leader.team.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics - Compact Grid */}
                  <div className="grid grid-cols-5 gap-6 text-base justify-self-center">
                    {/* Attendance */}
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">Attendance</div>
                      <div className={`font-semibold text-3xl ${
                        viewMode === 'rising' && (leader as any).averageMetrics && leader.metrics.attendance > (leader as any).averageMetrics.attendance
                          ? 'text-green-400'
                          : ''
                      }`}>
                        {leader.metrics.attendance}
                      </div>
                      {viewMode === 'rising' && (leader as any).averageMetrics && (
                        <div className="text-xs text-white/40 mt-1">
                          avg: {Math.round((leader as any).averageMetrics.attendance * 10) / 10}
                        </div>
                      )}
                    </div>
                    {/* 1-2-1s */}
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">1-2-1s</div>
                      <div className={`font-semibold text-3xl ${
                        viewMode === 'rising' && (leader as any).averageMetrics && leader.metrics.one21s > (leader as any).averageMetrics.one21s
                          ? 'text-green-400'
                          : ''
                      }`}>
                        {leader.metrics.one21s}
                      </div>
                      {viewMode === 'rising' && (leader as any).averageMetrics && (
                        <div className="text-xs text-white/40 mt-1">
                          avg: {Math.round((leader as any).averageMetrics.one21s * 10) / 10}
                        </div>
                      )}
                    </div>
                    {/* Referrals */}
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">Referrals</div>
                      <div className={`font-semibold text-3xl ${
                        viewMode === 'rising' && (leader as any).averageMetrics && leader.metrics.referrals > (leader as any).averageMetrics.referrals
                          ? 'text-green-400'
                          : ''
                      }`}>
                        {leader.metrics.referrals}
                      </div>
                      {viewMode === 'rising' && (leader as any).averageMetrics && (
                        <div className="text-xs text-white/40 mt-1">
                          avg: {Math.round((leader as any).averageMetrics.referrals * 10) / 10}
                        </div>
                      )}
                    </div>
                    {/* TYFCB */}
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">TYFCB</div>
                      <div className={`font-semibold text-3xl ${
                        viewMode === 'rising' && (leader as any).averageMetrics && leader.metrics.tyfcb > (leader as any).averageMetrics.tyfcb
                          ? 'text-green-400'
                          : ''
                      }`}>
                        {leader.metrics.tyfcb}
                      </div>
                      {viewMode === 'rising' && (leader as any).averageMetrics && (
                        <div className="text-xs text-white/40 mt-1">
                          avg: {Math.round((leader as any).averageMetrics.tyfcb * 10) / 10}
                        </div>
                      )}
                    </div>
                    {/* Visitors */}
                    <div className="text-center">
                      <div className="text-white/50 text-lg font-medium mb-1">Visitors</div>
                      <div className={`font-semibold text-3xl ${
                        viewMode === 'rising' && (leader as any).averageMetrics && leader.metrics.visitors > (leader as any).averageMetrics.visitors
                          ? 'text-green-400'
                          : ''
                      }`}>
                        {leader.metrics.visitors}
                      </div>
                      {viewMode === 'rising' && (leader as any).averageMetrics && (
                        <div className="text-xs text-white/40 mt-1">
                          avg: {Math.round((leader as any).averageMetrics.visitors * 10) / 10}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Metric Value or Improvement */}
                  <div className="text-right">
                    {viewMode === 'rising' ? (
                      <>
                        <div className="text-5xl font-bold text-green-400">
                          +{Math.round((leader as any).improvement)}%
                        </div>
                        <div className="text-sm text-white/50">
                          {metricValue} (avg: {Math.round((leader as any).average * 10) / 10})
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-5xl font-bold text-white">
                          {metricValue}
                        </div>
                        <div className="text-base text-white/50">
                          {viewMode === 'average' && selectedMetric === 'points' ? 'avg' : getMetricLabel(selectedMetric).toLowerCase()}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {leaders.length === 0 && (
              <div className="text-center text-gray-400 text-2xl mt-20">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
