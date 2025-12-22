import { useState, useEffect, useMemo } from 'react';
import { User, Score, Team, LeaderboardEntry, TeamStandings, BonusValues } from '@/lib/types';
import { useUsers } from './useUsers';
import { useTeams } from './useTeams';
import { useSessionScores } from './useScores';
import { usePublishedSessionScores } from './usePublishedScores';

export function useLeaderboard(sessionId: string | null, usePublished: boolean = false) {
  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();
  const { scores: allScores, loading: allScoresLoading } = useSessionScores(sessionId);
  const { scores: publishedScores, loading: publishedScoresLoading } = usePublishedSessionScores(sessionId);

  const scores = usePublished ? publishedScores : allScores;
  const scoresLoading = usePublished ? publishedScoresLoading : allScoresLoading;

  const loading = usersLoading || teamsLoading || scoresLoading;

  const leaderboard = useMemo(() => {
    if (!sessionId || loading) return [];

    // Create a map of userId to score
    const scoreMap = new Map<string, Score>();
    scores.forEach((score) => {
      scoreMap.set(score.userId, score);
    });

    // Create leaderboard entries
    const entries: LeaderboardEntry[] = users
      .filter((user) => (user.role === 'member' || user.role === 'team-leader') && user.isActive)
      .map((user) => {
        const score = scoreMap.get(user.id!) || null;
        // Use teamId from the score if available (historical team assignment at time of scoring)
        // Otherwise fall back to user's current team
        const teamId = score?.teamId || user.teamId;
        const team = teams.find((t) => t.id === teamId) || null;

        return {
          userId: user.id!,
          user,
          teamId: teamId || undefined,
          team: team || undefined,
          weeklyPoints: score?.totalPoints || 0,
          totalPoints: 0, // This would need cumulative calculation
          metrics: score?.metrics || {
            attendance: 0,
            one21s: 0,
            referrals: 0,
            tyfcb: 0,
            visitors: 0,
            ceu: 0,
          },
          position: 0,
        };
      })
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints);

    // Assign positions
    entries.forEach((entry, index) => {
      entry.position = index + 1;
    });

    return entries;
  }, [sessionId, users, teams, scores, loading]);

  return { leaderboard, loading };
}

// Helper function to calculate team bonuses
function calculateTeamBonuses(members: LeaderboardEntry[], bonusValues?: BonusValues): number {
  if (!bonusValues || members.length === 0) return 0;

  let totalBonus = 0;
  const categories: (keyof BonusValues)[] = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors', 'ceu'];

  // Check each category for "All In" bonus
  categories.forEach((category) => {
    // Check if ALL team members have at least 1 in this category
    const allMembersScored = members.every(member => member.metrics[category] >= 1);

    if (allMembersScored) {
      totalBonus += bonusValues[category];
    }
  });

  return totalBonus;
}

export function useTeamStandings(sessionId: string | null, usePublished: boolean = false) {
  const { teams, loading: teamsLoading } = useTeams();
  const { leaderboard, loading: leaderboardLoading } = useLeaderboard(sessionId, usePublished);

  const loading = teamsLoading || leaderboardLoading;

  // Default bonus values (will be replaced with values from Firebase in production)
  const defaultBonusValues: BonusValues = {
    attendance: 50,
    one21s: 50,
    referrals: 100,
    tyfcb: 75,
    visitors: 50,
    ceu: 50,
  };

  const standings = useMemo(() => {
    if (!sessionId || loading) return [];

    // Group leaderboard entries by team
    const teamMap = new Map<string, LeaderboardEntry[]>();
    leaderboard.forEach((entry) => {
      if (entry.teamId) {
        if (!teamMap.has(entry.teamId)) {
          teamMap.set(entry.teamId, []);
        }
        teamMap.get(entry.teamId)!.push(entry);
      }
    });

    // Create team standings with bonuses
    const teamStandings: TeamStandings[] = teams
      .map((team) => {
        const members = teamMap.get(team.id!) || [];
        const individualPoints = members.reduce((sum, member) => sum + member.weeklyPoints, 0);
        const bonusPoints = calculateTeamBonuses(members, defaultBonusValues);
        const weeklyPoints = individualPoints + bonusPoints;
        const totalPoints = members.reduce((sum, member) => sum + member.totalPoints, 0) + bonusPoints;

        return {
          teamId: team.id!,
          team,
          weeklyPoints,
          totalPoints,
          weeklyWins: team.weeklyWins || 0,
          members,
          bonusPoints, // Track bonus points separately
          position: 0, // Will be set after sorting
        };
      })
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints);

    // Set positions after sorting
    teamStandings.forEach((standing, index) => {
      standing.position = index + 1;
    });

    return teamStandings;
  }, [sessionId, teams, leaderboard, loading]);

  return { standings, loading };
}