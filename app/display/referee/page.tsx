'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Team, Score } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { Trophy, Zap, TrendingUp, Users, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface DisplayData {
  type: 'DISPLAY_USER' | 'DISPLAY_STATS' | 'DISPLAY_TEAM_LEADERBOARD' | 'DISPLAY_TEAM_BONUS' | 'DISPLAY_CUSTOM_BONUS' | 'CELEBRATE_WINNING_TEAM';
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
  teamLogoUrl?: string;
  bonusTotal?: number;
  bonusCategories?: string[];
  // For custom bonus
  bonusName?: string;
  bonusPoints?: number;
  isTeamBonus?: boolean;
  targetName?: string;
  // For celebration
  winningTeam?: any;
  // For on-deck indicator
  nextUser?: User;
  nextUserTeam?: Team;
}

export default function RefereeDisplayPage({ initialData }: { initialData?: DisplayData }) {
  // Don't use internal state - just use the prop directly
  const displayData = initialData || null;
  const [animatingStats, setAnimatingStats] = useState(false);
  const [revealedStats, setRevealedStats] = useState({
    attendance: false,
    one21s: false,
    referrals: false,
    tyfcb: false,
    visitors: false,
    total: false
  });
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);

  // Update animation state when displayData changes
  useEffect(() => {
    if (displayData?.type === 'DISPLAY_STATS') {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const showUserAudio = new Audio('/sounds/show-user.mp3');
      showUserAudio.volume = 0.5;
      showUserAudio.play().catch(err => console.log('Audio play failed:', err));
      setCurrentAudio(showUserAudio);

      // Start animation sequence
      setAnimatingStats(true);
      setRevealedStats({
        attendance: false,
        one21s: false,
        referrals: false,
        tyfcb: false,
        visitors: false,
        total: false
      });

      const metrics = displayData.score?.metrics || {
        attendance: 0,
        one21s: 0,
        referrals: 0,
        tyfcb: 0,
        visitors: 0
      };

      const categories = [
        { key: 'attendance', hasData: (metrics.attendance || 0) > 0 },
        { key: 'one21s', hasData: (metrics.one21s || 0) > 0 },
        { key: 'referrals', hasData: (metrics.referrals || 0) > 0 },
        { key: 'tyfcb', hasData: (metrics.tyfcb || 0) > 0 },
        { key: 'visitors', hasData: (metrics.visitors || 0) > 0 }
      ];

      const categoriesWithData = categories.filter(cat => cat.hasData);

      let currentDelay = 2000;
      categoriesWithData.forEach((category, index) => {
        const timeoutId = setTimeout(() => {
          setRevealedStats(prev => ({ ...prev, [category.key]: true }));

          const audio = new Audio('/sounds/stat-reveal.mp3');
          audio.volume = 0.5;
          audio.play().catch(err => console.log('Audio play failed:', err));
        }, currentDelay);
        timeoutIdsRef.current.push(timeoutId);
        currentDelay += 2000;
      });

      const finalTimeoutId = setTimeout(() => {
        setRevealedStats(prev => ({ ...prev, total: true }));

        const audio = new Audio('/sounds/total-reveal.mp3');
        audio.volume = 0.6;
        audio.play().catch(err => console.log('Audio play failed:', err));
      }, currentDelay);
      timeoutIdsRef.current.push(finalTimeoutId);
    }

    return () => {
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [displayData]);


  if (!displayData) {
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

  // Display User Profile
  if (displayData.type === 'DISPLAY_USER' && displayData.user && displayData.team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-12 relative overflow-hidden">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 max-w-4xl w-full relative z-10"
        >
          <div className="flex items-center gap-12">
            <motion.div
              initial={{ x: -50, scale: 0.5 }}
              animate={{ x: 0, scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="flex-shrink-0"
            >
              <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
                <Avatar
                  src={displayData.user.avatarUrl}
                  fallbackSeed={`${displayData.user.firstName}${displayData.user.lastName}`}
                  className="w-full h-full"
                  size="custom"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 50 }}
              animate={{ x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex-1"
            >
              <h1 className="text-5xl font-bold text-white mb-4">
                {displayData.user.firstName} {displayData.user.lastName}
              </h1>
              <div
                className="inline-block px-6 py-2 rounded-full text-2xl font-semibold text-white"
                style={{ backgroundColor: displayData.team.color }}
              >
                {displayData.team.name}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* On-Deck Indicator */}
        {displayData?.nextUser && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border-4 border-blue-500 p-4 max-w-xs z-[9999]">
            <div className="text-xs font-bold text-blue-600 mb-2 text-center uppercase tracking-wide">On Deck</div>
            <div className="flex items-center gap-3">
              <Avatar src={displayData.nextUser.avatarUrl} size="md" />
              <div>
                <p className="font-bold text-gray-900 text-lg">
                  {displayData.nextUser.firstName} {displayData.nextUser.lastName}
                </p>
                {displayData.nextUserTeam && (
                  <p
                    className="text-sm font-semibold px-2 py-0.5 rounded inline-block"
                    style={{
                      backgroundColor: displayData.nextUserTeam.color + '20',
                      color: displayData.nextUserTeam.color
                    }}
                  >
                    {displayData.nextUserTeam.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Display Stats Animation
  if (displayData.type === 'DISPLAY_STATS' && displayData.settings) {
    // Use default metrics if no score exists
    const metrics = displayData.score?.metrics || {
      attendance: 0,
      one21s: 0,
      referrals: 0,
      tyfcb: 0,
      visitors: 0
    };
    const points = displayData.settings?.pointValues || {};
    // Use totalPoints from score (includes custom bonuses), fallback to calculated
    const total = displayData.score?.totalPoints || (
      (metrics.attendance || 0) * (points.attendance || 0) +
      (metrics.one21s || 0) * (points.one21s || 0) +
      (metrics.referrals || 0) * (points.referrals || 0) +
      (metrics.tyfcb || 0) * (points.tyfcb || 0) +
      (metrics.visitors || 0) * (points.visitors || 0)
    );

    // Calculate delay for total score to appear after bonuses
    const bonusCount = displayData.score?.customBonuses?.length || 0;
    const totalScoreDelay = bonusCount > 0 ? 1.2 + bonusCount * 0.1 + 0.3 : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-12 relative overflow-hidden">
        <div className="max-w-7xl w-full space-y-8 relative z-10">
          {/* User Header with HUGE Avatar */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-center gap-12 mb-8"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.8 }}
              className="relative"
            >
              <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white/30 shadow-2xl">
                <Avatar
                  src={displayData.user?.avatarUrl}
                  fallbackSeed={`${displayData.user?.firstName}${displayData.user?.lastName}`}
                  className="w-full h-full"
                  size="custom"
                />
              </div>
              {/* Decorative glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 blur-3xl opacity-30 -z-10"></div>
            </motion.div>

            <div className="text-center text-white">
              <h1 className="text-6xl font-bold mb-3">
                {displayData.user?.firstName} {displayData.user?.lastName}
              </h1>
              {displayData.team && (
                <div
                  className="inline-block mt-4 px-6 py-3 rounded-full text-2xl font-semibold text-white"
                  style={{ backgroundColor: displayData.team.color }}
                >
                  {displayData.team.name}
                </div>
              )}
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-5 gap-6">
            <AnimatePresence>
              {/* Attendance */}
              <motion.div
                key="attendance"
                initial={metrics.attendance > 0 ? { scale: 0, rotate: -180 } : {}}
                animate={revealedStats.attendance && metrics.attendance > 0 ? { scale: 1, rotate: 0 } : {}}
                transition={{ type: "spring", duration: 0.6 }}
                className={`${metrics.attendance > 0 ? 'bg-white/10 backdrop-blur' : 'bg-transparent'} rounded-2xl p-6 text-center`}
              >
                <div className="text-4xl font-bold text-white mb-2">
                  {revealedStats.attendance && metrics.attendance > 0 ? metrics.attendance : ''}
                </div>
                {revealedStats.attendance && metrics.attendance > 0 && (
                  <div className="text-lg text-blue-200">Attendance</div>
                )}
                {revealedStats.attendance && metrics.attendance > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-yellow-400 mt-2"
                  >
                    {metrics.attendance * (points.attendance || 0)} pts
                  </motion.div>
                )}
              </motion.div>

              {/* 1-2-1s */}
              <motion.div
                key="one21s"
                initial={metrics.one21s > 0 ? { scale: 0, rotate: -180 } : {}}
                animate={revealedStats.one21s && metrics.one21s > 0 ? { scale: 1, rotate: 0 } : {}}
                transition={{ type: "spring", duration: 0.6 }}
                className={`${metrics.one21s > 0 ? 'bg-white/10 backdrop-blur' : 'bg-transparent'} rounded-2xl p-6 text-center`}
              >
                <div className="text-4xl font-bold text-white mb-2">
                  {revealedStats.one21s && metrics.one21s > 0 ? metrics.one21s : ''}
                </div>
                {revealedStats.one21s && metrics.one21s > 0 && (
                  <div className="text-lg text-blue-200">1-2-1s</div>
                )}
                {revealedStats.one21s && metrics.one21s > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-yellow-400 mt-2"
                  >
                    {metrics.one21s * (points.one21s || 0)} pts
                  </motion.div>
                )}
              </motion.div>

              {/* Referrals */}
              <motion.div
                key="referrals"
                initial={metrics.referrals > 0 ? { scale: 0, rotate: -180 } : {}}
                animate={revealedStats.referrals && metrics.referrals > 0 ? { scale: 1, rotate: 0 } : {}}
                transition={{ type: "spring", duration: 0.6 }}
                className={`${metrics.referrals > 0 ? 'bg-white/10 backdrop-blur' : 'bg-transparent'} rounded-2xl p-6 text-center`}
              >
                <div className="text-4xl font-bold text-white mb-2">
                  {revealedStats.referrals && metrics.referrals > 0 ? metrics.referrals : ''}
                </div>
                {revealedStats.referrals && metrics.referrals > 0 && (
                  <div className="text-lg text-blue-200">Referrals</div>
                )}
                {revealedStats.referrals && metrics.referrals > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-yellow-400 mt-2"
                  >
                    {metrics.referrals * (points.referrals || 0)} pts
                  </motion.div>
                )}
              </motion.div>

              {/* TYFCB */}
              <motion.div
                key="tyfcb"
                initial={metrics.tyfcb > 0 ? { scale: 0, rotate: -180 } : {}}
                animate={revealedStats.tyfcb && metrics.tyfcb > 0 ? { scale: 1, rotate: 0 } : {}}
                transition={{ type: "spring", duration: 0.6 }}
                className={`${metrics.tyfcb > 0 ? 'bg-white/10 backdrop-blur' : 'bg-transparent'} rounded-2xl p-6 text-center`}
              >
                <div className="text-4xl font-bold text-white mb-2">
                  {revealedStats.tyfcb && metrics.tyfcb > 0 ? metrics.tyfcb : ''}
                </div>
                {revealedStats.tyfcb && metrics.tyfcb > 0 && (
                  <div className="text-lg text-blue-200">TYFCB</div>
                )}
                {revealedStats.tyfcb && metrics.tyfcb > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-yellow-400 mt-2"
                  >
                    {metrics.tyfcb * (points.tyfcb || 0)} pts
                  </motion.div>
                )}
              </motion.div>

              {/* Visitors */}
              <motion.div
                key="visitors"
                initial={metrics.visitors > 0 ? { scale: 0, rotate: -180 } : {}}
                animate={revealedStats.visitors && metrics.visitors > 0 ? { scale: 1, rotate: 0 } : {}}
                transition={{ type: "spring", duration: 0.6 }}
                className={`${metrics.visitors > 0 ? 'bg-white/10 backdrop-blur' : 'bg-transparent'} rounded-2xl p-6 text-center`}
              >
                <div className="text-4xl font-bold text-white mb-2">
                  {revealedStats.visitors && metrics.visitors > 0 ? metrics.visitors : ''}
                </div>
                {revealedStats.visitors && metrics.visitors > 0 && (
                  <div className="text-lg text-blue-200">Visitors</div>
                )}
                {revealedStats.visitors && metrics.visitors > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-yellow-400 mt-2"
                  >
                    {metrics.visitors * (points.visitors || 0)} pts
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Custom Bonus Badges - Above total score */}
          {revealedStats.total && displayData.score?.customBonuses && displayData.score.customBonuses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="text-center"
            >
              <div className="text-xl text-white/80 mb-4">Bonus Awards</div>
              <div className="flex flex-wrap justify-center gap-3">
                {displayData.score.customBonuses.map((bonus, index) => (
                  <motion.div
                    key={index}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 1.2 + index * 0.1, type: "spring" }}
                    className="bg-white/20 backdrop-blur-lg px-5 py-3 rounded-full flex items-center gap-2 border border-white/30"
                  >
                    <Star className="text-yellow-300" size={24} />
                    <span className="text-white font-semibold text-lg">{bonus.bonusName}</span>
                    <span className="text-yellow-300 font-bold text-lg">+{bonus.points}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Total Score */}
          <AnimatePresence>
            {revealedStats.total && (
              <motion.div
                key="total-score"
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.8, delay: totalScoreDelay }}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl p-8 text-center"
              >
                <div className="text-2xl text-white/90 mb-2">TOTAL SCORE</div>
                <div className="text-7xl font-bold text-white">
                  {total} POINTS
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* On-Deck Indicator */}
        {displayData?.nextUser && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border-4 border-blue-500 p-4 max-w-xs z-[9999]">
            <div className="text-xs font-bold text-blue-600 mb-2 text-center uppercase tracking-wide">On Deck</div>
            <div className="flex items-center gap-3">
              <Avatar src={displayData.nextUser.avatarUrl} size="md" />
              <div>
                <p className="font-bold text-gray-900 text-lg">
                  {displayData.nextUser.firstName} {displayData.nextUser.lastName}
                </p>
                {displayData.nextUserTeam && (
                  <p
                    className="text-sm font-semibold px-2 py-0.5 rounded inline-block"
                    style={{
                      backgroundColor: displayData.nextUserTeam.color + '20',
                      color: displayData.nextUserTeam.color
                    }}
                  >
                    {displayData.nextUserTeam.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Team Leaderboard Display
  if (displayData.type === 'DISPLAY_TEAM_LEADERBOARD' && displayData.teams && displayData.scores && displayData.users) {
    // Get the set of revealed user IDs for quick lookup
    const revealedSet = new Set(displayData.revealedUserIds || []);

    // Calculate team totals - filter out teams without IDs
    const teamTotals = displayData.teams
      .filter(team => team.id) // Only include teams with valid IDs
      .map(team => {
      // Only include scores for revealed users
      const allTeamScores = displayData.scores!.filter(s => {
        const user = displayData.users!.find(u => u.id === s.userId);
        return user?.teamId === team.id;
      });

      const teamScores = allTeamScores.filter(s => revealedSet.has(s.userId));

      let total = 0;
      teamScores.forEach(score => {
        if (displayData.settings?.pointValues) {
          const points = displayData.settings.pointValues;
          const scorePoints =
            (score.metrics.attendance || 0) * (points.attendance || 0) +
            (score.metrics.one21s || 0) * (points.one21s || 0) +
            (score.metrics.referrals || 0) * (points.referrals || 0) +
            (score.metrics.tyfcb || 0) * (points.tyfcb || 0) +
            (score.metrics.visitors || 0) * (points.visitors || 0);

          total += scorePoints;
        }
      });

      // Don't add bonuses during progressive reveal - only show individual scores
      // Bonuses should only be calculated when ALL team members are revealed
      // to maintain suspense and fairness
      const allTeamMembers = displayData.users!.filter(u => u.teamId === team.id);
      const revealedTeamMembers = allTeamMembers.filter(u => u.id && revealedSet.has(u.id));

      // Only add bonuses if ALL team members have been revealed
      let bonusTotal = 0;
      if (displayData.settings?.bonusValues &&
          revealedTeamMembers.length === allTeamMembers.length &&
          revealedTeamMembers.length > 0) {

        const categories = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;
        categories.forEach(category => {
          // Check if all team members have points in this category
          const allHavePoints = revealedTeamMembers.every(member => {
            const score = teamScores.find(s => s.userId === member.id);
            return score && (score.metrics[category] || 0) > 0;
          });
          if (allHavePoints) {
            const bonus = displayData.settings.bonusValues[category] || 0;
            bonusTotal += bonus;
            total += bonus;
          }
        });
      }

      return { team, total: isNaN(total) ? 0 : total };
    }).sort((a, b) => b.total - a.total);

    // revealedSet is still in scope here for the render
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center text-white mb-12"
          >
            <h1 className="text-6xl font-bold mb-4">Team Standings</h1>
            <p className="text-2xl text-blue-200">Week {displayData.settings?.weekNumber || ''}</p>
          </motion.div>

          <div className="space-y-6">
            {teamTotals.map((item, index) => (
              <motion.div
                key={item.team.id || `team-${index}`}
                initial={{ x: index % 2 === 0 ? -100 : 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.2 }}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 flex items-center gap-8"
              >
                <div className="text-6xl font-bold text-white/50">
                  #{index + 1}
                </div>

                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold"
                  style={{ backgroundColor: item.team.color }}
                >
                  {item.team.name.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1">
                  <h2 className="text-4xl font-bold text-white">{item.team.name}</h2>
                  <p className="text-xl text-blue-200 mt-1">
                    {(() => {
                      // Count actual active team members from users list
                      const actualTeamMembers = displayData.users!.filter(u =>
                        u.teamId === item.team.id && u.role === 'member' && u.isActive
                      );
                      const revealedCount = actualTeamMembers.filter(u =>
                        u.id && revealedSet.has(u.id)
                      ).length;
                      const totalMembers = actualTeamMembers.length;

                      if (revealedCount === 0) {
                        return `${totalMembers} members (none shown yet)`;
                      }
                      return `${revealedCount} of ${totalMembers} members shown`;
                    })()}
                  </p>
                </div>

                <div className="text-right">
                  <div className={`text-5xl font-bold ${item.total > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {item.total}
                  </div>
                  <div className="text-lg text-blue-200">points</div>
                </div>

                {index === 0 && item.total > 0 && (
                  <Trophy className="text-yellow-400 animate-pulse" size={64} />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* On-Deck Indicator */}
        {displayData?.nextUser && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border-4 border-blue-500 p-4 max-w-xs z-[9999]">
            <div className="text-xs font-bold text-blue-600 mb-2 text-center uppercase tracking-wide">On Deck</div>
            <div className="flex items-center gap-3">
              <Avatar src={displayData.nextUser.avatarUrl} size="md" />
              <div>
                <p className="font-bold text-gray-900 text-lg">
                  {displayData.nextUser.firstName} {displayData.nextUser.lastName}
                </p>
                {displayData.nextUserTeam && (
                  <p
                    className="text-sm font-semibold px-2 py-0.5 rounded inline-block"
                    style={{
                      backgroundColor: displayData.nextUserTeam.color + '20',
                      color: displayData.nextUserTeam.color
                    }}
                  >
                    {displayData.nextUserTeam.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Display Team Bonus
  if (displayData.type === 'DISPLAY_TEAM_BONUS') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-12">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="text-center"
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
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-7xl font-bold mb-6"
            style={{ color: displayData.teamColor }}
          >
            {displayData.teamName}
          </motion.h1>

          {/* Bonus Title */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white text-4xl font-semibold mb-8"
          >
            Team Bonus!
          </motion.div>

          {/* Bonus Points */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="bg-yellow-400 text-black rounded-3xl px-16 py-12 mb-8 inline-block"
          >
            <div className="text-9xl font-bold">+{displayData.bonusTotal}</div>
            <div className="text-3xl font-semibold mt-2">Points</div>
          </motion.div>

          {/* Bonus Categories */}
          {displayData.bonusCategories && displayData.bonusCategories.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-4 justify-center"
            >
              {displayData.bonusCategories.map((category, index) => (
                <motion.div
                  key={category}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1, type: "spring" }}
                  className="bg-white/20 backdrop-blur-lg rounded-2xl px-8 py-4 text-white text-2xl font-semibold"
                >
                  {category === 'one21s' ? '1-2-1s All In' :
                   category === 'tyfcb' ? 'TYFCB All In' :
                   `${category.charAt(0).toUpperCase() + category.slice(1)} All In`}
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return null;
}