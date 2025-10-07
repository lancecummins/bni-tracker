import { useState, useEffect, useMemo } from 'react';
import { Score, Session } from '@/lib/types';
import { scoreService, sessionService } from '@/lib/firebase/services';
import { useSeasonSessions } from './useSessions';

interface WeekComparison {
  userId: string;
  currentWeekPoints: number;
  previousWeekPoints: number;
  change: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'same';
}

interface TeamWeekComparison {
  teamId: string;
  currentWeekPoints: number;
  previousWeekPoints: number;
  change: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'same';
}

export function useWeekComparison(currentSessionId: string | null, seasonId: string | null) {
  const [currentScores, setCurrentScores] = useState<Score[]>([]);
  const [previousScores, setPreviousScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const { sessions } = useSeasonSessions(seasonId);

  useEffect(() => {
    if (!currentSessionId || !seasonId || sessions.length === 0) {
      setLoading(false);
      return;
    }

    const loadComparison = async () => {
      try {
        setLoading(true);

        // Get current week scores
        const current = await scoreService.getBySession(currentSessionId);
        setCurrentScores(current);

        // Find previous session
        const sortedSessions = [...sessions].sort((a, b) => a.weekNumber - b.weekNumber);
        const currentIndex = sortedSessions.findIndex(s => s.id === currentSessionId);

        if (currentIndex > 0) {
          const previousSession = sortedSessions[currentIndex - 1];
          if (previousSession.id) {
            const previous = await scoreService.getBySession(previousSession.id);
            setPreviousScores(previous);
          }
        }
      } catch (error) {
        console.error('Error loading week comparison:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [currentSessionId, seasonId, sessions]);

  const userComparisons = useMemo(() => {
    const comparisons: WeekComparison[] = [];

    // Create a map of previous week scores
    const previousMap = new Map<string, number>();
    previousScores.forEach(score => {
      previousMap.set(score.userId, score.totalPoints);
    });

    // Calculate comparisons for current week
    currentScores.forEach(score => {
      const previousPoints = previousMap.get(score.userId) || 0;
      const currentPoints = score.totalPoints;
      const change = currentPoints - previousPoints;
      const percentageChange = previousPoints > 0
        ? Math.round((change / previousPoints) * 100)
        : currentPoints > 0 ? 100 : 0;

      comparisons.push({
        userId: score.userId,
        currentWeekPoints: currentPoints,
        previousWeekPoints: previousPoints,
        change,
        percentageChange,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
      });
    });

    return comparisons;
  }, [currentScores, previousScores]);

  const teamComparisons = useMemo(() => {
    const teamMap = new Map<string, TeamWeekComparison>();

    // Group current scores by team
    const currentTeamTotals = new Map<string, number>();
    currentScores.forEach(score => {
      if (score.teamId) {
        const current = currentTeamTotals.get(score.teamId) || 0;
        currentTeamTotals.set(score.teamId, current + score.totalPoints);
      }
    });

    // Group previous scores by team
    const previousTeamTotals = new Map<string, number>();
    previousScores.forEach(score => {
      if (score.teamId) {
        const current = previousTeamTotals.get(score.teamId) || 0;
        previousTeamTotals.set(score.teamId, current + score.totalPoints);
      }
    });

    // Calculate comparisons
    currentTeamTotals.forEach((currentPoints, teamId) => {
      const previousPoints = previousTeamTotals.get(teamId) || 0;
      const change = currentPoints - previousPoints;
      const percentageChange = previousPoints > 0
        ? Math.round((change / previousPoints) * 100)
        : currentPoints > 0 ? 100 : 0;

      teamMap.set(teamId, {
        teamId,
        currentWeekPoints: currentPoints,
        previousWeekPoints: previousPoints,
        change,
        percentageChange,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'same'
      });
    });

    return Array.from(teamMap.values());
  }, [currentScores, previousScores]);

  return {
    userComparisons,
    teamComparisons,
    loading,
    hasPreviousWeek: previousScores.length > 0
  };
}