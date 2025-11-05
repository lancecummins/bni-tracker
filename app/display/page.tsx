'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStaticActiveSession, useStaticSettings, useStaticSeasonSessions, clearStaticDataCache } from '@/lib/firebase/hooks/useStaticData';
import { sessionService, scoreService } from '@/lib/firebase/services';
import {
  useStaticLeaderboard,
  useStaticTeamStandings,
  useStaticWeekComparison,
} from '@/lib/firebase/hooks/useStaticCompositeData';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, Users, Zap, Star, Gift, ChevronDown, Award } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { User, Team, Score } from '@/lib/types';
import { displayChannel } from '@/lib/utils/displayChannel';
import Image from 'next/image';
import { shownUsersStore } from '@/lib/utils/revealedUsersStore';
import { revealedBonusesStore } from '@/lib/utils/revealedBonusesStore';

// Import referee display components
import RefereeDisplay from './referee/page';


interface DisplayData {
  type: 'DISPLAY_USER' | 'DISPLAY_STATS' | 'DISPLAY_TEAM_LEADERBOARD' | 'DISPLAY_TEAM_BONUS' | 'DISPLAY_CUSTOM_BONUS' | 'CELEBRATE_WINNING_TEAM' | 'SHOW_SEASON_STANDINGS';
  sessionId?: string;
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
  // For celebration
  winningTeam?: any;
  teamName?: string;
  teamColor?: string;
  teamLogoUrl?: string;
  bonusTotal?: number;
  bonusCategories?: string[];
  // For custom bonus
  bonusName?: string;
  bonusPoints?: number;
  isTeamBonus?: boolean;
  targetName?: string;
  // For on-deck indicator
  nextUser?: User;
  nextUserTeam?: Team;
}

function DisplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  const [refreshKey, setRefreshKey] = useState(0);
  const { session: activeSession } = useStaticActiveSession();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<typeof activeSession>(null);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const { sessions: allSessions } = useStaticSeasonSessions(activeSession?.seasonId || null);
  const { settings } = useStaticSettings();

  const bonusRevealRef = useRef<HTMLAudioElement | null>(null);

  // Determine which session to display
  const displaySessionId = selectedSession || sessionIdParam || activeSession?.id || null;

  const { leaderboard: rawLeaderboard, loading: leaderboardLoading } = useStaticLeaderboard(
    displaySessionId,
    false, // Show all scores (including drafts) since referee controls display
    refreshKey
  );
  const { standings, loading: standingsLoading } = useStaticTeamStandings(
    displaySessionId,
    false, // Show all scores (including drafts) since referee controls display
    refreshKey
  );

  // Filter leaderboard to exclude users without teams and Lance Cummins
  const leaderboard = rawLeaderboard.filter(entry => {
    // Exclude Lance Cummins
    if (entry.user.email === 'lance@nectafy.com') return false;
    // Exclude users without a team
    if (!entry.user.teamId) return false;
    return true;
  });

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
  } = useStaticWeekComparison(displaySessionId);

  // Load the current session data when sessionId changes
  useEffect(() => {
    const loadSession = async () => {
      if (sessionIdParam && sessionIdParam !== activeSession?.id) {
        const session = await sessionService.getById(sessionIdParam);
        setCurrentSession(session);
        setSelectedSession(sessionIdParam);

        if (session) {
          const scores = await scoreService.getBySession(sessionIdParam);
          const userIds = scores.map(s => s.userId);
          shownUsersStore.setShownUsers(userIds);
        }
      } else if (selectedSession && selectedSession !== activeSession?.id) {
        const session = await sessionService.getById(selectedSession);
        setCurrentSession(session);

        if (session) {
          const scores = await scoreService.getBySession(selectedSession);
          const userIds = scores.map(s => s.userId);
          shownUsersStore.setShownUsers(userIds);
        }
      } else if (selectedSession === activeSession?.id) {
        setCurrentSession(activeSession);

        if (selectedSession) {
          const scores = await scoreService.getBySession(selectedSession);
          const userIds = scores.map(s => s.userId);
          shownUsersStore.setShownUsers(userIds);
        }
      } else {
        setCurrentSession(activeSession);
      }
    };

    loadSession();
  }, [sessionIdParam, selectedSession, activeSession]);

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId);
    setShowSessionDropdown(false);
    // Update URL without page reload
    const url = new URL(window.location.href);
    if (sessionId === activeSession?.id) {
      url.searchParams.delete('sessionId');
    } else {
      url.searchParams.set('sessionId', sessionId);
    }
    window.history.pushState({}, '', url);
  };


  const [showConfetti, setShowConfetti] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const prevLeaderRef = useRef<typeof leaderboard>([]);
  const prevStandingsRef = useRef<typeof standings>([]);

  // Referee display state
  const [displayData, setDisplayData] = useState<DisplayData | null>(null);
  const [nextUser, setNextUser] = useState<User | null>(null);
  const [nextUserTeam, setNextUserTeam] = useState<Team | null>(null);
  const [themeAudio, setThemeAudio] = useState<HTMLAudioElement | null>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);


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

        // Update next user info if present
        if (data.nextUser) {
          setNextUser(data.nextUser);
          setNextUserTeam(data.nextUserTeam || null);
        } else if (data.type === 'CLEAR_DISPLAY') {
          setNextUser(null);
          setNextUserTeam(null);
        }

        // Handle team bonus display
        if (data.type === 'DISPLAY_TEAM_BONUS') {
          setDisplayData(data);
          if (bonusRevealRef.current) {
            // bonusRevealRef.current.play().catch(err => console.log('Bonus sound failed:', err)); // DISABLED
          }
        } else if (data.type === 'DISPLAY_CUSTOM_BONUS') {
          setDisplayData(data);
          if (bonusRevealRef.current) {
            // bonusRevealRef.current.play().catch(err => console.log('Bonus sound failed:', err)); // DISABLED
          }
        } else if (data.type === 'CLEAR_DISPLAY') {
          console.log('[Display] CLEAR_DISPLAY received with sessionId:', data.sessionId);

          // Clear cache to get fresh data with updated bonuses
          clearStaticDataCache();

          // Force refresh of all data
          setRefreshKey(prev => prev + 1);

          setDisplayData(null); // Clear display to show default
          setNextUser(null);
          setNextUserTeam(null);

          // Update URL with sessionId if provided
          if (data.sessionId) {
            console.log('[Display] Updating session to:', data.sessionId);
            const url = new URL(window.location.href);
            url.searchParams.set('sessionId', data.sessionId);
            window.history.pushState({}, '', url);
            setSelectedSession(data.sessionId);
          }
        } else if (data.type === 'SHOW_SEASON_STANDINGS') {
          router.push('/display/season');
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
      // Update next user info if present
      if (data.nextUser) {
        setNextUser(data.nextUser);
        setNextUserTeam(data.nextUserTeam || null);
      }

      if (data.type === 'CLEAR_DISPLAY') {
        setDisplayData(null);
        setNextUser(null);
        setNextUserTeam(null);
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

  // Bonus reveal sound setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!bonusRevealRef.current) {
      bonusRevealRef.current = new Audio('/sounds/total-reveal.mp3');
      bonusRevealRef.current.volume = 0.6;
    }
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

  // Play/pause theme music based on displayData state
  useEffect(() => {
    if (displayData) {
      // Pause theme music when showing any other screen
      if (themeAudio) {
        themeAudio.pause();
        themeAudio.currentTime = 0; // Reset to beginning
      }
      // Also pause celebration audio if switching away
      if (celebrationAudioRef.current) {
        celebrationAudioRef.current.pause();
        celebrationAudioRef.current.currentTime = 0;
      }
    } else {
      // Play theme music when showing scoreboard - DISABLED
      // if (!themeAudio) {
      //   const audio = new Audio('/sounds/bni-game-theme.mp3');
      //   audio.volume = 0.3;
      //   audio.loop = true;
      //   audio.play().catch(err => console.log('Audio play failed:', err));
      //   setThemeAudio(audio);
      // } else {
      //   themeAudio.play().catch(err => console.log('Audio play failed:', err));
      // }
    }
  }, [displayData]);

  useEffect(() => {
    return () => {
      if (themeAudio) {
        themeAudio.pause();
      }
      if (celebrationAudioRef.current) {
        celebrationAudioRef.current.pause();
      }
      if (bonusRevealRef.current) {
        bonusRevealRef.current.pause();
      }
    };
  }, [themeAudio]);

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
            {/* Team Logo */}
            {displayData.teamLogoUrl && (
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8 flex justify-center"
              >
                <div className="relative w-64 h-64">
                  <Image
                    src={displayData.teamLogoUrl}
                    alt={`${displayData.teamName} logo`}
                    fill
                    className="object-contain"
                  />
                </div>
              </motion.div>
            )}

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

    // Special handling for custom bonus display
    if (displayData.type === 'DISPLAY_CUSTOM_BONUS') {
      return (
        <div className="h-screen bg-gradient-to-br from-purple-900 to-pink-900 text-white flex items-center justify-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            className="text-center max-w-3xl mx-auto p-8"
          >
            {/* Award Icon */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <Award size={100} className="text-yellow-400 mx-auto" />
            </motion.div>

            {/* Bonus Name */}
            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-6xl font-bold text-yellow-400 mb-6"
            >
              {displayData.bonusName}
            </motion.h1>

            {/* Points */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
              className="mb-8"
            >
              <div className="inline-block px-12 py-6 bg-white/20 backdrop-blur-lg rounded-2xl">
                <span className="text-8xl font-bold text-white">
                  +{displayData.bonusPoints}
                </span>
              </div>
            </motion.div>

            {/* Target */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-white/20 backdrop-blur-lg rounded-xl p-6"
            >
              <p className="text-2xl text-gray-200 mb-2">Awarded to:</p>
              <h2 className="text-4xl font-bold">
                {displayData.targetName}
              </h2>
              {displayData.isTeamBonus && (
                <p className="text-xl text-yellow-300 mt-2">🎉 Team Bonus! 🎉</p>
              )}
            </motion.div>

            {/* Confetti Effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              onAnimationComplete={() => {
                confetti({
                  particleCount: 150,
                  spread: 120,
                  origin: { y: 0.6 },
                  colors: ['#FCD34D', '#A855F7', '#EC4899', '#10B981']
                });
              }}
            />
          </motion.div>
        </div>
      );
    }

    // Special handling for winning team celebration
    if (displayData.type === 'CELEBRATE_WINNING_TEAM') {
      const { winningTeam } = displayData;

      return (
        <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white flex relative overflow-hidden">
          {/* Celebration Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-purple-900 to-blue-900" />

          {/* Left Half - Team Logo */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 100,
              damping: 20,
              delay: 0.2
            }}
            className="w-1/2 flex items-center justify-center p-12 z-10"
          >
            {winningTeam.team.logoUrl && (
              <div className="relative w-full h-full max-w-2xl max-h-2xl">
                <Image
                  src={winningTeam.team.logoUrl}
                  alt={`${winningTeam.team.name} logo`}
                  fill
                  className="object-contain drop-shadow-2xl"
                  priority
                />
              </div>
            )}
          </motion.div>

          {/* Right Half - Content */}
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 100,
              damping: 20,
              duration: 1
            }}
            onAnimationStart={() => {
              if (celebrationAudioRef.current) {
                celebrationAudioRef.current.pause();
              }
              // const audio = new Audio('/sounds/celebrate-winner.mp3'); // DISABLED
              // audio.volume = 0.6;
              // audio.play().catch(err => console.log('Audio play failed:', err));
              // celebrationAudioRef.current = audio;
            }}
            className="w-1/2 flex flex-col items-center justify-center p-8 z-10"
          >
            {/* Trophy */}
            <motion.div
              initial={{ y: -100, scale: 0, rotate: -180 }}
              animate={{ y: 0, scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.4
              }}
              className="mb-8"
            >
              <Trophy className="h-32 w-32 text-yellow-400 drop-shadow-2xl mx-auto" />
            </motion.div>

            {/* Huge Team Name */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 150,
                damping: 20,
                delay: 0.5
              }}
              className="mb-6 text-center"
            >
              <h1
                className="text-6xl font-bold mb-3 drop-shadow-2xl"
                style={{ color: winningTeam.team.color || '#FFD700' }}
              >
                {winningTeam.team.name}
              </h1>
              <h2 className="text-5xl font-bold text-yellow-400 drop-shadow-lg">
                CHAMPIONS!
              </h2>
              <div className="mt-3">
                <span className="text-3xl font-bold text-white drop-shadow-lg">
                  {winningTeam.totalPoints} Points
                </span>
              </div>
            </motion.div>

            {/* Team Bonuses */}
            {(winningTeam.bonusCategories?.length > 0 || winningTeam.customBonuses?.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="mb-6"
              >
                <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">Team Bonuses</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {/* Built-in "All In" bonuses */}
                  {winningTeam.bonusCategories?.map((category: string, index: number) => {
                    const displayName = category === 'one21s' ? '1-2-1s' :
                                        category === 'tyfcb' ? 'TYFCB' :
                                        category.charAt(0).toUpperCase() + category.slice(1);
                    const categoryPoints = settings?.bonusValues?.[category as keyof typeof settings.bonusValues] || 0;

                    return (
                      <motion.div
                        key={category}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 15,
                          delay: 0.7 + index * 0.1
                        }}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg px-4 py-2 shadow-xl border border-green-300"
                      >
                        <div className="text-center">
                          <div className="text-xs text-green-100 font-semibold">All In</div>
                          <div className="text-lg font-bold text-white">{displayName}</div>
                          <div className="text-xl font-bold text-yellow-300">+{categoryPoints}</div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Custom bonuses */}
                  {winningTeam.customBonuses?.map((customBonus: any, index: number) => (
                    <motion.div
                      key={`custom-${index}`}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: 0.7 + (winningTeam.bonusCategories?.length || 0) * 0.1 + index * 0.1
                      }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg px-4 py-2 shadow-xl border border-blue-300"
                    >
                      <div className="text-center">
                        <div className="text-xs text-blue-100 font-semibold">Bonus</div>
                        <div className="text-lg font-bold text-white">{customBonus.bonusName}</div>
                        <div className="text-xl font-bold text-yellow-300">+{customBonus.points}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Member Scores */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="grid grid-cols-2 gap-3 w-full max-w-xl"
            >
              {winningTeam.members.map((member: any, index: number) => {
                const memberScore = winningTeam.scores.find((s: any) => s.userId === member.id);
                const points = memberScore?.totalPoints || 0;

                return (
                  <motion.div
                    key={member.id}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 20,
                      delay: 1 + index * 0.1
                    }}
                    className="bg-white/10 backdrop-blur-lg rounded-lg p-3 border border-yellow-400/50"
                  >
                    <h3 className="text-lg font-bold text-white mb-1">
                      {member.firstName} {member.lastName}
                    </h3>
                    <div className="text-2xl font-bold text-yellow-400">
                      {points} pts
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>

          {/* Massive Confetti Effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onAnimationComplete={() => {
              // Trigger multiple confetti bursts
              setTimeout(() => {
                confetti({
                  particleCount: 200,
                  spread: 100,
                  origin: { y: 0.4 },
                  colors: [winningTeam.team.color || '#FFD700', '#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4']
                });
              }, 100);

              setTimeout(() => {
                confetti({
                  particleCount: 150,
                  spread: 80,
                  origin: { x: 0.2, y: 0.6 },
                  colors: [winningTeam.team.color || '#FFD700', '#FFD700', '#FFA500']
                });
              }, 300);

              setTimeout(() => {
                confetti({
                  particleCount: 150,
                  spread: 80,
                  origin: { x: 0.8, y: 0.6 },
                  colors: [winningTeam.team.color || '#FFD700', '#FFD700', '#FFA500']
                });
              }, 500);

              // Continuous confetti for 5 seconds
              const interval = setInterval(() => {
                confetti({
                  particleCount: 50,
                  spread: 60,
                  origin: { y: 0.8 },
                  colors: [winningTeam.team.color || '#FFD700', '#FFD700', '#FFA500']
                });
              }, 300);

              setTimeout(() => {
                clearInterval(interval);
              }, 5000);
            }}
          />
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

  if (!currentSession) {
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

          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                className="flex items-center gap-2 text-3xl font-bold hover:text-blue-200 transition-colors"
              >
                {currentSession?.name || `Week ${currentSession?.weekNumber}`}
                <ChevronDown size={24} className="text-white/70" />
              </button>
              {showSessionDropdown && allSessions.length > 0 && (
                <div className="absolute top-full mt-2 bg-white text-gray-900 rounded-lg shadow-xl z-50 min-w-[250px] max-h-96 overflow-y-auto">
                  <div className="p-2">
                    {allSessions
                      .filter((session) => !session.isArchived)
                      .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
                      .map((session) => (
                        <button
                          key={session.id}
                          onClick={() => handleSessionChange(session.id!)}
                          className={`w-full text-left px-4 py-2 rounded hover:bg-blue-50 transition-colors ${
                            displaySessionId === session.id ? 'bg-blue-100 font-semibold' : ''
                          }`}
                        >
                          <div className="font-medium">{session.name || `Week ${session.weekNumber}`}</div>
                          <div className="text-sm text-gray-500">
                            {session.date && new Date(session.date.seconds * 1000).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
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
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/display/season')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm flex items-center gap-1"
            >
              <Trophy size={16} />
              <span>Season</span>
            </button>
            <button
              onClick={() => {
                const url = `/display/chart${displaySessionId ? `?sessionId=${displaySessionId}` : ''}`;
                router.push(url);
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm flex items-center gap-1"
            >
              <Trophy size={16} />
              <span>Chart</span>
            </button>
          </div>
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
                  onClick={() => {
                    const url = `/display/team/${team.teamId}${selectedSession ? `?sessionId=${selectedSession}` : ''}`;
                    router.push(url);
                  }}
                >
                  {/* Colored bar at top */}
                  <div className="h-3" style={{ backgroundColor: team.team.color || '#3B82F6' }} />

                  <div className="flex items-stretch">
                    {/* Team logo - full height */}
                    {team.team.logoUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={team.team.logoUrl}
                          alt={`${team.team.name} logo`}
                          className="h-full w-24 object-cover"
                        />
                      </div>
                    )}

                    <div className="p-3 flex flex-col gap-2 flex-1">
                      {/* Main content row */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-2xl font-semibold text-white">{team.team.name}</h3>
                                  <span className={`text-lg font-bold ${
                                    index === 0 ? 'text-yellow-400' : 'text-white/60'
                                  }`}>
                                    #{index + 1}
                                  </span>
                                </div>
                                <p className="text-sm text-white/80">
                                  {team.members.length} {team.members.length === 1 ? 'member' : 'members'} shown
                                </p>
                              </div>
                            {/* Bonus cards inline */}
                            {(team.bonusPoints || 0) > 0 && (team.bonusCategories?.length || team.customBonuses?.length) && (
                              <div className="flex flex-wrap gap-2">
                                {/* Built-in "All In" bonuses */}
                                {team.bonusCategories?.map((category, catIndex) => {
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
                                      <div className="flex items-center gap-1">
                                        <Gift size={12} className="text-yellow-300" />
                                        <div>
                                          <div className="text-xs text-green-100 font-medium">All In</div>
                                          <div className="text-white font-bold text-xs">{displayName}</div>
                                        </div>
                                        <div className="text-yellow-300 font-bold text-xs ml-1">
                                          +{categoryPoints}
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}

                                {/* Custom bonuses */}
                                {team.customBonuses?.map((customBonus, cbIndex) => (
                                  <motion.div
                                    key={`custom-${cbIndex}`}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{
                                      delay: 0.4 + index * 0.05 + (team.bonusCategories?.length || 0) * 0.1 + cbIndex * 0.1,
                                      type: "spring",
                                      stiffness: 260,
                                      damping: 20
                                    }}
                                    className="bg-gradient-to-r from-blue-500/90 to-purple-500/90 rounded-lg px-2 py-1 shadow-lg border border-blue-400/50"
                                  >
                                    <div className="flex items-center gap-1">
                                      <Gift size={12} className="text-yellow-300" />
                                      <div>
                                        <div className="text-xs text-blue-100 font-medium">Bonus</div>
                                        <div className="text-white font-bold text-xs">{customBonus.bonusName}</div>
                                      </div>
                                      <div className="text-yellow-300 font-bold text-xs ml-1">
                                        +{customBonus.points}
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
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
                    </div>
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
                          className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-3 flex border border-yellow-400/30"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="shrink-0">
                              <div className="text-sm font-medium text-white/90 mb-1">
                                {category.label}
                              </div>
                              <div className="text-3xl font-bold text-yellow-400">
                                {maxScore}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="space-y-1">
                                {topAchievers.map((achiever) => (
                                  <div key={achiever.userId} className="text-sm font-semibold text-white">
                                    {achiever.user.firstName} {achiever.user.lastName}
                                  </div>
                                ))}
                              </div>
                            </div>
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

      {/* On-Deck Indicator */}
      {nextUser && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border-4 border-blue-500 p-4 max-w-xs z-[9999]">
          <div className="text-xs font-bold text-blue-600 mb-2 text-center uppercase tracking-wide">On Deck</div>
          <div className="flex items-center gap-3">
            <Avatar src={nextUser.avatarUrl} size="md" />
            <div>
              <p className="font-bold text-gray-900 text-lg">
                {nextUser.firstName} {nextUser.lastName}
              </p>
              {nextUserTeam && (
                <p
                  className="text-sm font-semibold px-2 py-0.5 rounded inline-block"
                  style={{
                    backgroundColor: nextUserTeam.color + '20',
                    color: nextUserTeam.color
                  }}
                >
                  {nextUserTeam.name}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DisplayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    }>
      <DisplayPageContent />
    </Suspense>
  );
}