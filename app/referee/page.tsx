'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUsers } from '@/lib/firebase/hooks/useUsers';
import { useTeams } from '@/lib/firebase/hooks/useTeams';
import { useActiveSession } from '@/lib/firebase/hooks/useSessions';
import { useAllSessions } from '@/lib/firebase/hooks';
import { useSessionScores } from '@/lib/firebase/hooks/useScores';
import { useSettings } from '@/lib/firebase/hooks/useSettings';
import { User, Team, Score, Session, CustomBonus, AwardedCustomBonus, TeamCustomBonus } from '@/lib/types';
import { doc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Monitor, Play, Users as UsersIcon, Trophy, Eye, Check, CheckCircle, Gift, BarChart3, Award, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { shownUsersStore } from '@/lib/utils/revealedUsersStore';
import { revealedBonusesStore } from '@/lib/utils/revealedBonusesStore';
import { displayChannel } from '@/lib/utils/displayChannel';
import { timerChannel } from '@/lib/utils/timerChannel';

export default function RefereePage() {
  const { users } = useUsers();
  const { teams } = useTeams();
  const { session: activeSession } = useActiveSession();
  const { sessions: allSessions } = useAllSessions();
  const { settings } = useSettings();

  // State for selected session - use active session as default
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Load saved session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('referee_selected_session');
    if (savedSessionId) {
      setSelectedSessionId(savedSessionId);
    } else if (activeSession?.id) {
      setSelectedSessionId(activeSession.id);
    }
  }, [activeSession]);

  // Update selected session when ID changes
  useEffect(() => {
    if (selectedSessionId) {
      const session = allSessions.find(s => s.id === selectedSessionId) || null;
      setSelectedSession(session);
      localStorage.setItem('referee_selected_session', selectedSessionId);
    } else {
      setSelectedSession(null);
    }
  }, [selectedSessionId, allSessions]);

  const { scores } = useSessionScores(selectedSession?.id || null);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [displayMode, setDisplayMode] = useState<'waiting' | 'user' | 'stats' | 'team'>('waiting');
  const [searchTerm, setSearchTerm] = useState('');
  const [shownUserIds, setShownUserIds] = useState<Set<string>>(new Set());
  const [revealedBonusTeamIds, setRevealedBonusTeamIds] = useState<Set<string>>(new Set());
  const [showAwardBonusModal, setShowAwardBonusModal] = useState(false);
  const [awardBonusTarget, setAwardBonusTarget] = useState<{ type: 'individual' | 'team', user: User, team?: Team } | null>(null);
  const [selectedBonus, setSelectedBonus] = useState<CustomBonus | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'shown' | 'not-shown' | 'no-score'>('all');
  const [sortMode, setSortMode] = useState<'team' | 'name' | 'points' | 'random'>('team');
  const [randomOrder, setRandomOrder] = useState<string[]>([]);
  const [currentUserIndex, setCurrentUserIndex] = useState<number>(0);

  // Helper function to get localStorage key for shown users
  const getShownUsersKey = (sessionId: string) => `referee_shown_users_${sessionId}`;

  // Load shown users from localStorage when session changes
  useEffect(() => {
    if (selectedSessionId) {
      const key = getShownUsersKey(selectedSessionId);
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const userIds = JSON.parse(saved) as string[];
          setShownUserIds(new Set(userIds));
          // Update the store for broadcast to other windows
          userIds.forEach(id => shownUsersStore.showUser(id));
        } catch (e) {
          console.error('Failed to load shown users from localStorage', e);
        }
      } else {
        setShownUserIds(new Set());
        shownUsersStore.clearShown();
      }
    }
  }, [selectedSessionId]);

  // Save shown users to localStorage when they change
  const saveShownUsers = useCallback((userIds: Set<string>) => {
    if (selectedSessionId) {
      const key = getShownUsersKey(selectedSessionId);
      localStorage.setItem(key, JSON.stringify(Array.from(userIds)));
    }
  }, [selectedSessionId]);

  // Subscribe to shown users changes from store (for cross-tab sync)
  useEffect(() => {
    const unsubscribe = shownUsersStore.subscribe((userIds) => {
      setShownUserIds(new Set(userIds));
      saveShownUsers(new Set(userIds));
    });
    return unsubscribe;
  }, [saveShownUsers]);

  // Subscribe to revealed bonuses changes
  useEffect(() => {
    setRevealedBonusTeamIds(revealedBonusesStore.getRevealedTeams());
    const unsubscribe = revealedBonusesStore.subscribe((teamIds) => {
      setRevealedBonusTeamIds(new Set(teamIds));
    });
    return unsubscribe;
  }, []);

  // Get active members and team leaders
  const activeMembers = users
    .filter(u => u.isActive && (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin'));

  // Apply filters
  const filteredByMode = activeMembers.filter(member => {
    const isShown = member.id && shownUserIds.has(member.id);
    const hasScore = scores.some(s => s.userId === member.id);

    switch (filterMode) {
      case 'shown':
        return isShown;
      case 'not-shown':
        return !isShown;
      case 'no-score':
        return !hasScore;
      case 'all':
      default:
        return true;
    }
  });

  // Filter by search term
  const searchFiltered = filteredByMode.filter(member => {
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const team = teams.find(t => t.id === member.teamId);
    const teamName = team?.name.toLowerCase() || '';
    return fullName.includes(searchTerm.toLowerCase()) || teamName.includes(searchTerm.toLowerCase());
  });

  // Generate round-robin random order when switching to random mode
  useEffect(() => {
    if (sortMode === 'random' && randomOrder.length === 0) {
      // Group users by team
      const usersByTeam = new Map<string, User[]>();
      searchFiltered.forEach(user => {
        const teamId = user.teamId || 'no-team';
        if (!usersByTeam.has(teamId)) {
          usersByTeam.set(teamId, []);
        }
        usersByTeam.get(teamId)!.push(user);
      });

      // Randomize order within each team
      usersByTeam.forEach((members, teamId) => {
        usersByTeam.set(teamId, members.sort(() => Math.random() - 0.5));
      });

      // Round-robin through teams
      const roundRobinOrder: string[] = [];
      const teamIds = Array.from(usersByTeam.keys());
      let hasMore = true;
      let index = 0;

      while (hasMore) {
        hasMore = false;
        for (const teamId of teamIds) {
          const members = usersByTeam.get(teamId)!;
          if (index < members.length) {
            roundRobinOrder.push(members[index].id!);
            hasMore = true;
          }
        }
        index++;
      }

      setRandomOrder(roundRobinOrder);
    }
  }, [sortMode, searchFiltered, randomOrder.length]);

  // Helper function to get user score
  const getUserScore = (userId: string) => {
    const score = scores.find(s => s.userId === userId);
    if (!score || !settings) return 0;

    const metricsTotal = (
      ((score.metrics.attendance || 0) * (settings.pointValues.attendance || 0)) +
      ((score.metrics.one21s || 0) * (settings.pointValues.one21s || 0)) +
      ((score.metrics.referrals || 0) * (settings.pointValues.referrals || 0)) +
      ((score.metrics.tyfcb || 0) * (settings.pointValues.tyfcb || 0)) +
      ((score.metrics.visitors || 0) * (settings.pointValues.visitors || 0))
    );

    const customBonusTotal = (score.customBonuses || []).reduce((sum, bonus) => sum + bonus.points, 0);

    return metricsTotal + customBonusTotal;
  };

  // Apply sorting
  const filteredMembers = searchFiltered.sort((a, b) => {
    switch (sortMode) {
      case 'random':
        const aIndex = randomOrder.indexOf(a.id!);
        const bIndex = randomOrder.indexOf(b.id!);
        return aIndex - bIndex;
      case 'name':
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'points':
        const aPoints = getUserScore(a.id!);
        const bPoints = getUserScore(b.id!);
        return bPoints - aPoints; // Descending order
      case 'team':
      default:
        // Sort by team first, then by name
        if (a.teamId !== b.teamId) {
          return (a.teamId || '').localeCompare(b.teamId || '');
        }
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    }
  });

  const nextUser = currentUserIndex < filteredMembers.length - 1 ? filteredMembers[currentUserIndex + 1] : null;

  const handleDisplayUser = async (user: User, userIndex?: number) => {
    console.log('handleDisplayUser called with:', user.firstName, user.lastName);
    setSelectedUser(user);
    setDisplayMode('user');

    if (userIndex !== undefined) {
      setCurrentUserIndex(userIndex);
    }

    // Mark user as shown
    if (user.id) {
      shownUsersStore.showUser(user.id);
    }

    // Calculate next user
    const actualIndex = userIndex !== undefined ? userIndex : currentUserIndex;
    const nextUserInList = actualIndex < filteredMembers.length - 1 ? filteredMembers[actualIndex + 1] : null;

    // Send to API endpoint for cross-device communication
    try {
      const payload = {
        type: 'DISPLAY_USER',
        user: user,
        team: teams.find(t => t.id === user.teamId),
        shownUserIds: Array.from(shownUsersStore.getShownUsers()),
        nextUser: nextUserInList,
        nextUserTeam: nextUserInList ? teams.find(t => t.id === nextUserInList.teamId) : null
      };

      // Send via API (for SSE broadcast)
      const response = await fetch('/api/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Also send via broadcast channel (for same-browser tabs)
      displayChannel.send(payload);

      if (response.ok) {
        toast.success('Displaying user on screen');
      } else {
        toast.error('Failed to update display');
      }
    } catch (error) {
      toast.error('Failed to update display');
    }
  };

  const handleDisplayStats = async (user: User, userIndex?: number) => {
    console.log('handleDisplayStats called for:', user.firstName, user.lastName);
    setSelectedUser(user);
    setDisplayMode('stats');

    if (userIndex !== undefined) {
      setCurrentUserIndex(userIndex);
    }

    const score = scores.find(s => s.userId === user.id);
    const userSettings = settings;

    // Mark user as shown
    if (user.id) {
      shownUsersStore.showUser(user.id);
    }

    // Calculate next user
    const actualIndex = userIndex !== undefined ? userIndex : currentUserIndex;
    const nextUserInList = actualIndex < filteredMembers.length - 1 ? filteredMembers[actualIndex + 1] : null;

    // Send stats to display
    try {
      const payload = {
        type: 'DISPLAY_STATS',
        user: user,
        team: teams.find(t => t.id === user.teamId),
        score: score,
        settings: userSettings,
        shownUserIds: Array.from(shownUsersStore.getShownUsers()),
        nextUser: nextUserInList,
        nextUserTeam: nextUserInList ? teams.find(t => t.id === nextUserInList.teamId) : null
      };

      // Send via API (for SSE broadcast)
      await fetch('/api/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Also send via broadcast channel (for same-browser tabs)
      displayChannel.send(payload);

      toast.success('Displaying stats animation');
    } catch (error) {
      toast.error('Failed to update display');
    }
  };

  const handleDisplayTeam = async () => {
    console.log('handleDisplayTeam called');
    setDisplayMode('team');

    const shownUserIdsList = Array.from(shownUsersStore.getShownUsers());
    const revealedBonusTeamIdsList = Array.from(revealedBonusesStore.getRevealedTeams());

    // Send team leaderboard to display
    try {
      await fetch('/api/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DISPLAY_TEAM_LEADERBOARD',
          teams: teams,
          scores: scores,
          users: users,
          settings: settings,
          revealedUserIds: shownUserIdsList,
          revealedBonusTeamIds: revealedBonusTeamIdsList
        })
      });

      toast.success('Displaying team leaderboard');

      // After 5 seconds, go back to default display
      setTimeout(async () => {
        setDisplayMode('waiting');
        await fetch('/api/display', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'CLEAR_DISPLAY',
            shownUserIds: Array.from(shownUsersStore.getShownUsers())
          })
        });
      }, 5000);
    } catch (error) {
      toast.error('Failed to update display');
    }
  };

  const handleFullScoreboard = async () => {
    console.log('handleFullScoreboard called');

    // Clear the display to show the main scoreboard
    try {
      await fetch('/api/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CLEAR_DISPLAY',
          shownUserIds: Array.from(shownUsersStore.getShownUsers()),
          revealedBonusTeamIds: Array.from(revealedBonusesStore.getRevealedTeams())
        })
      });

      setDisplayMode('waiting');
      toast.success('Showing full scoreboard');
    } catch (error) {
      toast.error('Failed to update display');
    }
  };

  const handleCelebrateWinningTeam = async () => {
    console.log('handleCelebrateWinningTeam called');

    // Find the winning team (highest points)
    const teamStandings = teams.map(team => {
      const teamScores = scores.filter(score => {
        const user = users.find(u => u.id === score.userId);
        return user?.teamId === team.id;
      });

      const weeklyPoints = teamScores.reduce((sum, score) => sum + score.totalPoints, 0);
      const bonuses = team.id ? getTeamBonuses(team.id) : { total: 0, categories: [] };
      const bonusPoints = bonuses.total;
      const totalPoints = weeklyPoints + bonusPoints;

      return {
        team,
        members: users.filter(u => u.teamId === team.id),
        scores: teamScores,
        weeklyPoints,
        bonusPoints,
        totalPoints
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    const winningTeam = teamStandings[0];

    if (!winningTeam) {
      toast.error('No winning team found');
      return;
    }

    // Send celebration to display
    try {
      await fetch('/api/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CELEBRATE_WINNING_TEAM',
          winningTeam: winningTeam,
          settings: settings
        })
      });

      toast.success(`Celebrating ${winningTeam.team.name}!`);
    } catch (error) {
      toast.error('Failed to show celebration');
    }
  };

  const handleDisplayTeamBonus = async (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const bonuses = getTeamBonuses(teamId);

    // Mark as revealed
    revealedBonusesStore.revealTeamBonus(teamId);

    // Build complete list of bonus categories (both built-in and custom)
    const allBonusCategories = [
      ...bonuses.categories,
      ...bonuses.customBonuses.map(cb => cb.bonusName)
    ];

    // Send bonus details to display
    try {
      await fetch('/api/display', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DISPLAY_TEAM_BONUS',
          teamId: teamId,
          teamName: team.name,
          teamColor: team.color,
          bonusTotal: bonuses.total,
          bonusCategories: allBonusCategories,
          revealedBonusTeamIds: Array.from(revealedBonusesStore.getRevealedTeams())
        })
      });

      toast.success(`Displaying ${team.name} bonus on screen!`);
    } catch (error) {
      toast.error('Failed to display bonus');
    }
  };

  const getTeamBonuses = (teamId: string) => {
    if (!settings) return { total: 0, categories: [], customBonuses: [] };

    const teamMembers = users.filter(u => u.teamId === teamId && (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin') && u.isActive);
    const teamScores = scores.filter(s => teamMembers.some(m => m.id === s.userId));

    let bonusPoints = 0;
    const categories: string[] = [];

    // "All In" bonuses
    if (teamScores.length === teamMembers.length && teamMembers.length > 0) {
      const categoryList = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;

      categoryList.forEach(category => {
        const allMembersHaveCategory = teamMembers.every(member => {
          const score = scores.find(s => s.userId === member.id);
          return score && score.metrics[category] > 0;
        });

        if (allMembersHaveCategory && settings.bonusValues) {
          bonusPoints += settings.bonusValues[category];
          categories.push(category);
        }
      });
    }

    // Custom team bonuses from session
    const customBonuses = selectedSession?.teamCustomBonuses?.filter(b => b.teamId === teamId) || [];
    const customBonusTotal = customBonuses.reduce((sum, b) => sum + b.points, 0);
    bonusPoints += customBonusTotal;

    return { total: bonusPoints, categories, customBonuses };
  };

  const handleAwardBonus = async () => {
    if (!selectedBonus || !awardBonusTarget || !selectedSession) {
      toast.error('Please select a bonus');
      return;
    }

    const awardedBonus: AwardedCustomBonus = {
      bonusId: selectedBonus.id!,
      bonusName: selectedBonus.name,
      points: selectedBonus.points,
      awardedBy: 'referee',
      awardedAt: Timestamp.now(),
    };

    try {
      if (awardBonusTarget.type === 'individual') {
        const userScore = scores.find(s => s.userId === awardBonusTarget.user.id);
        if (userScore) {
          const updatedCustomBonuses = [...(userScore.customBonuses || []), awardedBonus];
          const customBonusTotal = updatedCustomBonuses.reduce((sum, b) => sum + b.points, 0);
          const metricsTotal = (
            ((userScore.metrics.attendance || 0) * (settings!.pointValues.attendance || 0)) +
            ((userScore.metrics.one21s || 0) * (settings!.pointValues.one21s || 0)) +
            ((userScore.metrics.referrals || 0) * (settings!.pointValues.referrals || 0)) +
            ((userScore.metrics.tyfcb || 0) * (settings!.pointValues.tyfcb || 0)) +
            ((userScore.metrics.visitors || 0) * (settings!.pointValues.visitors || 0))
          );

          await updateDoc(doc(db, 'scores', userScore.id!), {
            customBonuses: updatedCustomBonuses,
            totalPoints: metricsTotal + customBonusTotal,
            updatedAt: Timestamp.now(),
          });

          toast.success(`Awarded ${selectedBonus.name} (+${selectedBonus.points} pts) to ${awardBonusTarget.user.firstName} ${awardBonusTarget.user.lastName}`);
        } else {
          toast.error('No score found for this user');
        }
      } else {
        // Award team bonus to session instead of individual scores
        const teamBonus: TeamCustomBonus = {
          teamId: awardBonusTarget.team!.id!,
          bonusId: selectedBonus.id!,
          bonusName: selectedBonus.name,
          points: selectedBonus.points,
          awardedBy: 'referee',
          awardedAt: Timestamp.now(),
        };

        await updateDoc(doc(db, 'sessions', selectedSession.id!), {
          teamCustomBonuses: arrayUnion(teamBonus)
        });

        toast.success(`Awarded ${selectedBonus.name} to ${awardBonusTarget.team?.name} - Use "Display Bonus" button to show it`);
      }

      setShowAwardBonusModal(false);
      setAwardBonusTarget(null);
      setSelectedBonus(null);
    } catch (error) {
      console.error('Error awarding bonus:', error);
      toast.error('Failed to award bonus');
    }
  };

  const openDisplayWindow = () => {
    window.open('/display', 'display', 'width=1920,height=1080');
  };

  const openLogoWindow = () => {
    window.open('/logo', 'logo', 'width=1920,height=1080');
  };

  const handleTimerStart = () => {
    timerChannel.send({ type: 'TIMER_START' });
    toast.success('Timer started');
  };

  const handleTimerPause = () => {
    timerChannel.send({ type: 'TIMER_PAUSE' });
    toast.success('Timer paused');
  };

  const handleTimerReset = () => {
    timerChannel.send({ type: 'TIMER_RESET' });
    toast.success('Timer reset');
  };

  const getScoreStatus = (userId: string) => {
    const score = scores.find(s => s.userId === userId);
    if (!score) return 'missing';
    if (score.isDraft) return 'draft';
    return 'published';
  };

  if (allSessions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">No Sessions Available</h2>
          <p className="text-gray-500 mt-2">Please wait for an admin to create a session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with Top Controls */}
      <div className="sticky top-0 z-10 bg-white shadow-md">
        <div className="p-4">
          {/* Title and Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Image
                src="/bni-game-logo.png"
                alt="BNI Game"
                width={60}
                height={60}
                className="object-contain"
                priority
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {selectedSession?.name || 'Game Referee'}
                </h1>
                <p className="text-sm text-gray-600">
                  {selectedSession ? `${new Date(selectedSession.date.seconds * 1000).toLocaleDateString()} • ` : ''}
                  {shownUserIds.size}/{filteredMembers.length} shown
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openDisplayWindow}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm"
              >
                <Monitor size={16} />
                <span className="hidden sm:inline">Display</span>
              </button>
              <button
                onClick={openLogoWindow}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
              >
                <Trophy size={16} />
                <span className="hidden sm:inline">Logo</span>
              </button>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center justify-between mb-3 bg-gradient-to-r from-blue-100 to-purple-100 p-3 rounded-lg">
            <span className="text-sm font-semibold text-gray-700">Logo Timer Controls</span>
            <div className="flex gap-2">
              <button
                onClick={handleTimerStart}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
              >
                Start
              </button>
              <button
                onClick={handleTimerPause}
                className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700"
              >
                Pause
              </button>
              <button
                onClick={handleTimerReset}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Session Selector */}
          <div className="mb-3">
            <select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-base"
            >
              <option value="">Select a Session</option>
              {allSessions.filter(session => !session.isArchived).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name || `Week ${session.weekNumber}`} - {new Date(session.date.seconds * 1000).toLocaleDateString()}
                  {session.status === 'open' ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Main Control Buttons */}
          <div className="mb-3 space-y-2 mt-3">
            <button
              onClick={handleFullScoreboard}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-base font-medium"
            >
              <BarChart3 size={20} />
              Show Full Scoreboard
            </button>
            <button
              onClick={handleCelebrateWinningTeam}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-base font-medium"
            >
              <Trophy size={20} />
              Celebrate Winning Team
            </button>
          </div>

          {/* Filter and Sort Controls */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            >
              <option value="all">All Members</option>
              <option value="not-shown">Not Shown</option>
              <option value="shown">Already Shown</option>
              <option value="no-score">No Score</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            >
              <option value="team">Sort by Team</option>
              <option value="name">Sort by Name</option>
              <option value="points">Sort by Points</option>
              <option value="random">Sort by Random</option>
            </select>
          </div>

          {/* Search and Reset */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear the scoreboard?')) {
                  shownUsersStore.clearShown();
                  revealedBonusesStore.clearRevealed();
                  toast.success('Reset all');
                }
              }}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Member List */}
      <div className="p-4 max-w-4xl mx-auto pb-32">
        {sortMode === 'team' ? (
          // Group by team
          teams.map(team => {
            const teamMembers = filteredMembers.filter(m => m.teamId === team.id);
            if (teamMembers.length === 0) return null;

            const bonuses = getTeamBonuses(team.id!);
            const isRevealed = team.id && revealedBonusTeamIds.has(team.id);

            return (
              <div key={team.id} className="mb-6">
              {/* Team Header */}
              <div className="mb-2">
                <div
                  className="font-medium text-sm px-3 py-2 rounded-t-lg"
                  style={{ backgroundColor: team.color || '#ccc', color: '#fff' }}
                >
                  {team.name}
                </div>

                {/* Team Bonuses */}
                {bonuses.total > 0 && (
                  <div className={`px-3 py-2 border-x border-b ${
                    isRevealed
                      ? 'bg-green-100 border-green-300'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gift size={16} className={isRevealed ? 'text-green-600' : 'text-yellow-600'} />
                        <span className={`text-sm font-semibold ${isRevealed ? 'text-green-700' : 'text-yellow-700'}`}>
                          +{bonuses.total} bonus points
                        </span>
                        {bonuses.categories.length > 0 && (
                          <span className="text-xs text-gray-600">
                            ({bonuses.categories.map(c =>
                              c === 'one21s' ? '1-2-1s' :
                              c === 'tyfcb' ? 'TYFCB' :
                              c.charAt(0).toUpperCase() + c.slice(1)
                            ).join(', ')})
                          </span>
                        )}
                        {bonuses.customBonuses && bonuses.customBonuses.length > 0 && (
                          <span className="text-xs text-gray-600">
                            + {bonuses.customBonuses.map(cb => cb.bonusName).join(', ')}
                          </span>
                        )}
                      </div>
                      {isRevealed ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <button
                          onClick={() => handleDisplayTeamBonus(team.id!)}
                          className="px-3 py-1 bg-yellow-600 text-white text-xs font-medium rounded hover:bg-yellow-700 transition-colors"
                        >
                          Display Bonus
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Team Members */}
              <div className="space-y-2">
                {teamMembers.map(member => {
                  const scoreStatus = getScoreStatus(member.id!);
                  const totalPoints = getUserScore(member.id!);
                  const isShown = member.id && shownUserIds.has(member.id);

                  return (
                    <div
                      key={member.id}
                      className={`bg-white rounded-lg border-2 p-3 ${
                        isShown ? 'border-green-400 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      {/* User Info Row */}
                      <div className="flex items-center gap-3 mb-3">
                        {isShown ? (
                          <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}

                        <Avatar
                          src={member.avatarUrl}
                          fallbackSeed={`${member.firstName}${member.lastName}`}
                          size="sm"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {member.firstName} {member.lastName}
                            </p>
                            {isShown && (
                              <span className="text-xs text-green-600 font-medium flex-shrink-0">SHOWN</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`px-1.5 py-0.5 rounded ${
                              scoreStatus === 'published' ? 'bg-green-100 text-green-700' :
                              scoreStatus === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {scoreStatus === 'published' ? 'Ready' :
                               scoreStatus === 'draft' ? 'Draft' :
                               'No Score'}
                            </span>
                            {scoreStatus !== 'missing' && (
                              <span className="text-gray-600 font-semibold">{totalPoints} pts</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleDisplayUser(member, teamMembers.indexOf(member))}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          <Eye size={16} />
                          Show User
                        </button>
                        <button
                          onClick={() => handleDisplayStats(member, teamMembers.indexOf(member))}
                          disabled={scoreStatus === 'missing'}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                        >
                          <Play size={16} />
                          Display Stats
                        </button>
                        <button
                          onClick={() => {
                            setAwardBonusTarget({ type: 'individual', user: member, team: teams.find(t => t.id === member.teamId) });
                            setShowAwardBonusModal(true);
                          }}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                        >
                          <Award size={16} />
                          Bonus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team-wide Bonus Button */}
              <div className="mt-2">
                <button
                  onClick={() => {
                    if (teamMembers.length > 0) {
                      setAwardBonusTarget({ type: 'team', user: teamMembers[0], team });
                      setShowAwardBonusModal(true);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  <Award size={16} />
                  Award Bonus to Entire Team
                </button>
              </div>
            </div>
          );
        })
        ) : (
          // Flat list for other sort modes
          <div className="space-y-2">
            {filteredMembers.map((member, index) => {
              const scoreStatus = getScoreStatus(member.id!);
              const totalPoints = getUserScore(member.id!);
              const isShown = member.id && shownUserIds.has(member.id);
              const memberTeam = teams.find(t => t.id === member.teamId);

              return (
                <div
                  key={member.id}
                  className={`bg-white rounded-lg border-2 p-3 ${
                    isShown ? 'border-green-400 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  {/* User Info Row */}
                  <div className="flex items-center gap-3 mb-3">
                    {isShown ? (
                      <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}

                    <Avatar
                      src={member.avatarUrl}
                      fallbackSeed={`${member.firstName}${member.lastName}`}
                      size="sm"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        {isShown && (
                          <span className="text-xs text-green-600 font-medium flex-shrink-0">SHOWN</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {memberTeam && (
                          <span
                            className="px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: memberTeam.color + '20', color: memberTeam.color }}
                          >
                            {memberTeam.name}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded ${
                          scoreStatus === 'published' ? 'bg-green-100 text-green-700' :
                          scoreStatus === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {scoreStatus === 'published' ? 'Ready' :
                           scoreStatus === 'draft' ? 'Draft' :
                           'No Score'}
                        </span>
                        {scoreStatus !== 'missing' && (
                          <span className="text-gray-600 font-semibold">{totalPoints} pts</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleDisplayUser(member, index)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Eye size={16} />
                      Show User
                    </button>
                    <button
                      onClick={() => handleDisplayStats(member, index)}
                      disabled={scoreStatus === 'missing'}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                    >
                      <Play size={16} />
                      Display Stats
                    </button>
                    <button
                      onClick={() => {
                        setAwardBonusTarget({ type: 'individual', user: member, team: memberTeam });
                        setShowAwardBonusModal(true);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      <Award size={16} />
                      Bonus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredMembers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No members found matching "{searchTerm}"</p>
          </div>
        )}
      </div>

      {/* Award Bonus Modal */}
      {showAwardBonusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Award className="text-purple-600" />
                Award Custom Bonus
              </h2>
              <button
                onClick={() => {
                  setShowAwardBonusModal(false);
                  setAwardBonusTarget(null);
                  setSelectedBonus(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Award to: <span className="font-semibold">
                  {awardBonusTarget?.type === 'individual'
                    ? `${awardBonusTarget.user.firstName} ${awardBonusTarget.user.lastName}`
                    : `All members of ${awardBonusTarget?.team?.name}`
                  }
                </span>
              </p>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setAwardBonusTarget(prev => prev ? { ...prev, type: 'individual' } : null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    awardBonusTarget?.type === 'individual'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Individual
                </button>
                <button
                  onClick={() => setAwardBonusTarget(prev => prev ? { ...prev, type: 'team' } : null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    awardBonusTarget?.type === 'team'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Entire Team
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Bonus
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {settings?.customBonuses?.filter(b => !b.isArchived).map(bonus => (
                  <button
                    key={bonus.id}
                    onClick={() => setSelectedBonus(bonus)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      selectedBonus?.id === bonus.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{bonus.name}</span>
                      <span className="text-purple-600 font-bold">+{bonus.points} pts</span>
                    </div>
                  </button>
                ))}
                {(!settings?.customBonuses || settings.customBonuses.filter(b => !b.isArchived).length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No custom bonuses available. Create one in Settings first.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAwardBonusModal(false);
                  setAwardBonusTarget(null);
                  setSelectedBonus(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAwardBonus}
                disabled={!selectedBonus}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Award Bonus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}