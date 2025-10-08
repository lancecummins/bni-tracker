'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStaticActiveSession, useStaticSettings } from '@/lib/firebase/hooks/useStaticData';
import {
  useStaticLeaderboard,
  useStaticTeamStandings,
  useStaticWeekComparison,
} from '@/lib/firebase/hooks/useStaticCompositeData';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, Users, Zap, Star, Gift } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { User, Team, Score } from '@/lib/types';
import { displayChannel } from '@/lib/utils/displayChannel';
import Image from 'next/image';
import { shownUsersStore } from '@/lib/utils/revealedUsersStore';
import { revealedBonusesStore } from '@/lib/utils/revealedBonusesStore';

// Import referee display components
import RefereeDisplay from './referee/page';


interface DisplayData {
  type: 'DISPLAY_USER' | 'DISPLAY_STATS' | 'DISPLAY_TEAM_LEADERBOARD' | 'DISPLAY_TEAM_BONUS';
  user?: User;
  team?: Team;
  score?: Score;
  settings?: any;
  teams?: Team[];
  scores?: Score[];
  users?: User[];
  revealedUserIds?: string[];
  // For bonus display
  teamId?: string;
  teamName?: string;
  teamColor?: string;
  bonusTotal?: number;
  bonusCategories?: string[];
}

