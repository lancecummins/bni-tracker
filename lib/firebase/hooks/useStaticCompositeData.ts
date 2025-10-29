// Static composite data hooks that fetch once and combine multiple data sources
import { useState, useEffect, useMemo } from 'react';
import { User, Score, Team, LeaderboardEntry, TeamStandings } from '@/lib/types';
import {
  useStaticUsers,
  useStaticTeams,
  useStaticSessionScores,
  useStaticActiveSession,
  useStaticSession,
  useStaticSettings
} from './useStaticData';
import { scoreService } from '@/lib/firebase/services';
import { revealedUsersStore } from '@/lib/utils/revealedUsersStore';
import { revealedBonusesStore } from '@/lib/utils/revealedBonusesStore';

export function useStaticLeaderboard(sessionId: string | null, usePublished: boolean = false, refreshKey?: number) {
  const { users, loading: usersLoading } = useStaticUsers();
  const { teams, loading: teamsLoading } = useStaticTeams();
  const { scores, loading: scoresLoading } = useStaticSessionScores(sessionId, refreshKey);
  const { settings, loading: settingsLoading } = useStaticSettings();
  const [revealedUserIds, setRevealedUserIds] = useState<Set<string>>(new Set());

  // Subscribe to revealed users changes
  useEffect(() => {
    setRevealedUserIds(revealedUsersStore.getShownUsers());
    const unsubscribe = revealedUsersStore.subscribe((userIds) => {
      setRevealedUserIds(new Set(userIds));
    });
    return unsubscribe;
  }, []);

  const loading = usersLoading || teamsLoading || scoresLoading || settingsLoading;

  const leaderboard = useMemo(() => {
    if (!sessionId || loading || !settings) return [];

    console.log('[useStaticLeaderboard] Recalculating with revealedUserIds:', Array.from(revealedUserIds));
    console.log('[useStaticLeaderboard] Total scores available:', scores.length);
    console.log('[useStaticLeaderboard] usePublished flag:', usePublished);

    // Filter scores based on published status if needed
    const filteredScores = usePublished
      ? scores.filter(s => !s.isDraft)
      : scores;

    console.log('[useStaticLeaderboard] Scores after filtering:', filteredScores.length);
    console.log('[useStaticLeaderboard] Draft scores filtered out:', scores.filter(s => s.isDraft).map(s => ({ userId: s.userId, isDraft: s.isDraft })));

    // Create a map of userId to score
    const scoreMap = new Map<string, Score>();
    filteredScores.forEach((score) => {
      scoreMap.set(score.userId, score);
    });

    console.log('[useStaticLeaderboard] Score map entries:', Array.from(scoreMap.entries()).map(([userId, score]) => ({
      userId,
      totalPoints: score.totalPoints,
      isDraft: score.isDraft
    })));

    // Debug Lindsey specifically
    const lindseyId = 'zLPJf1pXiPXnTessIKkx'; // From earlier logs
    const lindseyScore = scoreMap.get(lindseyId);
    if (lindseyScore) {
      console.log('[useStaticLeaderboard] Lindsey score found:', {
        totalPoints: lindseyScore.totalPoints,
        isDraft: lindseyScore.isDraft,
        metrics: lindseyScore.metrics
      });
    } else {
      console.log('[useStaticLeaderboard] No score found for Lindsey ID:', lindseyId);
    }

    // Create leaderboard entries - only for revealed users
    const entries: LeaderboardEntry[] = users
      .filter((user) => (user.role === 'member' || user.role === 'team-leader' || user.role === 'admin') && user.isActive && user.id && revealedUserIds.has(user.id))
      .map((user) => {
        const score = scoreMap.get(user.id!) || null;
        // Use teamId from the score if available (historical team assignment at time of scoring)
        // Otherwise fall back to user's current team
        const teamId = score?.teamId || user.teamId;
        const team = teams.find((t) => t.id === teamId) || null;

        // Use totalPoints from score (includes metrics + custom bonuses)
        const weeklyPoints = score?.totalPoints || 0;

        return {
          userId: user.id!,
          user,
          teamId: teamId || undefined,
          team: team || undefined,
          weeklyPoints: weeklyPoints,
          totalPoints: 0, // This would need cumulative calculation
          metrics: score?.metrics || {
            attendance: 0,
            one21s: 0,
            referrals: 0,
            tyfcb: 0,
            visitors: 0,
          },
          position: 0,
        };
      });

    // Sort by weekly points and assign positions
    entries.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
    entries.forEach((entry, index) => {
      entry.position = index + 1;
    });

    return entries;
  }, [users, teams, scores, settings, sessionId, loading, usePublished, revealedUserIds, refreshKey]);

  return { leaderboard, loading };
}

