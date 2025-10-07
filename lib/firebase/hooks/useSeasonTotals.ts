import { useState, useEffect, useMemo } from 'react';
import { Score, Session } from '@/lib/types';
import { scoreService } from '@/lib/firebase/services';
import { useSeasonSessions } from './useSessions';

interface UserSeasonTotal {
  userId: string;
  totalPoints: number;
  weekCount: number;
  averagePoints: number;
  bestWeek: number;
  categoryTotals: {
    attendance: number;
    one21s: number;
    referrals: number;
    tyfcb: number;
    visitors: number;
  };
}

interface TeamSeasonTotal {
  teamId: string;
  totalPoints: number;
  weekCount: number;
  averagePoints: number;
  bestWeek: number;
  weeklyWins: number;
}

export function useSeasonTotals(seasonId: string | null) {
  const [allScores, setAllScores] = useState<Map<string, Score[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const { sessions } = useSeasonSessions(seasonId);

  useEffect(() => {
    if (!seasonId || sessions.length === 0) {
      setLoading(false);
      return;
    }

    const loadAllScores = async () => {
      try {
        setLoading(true);
        const scoresMap = new Map<string, Score[]>();

        // Load scores for all sessions
        for (const session of sessions) {
          if (session.id && session.status !== 'draft') {
            const scores = await scoreService.getBySession(session.id);
            scoresMap.set(session.id, scores);
          }
        }

        setAllScores(scoresMap);
      } catch (error) {
        console.error('Error loading season totals:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllScores();
  }, [seasonId, sessions]);

  const userTotals = useMemo(() => {
    const totalsMap = new Map<string, UserSeasonTotal>();

    allScores.forEach((sessionScores) => {
      sessionScores.forEach((score) => {
        let userTotal = totalsMap.get(score.userId);

        if (!userTotal) {
          userTotal = {
            userId: score.userId,
            totalPoints: 0,
            weekCount: 0,
            averagePoints: 0,
            bestWeek: 0,
            categoryTotals: {
              attendance: 0,
              one21s: 0,
              referrals: 0,
              tyfcb: 0,
              visitors: 0,
            }
          };
          totalsMap.set(score.userId, userTotal);
        }

        // Update totals
        userTotal.totalPoints += score.totalPoints;
        userTotal.weekCount += 1;
        userTotal.bestWeek = Math.max(userTotal.bestWeek, score.totalPoints);

        // Update category totals
        userTotal.categoryTotals.attendance += score.metrics.attendance;
        userTotal.categoryTotals.one21s += score.metrics.one21s;
        userTotal.categoryTotals.referrals += score.metrics.referrals;
        userTotal.categoryTotals.tyfcb += score.metrics.tyfcb;
        userTotal.categoryTotals.visitors += score.metrics.visitors;
      });
    });

    // Calculate averages
    totalsMap.forEach((userTotal) => {
      userTotal.averagePoints = userTotal.weekCount > 0
        ? Math.round(userTotal.totalPoints / userTotal.weekCount)
        : 0;
    });

    return Array.from(totalsMap.values())
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [allScores]);

  const teamTotals = useMemo(() => {
    const totalsMap = new Map<string, TeamSeasonTotal>();
    const weeklyTeamWinners = new Map<string, string>(); // sessionId -> winningTeamId

    // First pass: calculate weekly totals and determine winners
    allScores.forEach((sessionScores, sessionId) => {
      const weeklyTeamPoints = new Map<string, number>();

      sessionScores.forEach((score) => {
        if (score.teamId) {
          const current = weeklyTeamPoints.get(score.teamId) || 0;
          weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
        }
      });

      // Find weekly winner
      let maxPoints = 0;
      let winningTeamId = '';
      weeklyTeamPoints.forEach((points, teamId) => {
        if (points > maxPoints) {
          maxPoints = points;
          winningTeamId = teamId;
        }
      });

      if (winningTeamId) {
        weeklyTeamWinners.set(sessionId, winningTeamId);
      }
    });

    // Second pass: aggregate season totals
    allScores.forEach((sessionScores, sessionId) => {
      const weeklyTeamPoints = new Map<string, number>();

      sessionScores.forEach((score) => {
        if (score.teamId) {
          const current = weeklyTeamPoints.get(score.teamId) || 0;
          weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
        }
      });

      weeklyTeamPoints.forEach((points, teamId) => {
        let teamTotal = totalsMap.get(teamId);

        if (!teamTotal) {
          teamTotal = {
            teamId,
            totalPoints: 0,
            weekCount: 0,
            averagePoints: 0,
            bestWeek: 0,
            weeklyWins: 0,
          };
          totalsMap.set(teamId, teamTotal);
        }

        teamTotal.totalPoints += points;
        teamTotal.weekCount += 1;
        teamTotal.bestWeek = Math.max(teamTotal.bestWeek, points);

        // Check if this team won this week
        if (weeklyTeamWinners.get(sessionId) === teamId) {
          teamTotal.weeklyWins += 1;
        }
      });
    });

    // Calculate averages
    totalsMap.forEach((teamTotal) => {
      teamTotal.averagePoints = teamTotal.weekCount > 0
        ? Math.round(teamTotal.totalPoints / teamTotal.weekCount)
        : 0;
    });

    return Array.from(totalsMap.values())
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [allScores]);

  return {
    userTotals,
    teamTotals,
    loading,
    weekCount: allScores.size,
  };
}