export default function DisplayPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const { session: activeSession } = useStaticActiveSession();
  const { settings } = useStaticSettings();
  const { leaderboard, loading: leaderboardLoading } = useStaticLeaderboard(
    activeSession?.id || null,
    false // Show all scores (including drafts) since referee controls display
  );
  const { standings, loading: standingsLoading } = useStaticTeamStandings(
    activeSession?.id || null,
    false // Show all scores (including drafts) since referee controls display
  );

  // Debug logging
  useEffect(() => {
    console.log('[Display] Leaderboard length:', leaderboard.length);
    console.log('[Display] First 3 users:', leaderboard.slice(0, 3).map(e => e.user.firstName));
    console.log('[Display] Standings:', standings.map(s => ({ team: s.team.name, points: s.weeklyPoints })));
  }, [leaderboard, standings]);

  const {
    userComparisons,
    teamComparisons,
    loading: comparisonLoading,
    hasPreviousWeek
  } = useStaticWeekComparison(activeSession?.id || null);

  const [showConfetti, setShowConfetti] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const prevLeaderRef = useRef<typeof leaderboard>([]);
  const prevStandingsRef = useRef<typeof standings>([]);

  // Referee display state
  const [displayData, setDisplayData] = useState<DisplayData | null>(null);

  // Listen for referee messages from multiple sources
  useEffect(() => {
    // 1. Server-Sent Events for cross-device communication
    const eventSource = new EventSource('/api/display');
    eventSource.onmessage = (event) => {
      console.log('Display received SSE message:', event.data.substring(0, 100));
      try {
        const data = JSON.parse(event.data);
        console.log('Display parsed data type:', data.type, 'user:', data.user?.firstName);

        // Sync shown users if provided
        if (data.shownUserIds && Array.isArray(data.shownUserIds)) {
          console.log('[Display] Syncing shown users:', data.shownUserIds);
          // Use the new setShownUsers method for efficient syncing
          shownUsersStore.setShownUsers(data.shownUserIds);
        }

        // Sync revealed bonuses if provided
        if (data.revealedBonusTeamIds && Array.isArray(data.revealedBonusTeamIds)) {
          console.log('[Display] Syncing revealed bonuses:', data.revealedBonusTeamIds);
          revealedBonusesStore.setRevealedTeams(data.revealedBonusTeamIds);
        }

        // Handle bonus update message
        if (data.type === 'UPDATE_BONUSES' && data.revealedBonusTeamIds) {
          revealedBonusesStore.setRevealedTeams(data.revealedBonusTeamIds);
        }

        // Handle team bonus display
        if (data.type === 'DISPLAY_TEAM_BONUS') {
          setDisplayData(data);
          // Auto-clear after 5 seconds
          setTimeout(() => {
            setDisplayData(null);
          }, 5000);
        } else if (data.type === 'CLEAR_DISPLAY') {
          setDisplayData(null); // Clear display to show default
        } else if (data.type) {
          setDisplayData(data);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // EventSource will automatically reconnect
    };

    // 2. Broadcast channel for same-browser communication (fallback)
    displayChannel.onMessage((data) => {
      if (data.type === 'CLEAR_DISPLAY') {
        setDisplayData(null);
      } else if (data.type) {
        setDisplayData(data);
      }
    });

    // 3. PostMessage for backwards compatibility
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CLEAR_DISPLAY') {
        setDisplayData(null);
      } else if (event.data.type) {
        setDisplayData(event.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      eventSource.close();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Detect changes and trigger effects
  useEffect(() => {
    if (!leaderboard.length) return;

    const prevLeader = prevLeaderRef.current;
    const updatedUsers = new Set<string>();

    // Check for position changes
    if (prevLeader.length > 0) {
      const prevTopUserId = prevLeader[0]?.userId;
      const currentTopUserId = leaderboard[0]?.userId;

      if (prevTopUserId !== currentTopUserId && currentTopUserId) {
        // Lead change!
        // Sound effect would play here
      }

      // Check for any score updates and track which users were updated
      leaderboard.forEach((entry) => {
        const prevEntry = prevLeader.find((p) => p.userId === entry.userId);
        if (prevEntry && prevEntry.weeklyPoints !== entry.weeklyPoints) {
          updatedUsers.add(entry.userId);
        }
      });

      if (updatedUsers.size > 0) {
        // Sound effect would play here
        setRecentlyUpdated(updatedUsers);
        setLastUpdateTime(new Date());

        // Clear the highlight after 2 seconds
        setTimeout(() => {
          setRecentlyUpdated(new Set());
        }, 2000);
      }
    }

    prevLeaderRef.current = leaderboard;
  }, [leaderboard]);

  // Trigger confetti for winning team
  useEffect(() => {
    if (!standings.length) return;

    const prevStandings = prevStandingsRef.current;
    if (prevStandings.length > 0 && !showConfetti) {
      const prevLeader = prevStandings[0];
      const currentLeader = standings[0];

      if (
        prevLeader?.teamId !== currentLeader?.teamId &&
        currentLeader?.weeklyPoints > 0
      ) {
        setShowConfetti(true);
        // Sound effect would play here

        // Fire confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });

        setTimeout(() => setShowConfetti(false), 5000);
      }
    }

    prevStandingsRef.current = standings;
  }, [standings, showConfetti]);

  // If referee has sent display data, show that instead
  if (displayData) {
    // Special handling for team bonus display
    if (displayData.type === 'DISPLAY_TEAM_BONUS') {
      return (
        <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex items-center justify-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            className="text-center max-w-2xl mx-auto p-8"
          >
            {/* Team Name */}
            <div
              className="inline-block px-8 py-4 rounded-xl mb-8"
              style={{
                backgroundColor: displayData.teamColor || '#3B82F6',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
            >
              <h1 className="text-5xl font-bold text-white">
                {displayData.teamName}
              </h1>
            </div>

            {/* Bonus Animation */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <Gift size={80} className="text-yellow-400 mx-auto mb-4" />
              <h2 className="text-6xl font-bold text-yellow-400 mb-4">
                +{displayData.bonusTotal} BONUS POINTS!
              </h2>
            </motion.div>

            {/* Categories */}
            {displayData.bonusCategories && displayData.bonusCategories.length > 0 && (
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-white/20 backdrop-blur-lg rounded-xl p-6"
              >
                <h3 className="text-2xl font-semibold mb-4">All In Categories:</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {displayData.bonusCategories.map((category, index) => (
                    <motion.div
                      key={category}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="px-6 py-3 bg-green-500 text-white rounded-full text-xl font-bold"
                    >
                      ✓ {category === 'one21s' ? '1-2-1s' :
                          category === 'tyfcb' ? 'TYFCB' :
                          category.charAt(0).toUpperCase() + category.slice(1)}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Confetti Effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              onAnimationComplete={() => {
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: [displayData.teamColor || '#3B82F6', '#FCD34D', '#10B981']
                });
              }}
            />
          </motion.div>
        </div>
      );
    }
    return <RefereeDisplay initialData={displayData} />;
  }

  const loading = leaderboardLoading || standingsLoading || comparisonLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="mx-auto h-24 w-24 text-yellow-400 mb-4 animate-pulse" />
          <div className="flex justify-center mb-2">
            <Image
              src="/bni-game-logo.png"
              alt="BNI Competition Tracker"
              width={300}
              height={100}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-xl text-blue-200">Ready to Display Scores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white overflow-hidden">
      <div className="h-full flex flex-col p-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <Image
            src="/bni-game-logo.png"
            alt="BNI Competition Tracker"
            width={150}
            height={50}
            className="object-contain"
            priority
          />
          <div className="flex items-center gap-4">
            <p className="text-lg opacity-90">
              Week {activeSession.weekNumber}
            </p>
            {lastUpdateTime && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2 py-0.5 bg-green-500/30 rounded-full"
              >
                <Zap className="text-yellow-400" size={16} />
                <span className="text-xs">LIVE</span>
              </motion.div>
            )}
          </div>
          <button
            onClick={() => router.push('/display/season')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm flex items-center gap-1"
          >
            <Trophy size={16} />
            <span>Season</span>
          </button>
        </div>

        {/* Main Content - Single row with 2 columns */}
        <div className="flex-1 flex gap-4 min-h-0">
            {/* First Column - 2/3 width - Contains Team Competition and Category Leaders */}
            <div className="flex-[2] flex flex-col gap-4 min-h-0">
              {/* Team Standings - Takes most of the vertical space */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="text-yellow-400" size={22} />
                  <h2 className="text-xl font-bold">Team Competition</h2>
                </div>

                <div className="flex-1 overflow-hidden space-y-4">
                <AnimatePresence mode="wait">
              {standings.map((team, index) => {
                const teamComparison = teamComparisons.find(tc => tc.teamId === team.teamId);

                return (
                <motion.div
                  key={team.teamId}
                  layout
                  initial={{ opacity: 0, x: -50 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: recentlyUpdated.size > 0 &&
                           team.members.some(m => recentlyUpdated.has(m.userId)) ? [1, 1.02, 1] : 1
                  }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    scale: { duration: 0.5 }
                  }}
                  className={`rounded-lg cursor-pointer transition-all bg-white/10 backdrop-blur-lg overflow-hidden ${
                    index === 0
                      ? 'border-2 border-yellow-400'
                      : ''
                  } ${
                    recentlyUpdated.size > 0 &&
                    team.members.some(m => recentlyUpdated.has(m.userId))
                      ? 'ring-2 ring-green-400 ring-opacity-50'
                      : ''
                  }`}
                  onClick={() => router.push(`/display/team/${team.teamId}`)}
                >
                  {/* Colored bar at top */}
                  <div className="h-3" style={{ backgroundColor: team.team.color || '#3B82F6' }} />

                  <div className="p-3 flex flex-col gap-2">
                    {/* Main content row */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-bold ${
                          index === 0 ? 'text-yellow-400' : 'text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div>
                            <h3 className="text-2xl font-semibold text-white">{team.team.name}</h3>
                          </div>
                          <div>
                            <p className="text-sm text-white/80">
                              {team.members.length} {team.members.length === 1 ? 'member' : 'members'} shown
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <motion.div
                          key={team.weeklyPoints + (team.bonusPoints || 0)}
                          initial={{ scale: 1.5, color: '#10b981' }}
                          animate={{ scale: 1, color: '#ffffff' }}
                          transition={{ duration: 0.5 }}
                          className="flex flex-col items-end"
                        >
                          <div className="inline-flex flex-col items-center">
                            <span className="text-4xl font-bold text-white">
                              {team.weeklyPoints + (team.bonusPoints || 0)}
                            </span>
                            <span className="text-sm text-white/80">points</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>

                    {/* Bonus cards row */}
                    {(team.bonusPoints || 0) > 0 && team.bonusCategories && team.bonusCategories.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        className="flex flex-wrap gap-2"
                      >
                        {team.bonusCategories.map((category, catIndex) => {
                          const categoryPoints = settings?.bonusValues?.[category as keyof typeof settings.bonusValues] || 0;
                          const displayName = category === 'one21s' ? '1-2-1s' :
                                              category === 'tyfcb' ? 'TYFCB' :
                                              category.charAt(0).toUpperCase() + category.slice(1);

                          return (
                            <motion.div
                              key={category}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                delay: 0.4 + index * 0.05 + catIndex * 0.1,
                                type: "spring",
                                stiffness: 260,
                                damping: 20
                              }}
                              className="bg-gradient-to-r from-green-500/90 to-emerald-500/90 rounded-lg px-2 py-1 shadow-lg border border-green-400/50"
                            >
                              <div className="flex items-center gap-2">
                                <Gift size={14} className="text-yellow-300" />
                                <div>
                                  <div className="text-xs text-green-100 font-medium">All In</div>
                                  <div className="text-white font-bold text-xs">{displayName}</div>
                                </div>
                                <div className="text-yellow-300 font-bold text-sm ml-1">
                                  +{categoryPoints}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>

                </motion.div>
                );
              })}
                  </AnimatePresence>
                </div>
              </div>

              {/* Category Leaders - Fixed height at bottom of first column */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 shrink-0" style={{ height: '180px' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="text-purple-400" size={20} />
                  <h2 className="text-lg font-bold">Category Leaders</h2>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {(() => {
                    const categories = [
                      { key: 'one21s', label: '1-2-1s' },
                      { key: 'referrals', label: 'Referrals' },
                      { key: 'tyfcb', label: 'TYFCB' },
                      { key: 'visitors', label: 'Visitors' },
                    ] as const;

                    return categories.map((category) => {
                      // Find the highest score for this category
                      const maxScore = Math.max(
                        ...leaderboard.map(entry => entry.metrics[category.key] || 0)
                      );

                      // Find all achievers with the max score
                      const topAchievers = maxScore > 0
                        ? leaderboard.filter(entry => entry.metrics[category.key] === maxScore)
                        : [];

                      if (topAchievers.length === 0) {
                        return (
                          <div
                            key={category.key}
                            className="bg-white/5 rounded-lg p-3 flex flex-col items-center justify-center"
                          >
                            <div className="text-sm font-medium text-white/50 mb-1">{category.label}</div>
                            <div className="text-white/30 text-2xl">—</div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={category.key}
                          className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-3 flex flex-col border border-yellow-400/30"
                        >
                          <div className="text-sm font-medium text-white/90 mb-1">
                            {category.label}
                          </div>
                          <div className="text-3xl font-bold text-yellow-400 mb-1">
                            {maxScore}
                          </div>
                          <div className="flex-1 min-h-0">
                            {topAchievers.slice(0, 1).map((achiever) => (
                              <div key={achiever.userId} className="text-sm font-semibold text-white truncate">
                                {achiever.user.firstName} {achiever.user.lastName}
                              </div>
                            ))}
                            {topAchievers.length > 1 && (
                              <div className="text-white/60 text-xs">+{topAchievers.length - 1} more</div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Second Column - 1/3 width - Individual Leaders */}
            <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-xl p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="text-green-400" size={22} />
                <h2 className="text-xl font-bold">Individual Leaders</h2>
              </div>

              <div className="flex-1 overflow-hidden space-y-2">
              <AnimatePresence mode="popLayout">
                {leaderboard.map((entry, index) => {
                  const userComparison = userComparisons.find(uc => uc.userId === entry.userId);

                  return (
                  <motion.div
                    key={entry.userId}
                    layout
                    initial={{ opacity: 0, x: 50 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: recentlyUpdated.has(entry.userId) ? [1, 1.05, 1] : 1,
                    }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.03,
                      scale: { duration: 0.5 }
                    }}
                    className={`relative flex items-center gap-3 p-2 rounded-lg bg-white/10 backdrop-blur-lg overflow-hidden ${
                      index === 0
                        ? 'border border-green-400'
                        : ''
                    } ${
                      recentlyUpdated.has(entry.userId)
                        ? 'ring-2 ring-green-400 ring-opacity-50'
                        : ''
                    }`}
                  >
                    {/* Colored bar on left side */}
                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: entry.team?.color || '#3B82F6' }} />

                    <motion.div
                      animate={{
                        scale: recentlyUpdated.has(entry.userId) ? [1, 1.2, 1] : 1
                      }}
                      transition={{ duration: 0.5 }}
                      className={`text-2xl font-bold ml-4 ${
                        index === 0 ? 'text-green-400' : 'text-white'
                      }`}
                    >
                      {index + 1}
                    </motion.div>
                    <Avatar
                      src={entry.user.avatarUrl}
                      fallbackSeed={`${entry.user.firstName}${entry.user.lastName}`}
                      size="md"
                      className="border border-white/30"
                    />
                    <div className="flex-1">
                      <div>
                        <div className="font-semibold text-lg text-white">
                          {entry.user.firstName} {entry.user.lastName}
                        </div>
                      </div>
                      <div className="mt-0.5">
                        <div className="text-sm text-white/70">
                          {entry.team?.name || 'No Team'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <motion.div
                        key={entry.weeklyPoints}
                        initial={{ scale: 1.5, color: '#10b981' }}
                        animate={{ scale: 1, color: '#ffffff' }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-end"
                      >
                        <div className="inline-flex flex-col items-center">
                          <span className="text-3xl font-bold text-white">
                            {entry.weeklyPoints}
                          </span>
                          <span className="text-sm text-white/70">points</span>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                  );
                })}
              </AnimatePresence>
              </div>
            </div>

        </div>

      </div>
    </div>
  );
}