export function useStaticTeamStandings(sessionId: string | null, usePublished: boolean = false, refreshKey?: number) {
  const { teams, loading: teamsLoading } = useStaticTeams();
  const { users, loading: usersLoading } = useStaticUsers();
  const { scores, loading: scoresLoading } = useStaticSessionScores(sessionId, refreshKey);
  const { settings, loading: settingsLoading } = useStaticSettings();
  const { session, loading: sessionLoading } = useStaticSession(sessionId);
  const [revealedUserIds, setRevealedUserIds] = useState<Set<string>>(new Set());
  const [revealedBonusTeamIds, setRevealedBonusTeamIds] = useState<Set<string>>(new Set());

  // Subscribe to revealed users changes
  useEffect(() => {
    setRevealedUserIds(revealedUsersStore.getShownUsers());
    const unsubscribe = revealedUsersStore.subscribe((userIds) => {
      setRevealedUserIds(new Set(userIds));
    });
    return unsubscribe;
  }, []);

  // Subscribe to revealed bonuses changes
  useEffect(() => {
    setRevealedBonusTeamIds(revealedBonusesStore.getRevealedTeams());
    const unsubscribe = revealedBonusesStore.subscribe((teamIds) => {
      setRevealedBonusTeamIds(new Set(teamIds));
    });
    return unsubscribe;
  }, []);

  const loading = teamsLoading || usersLoading || scoresLoading || settingsLoading || sessionLoading;

  const standings = useMemo(() => {
    if (!sessionId || loading || !teams.length) return [];

    console.log('[useStaticTeamStandings] Recalculating with revealedUserIds:', Array.from(revealedUserIds));

    // Filter scores based on published status if needed
    const filteredScores = usePublished
      ? scores.filter(s => !s.isDraft)
      : scores;

    const teamStandings: TeamStandings[] = teams.map((team) => {
      // Get scores for this team (using historical teamId from scores, not current user.teamId)
      const teamScores = filteredScores.filter((score) => score.teamId === team.id);

      // Only include revealed team members
      const teamMembers = users.filter(
        (u) => (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin') &&
               u.isActive &&
               u.id &&
               revealedUserIds.has(u.id) &&
               teamScores.some((score) => score.userId === u.id)
      );

      console.log(`[useStaticTeamStandings] Team ${team.name}: ${teamMembers.length} revealed members`);

      // Calculate total points
      let weeklyPoints = teamScores
        .filter(score => revealedUserIds.has(score.userId))
        .reduce((total, score) => total + (score.totalPoints || 0), 0);

      console.log(`[useStaticTeamStandings] Team ${team.name}: weeklyPoints = ${weeklyPoints}`);

      // Calculate bonuses based on ALL team members who scored in this session
      // (using historical team assignment from scores)
      const allTeamMembers = users.filter(
        (u) => (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin') &&
               u.isActive &&
               teamScores.some((score) => score.userId === u.id)
      );

      let bonusPoints = 0;
      const bonusCategories: string[] = [];
      let customBonuses: { bonusName: string; points: number; teamId: string }[] = [];
      // Check if bonuses have been revealed by referee OR if session is closed
      const teamBonusRevealed = team.id && (revealedBonusTeamIds.has(team.id) || session?.status === 'closed');

      console.log(`[BONUS DEBUG] Team: ${team.name}, Status: ${session?.status}, Revealed: ${teamBonusRevealed}, AllMembers: ${allTeamMembers.length}, TeamScores: ${teamScores.length}`);

      // Calculate bonuses based on ALL team members (not just revealed ones)
      // But only show them if referee has revealed them OR session is finalized
      if (settings && allTeamMembers.length > 0 && teamBonusRevealed) {
        const categories = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;

        categories.forEach((category) => {
          // Check if all team members have points in this category
          const allMembersHaveCategory = allTeamMembers.every((member) => {
            const score = teamScores.find((s) => s.userId === member.id);
            const hasCategory = score && score.metrics[category] > 0;
            if (!hasCategory) {
              console.log(`[BONUS DEBUG] ${team.name} - Member ${member.firstName} missing ${category}`);
            }
            return hasCategory;
          });

          if (allMembersHaveCategory && settings.bonusValues) {
            console.log(`[BONUS DEBUG] ${team.name} - All In for ${category}! +${settings.bonusValues[category]} pts`);
            bonusPoints += settings.bonusValues[category];
            bonusCategories.push(category);
          }
        });

        // Add custom team bonuses
        if (session?.teamCustomBonuses) {
          customBonuses = session.teamCustomBonuses.filter(b => b.teamId === team.id);
          bonusPoints += customBonuses.reduce((sum, b) => sum + b.points, 0);
        }
      }

      return {
        teamId: team.id!,
        team,
        members: teamMembers.map((member) => {
          const score = teamScores.find((s) => s.userId === member.id);
          // Use teamId from score (historical assignment) if available
          const memberTeamId = score?.teamId || member.teamId;
          return {
            userId: member.id!,
            user: member,
            teamId: memberTeamId,
            team: team,
            weeklyPoints: score?.totalPoints || 0,
            totalPoints: score?.totalPoints || 0, // Would need cumulative calculation
            metrics: score?.metrics || {
              attendance: 0,
              one21s: 0,
              referrals: 0,
              tyfcb: 0,
              visitors: 0,
            },
            position: 0,
          } as LeaderboardEntry;
        }),
        weeklyPoints,
        bonusPoints,
        bonusCategories,
        customBonuses,
        totalPoints: 0, // Would need cumulative calculation
        weeklyWins: 0, // Would need historical calculation
        position: 0,
      };
    });

    // Sort by total weekly points (including bonuses) and assign positions
    teamStandings.sort((a, b) =>
      (b.weeklyPoints + (b.bonusPoints || 0)) - (a.weeklyPoints + (a.bonusPoints || 0))
    );

    teamStandings.forEach((standing, index) => {
      standing.position = index + 1;
      // Keep weeklyPoints and bonusPoints separate - don't combine them
    });

    return teamStandings;
  }, [teams, users, scores, settings, sessionId, loading, usePublished, revealedUserIds, revealedBonusTeamIds, session, refreshKey]);

  return { standings, loading };
}

// Simple week comparison that doesn't subscribe to real-time data
export function useStaticWeekComparison(sessionId: string | null) {
  const [userComparisons, setUserComparisons] = useState<any[]>([]);
  const [teamComparisons, setTeamComparisons] = useState<any[]>([]);
  const [hasPreviousWeek] = useState(false);
  const [loading] = useState(false);

  // For now, return empty comparisons since we don't have previous week data
  // This would need to be implemented with proper session fetching
  return {
    userComparisons,
    teamComparisons,
    loading,
    hasPreviousWeek
  };
}