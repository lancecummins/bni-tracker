import { useState, useEffect, useMemo } from 'react';
import { Score, Session } from '@/lib/types';
import { scoreService } from '@/lib/firebase/services';
import { useSeasonSessions } from './useSessions';
import { useUsers } from './useUsers';
import { useSettings } from './useSettings';

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
    ceu: number;
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
  const { users } = useUsers();
  const { settings } = useSettings();

  useEffect(() => {
    if (!seasonId || sessions.length === 0) {
      setLoading(false);
      return;
    }

    const loadAllScores = async () => {
      try {
        setLoading(true);
        const scoresMap = new Map<string, Score[]>();

        // Load scores for all non-archived sessions
        for (const session of sessions) {
          if (session.id && session.status !== 'draft' && !session.isArchived) {
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
              ceu: 0,
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
        userTotal.categoryTotals.ceu += score.metrics.ceu;
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
    if (!settings || !users) return [];

    const totalsMap = new Map<string, TeamSeasonTotal>();
    const weeklyTeamWinners = new Map<string, string>(); // sessionId -> winningTeamId

    // Helper function to calculate team bonuses for a session
    const calculateTeamBonuses = (teamId: string, sessionScores: Score[], session: Session) => {
      let bonusPoints = 0;

      // Determine ALL team members who SHOULD be on this team
      // Use both historical (from scores) and current team assignments
      const teamMemberIds = new Set<string>();

      // Add users who have scores for this team (historical members)
      const teamScores = sessionScores.filter(s => s.teamId === teamId);
      teamScores.forEach(score => {
        teamMemberIds.add(score.userId);
      });

      // ALWAYS include current team members
      // This ensures we don't award bonuses if team members didn't submit scores
      users.forEach(u => {
        if (u.teamId === teamId && u.isActive &&
            (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin')) {
          teamMemberIds.add(u.id!);
        }
      });

      const allTeamMembers = users.filter(u => teamMemberIds.has(u.id!));

      // Filter out excluded users from bonus calculations
      const excludedUserIds = session.excludedUserIds || [];
      const nonExcludedMembers = allTeamMembers.filter(m => !excludedUserIds.includes(m.id!));

      // "All In" bonuses - only if all non-excluded team members have scores
      if (teamScores.length === nonExcludedMembers.length && nonExcludedMembers.length > 0) {
        const categoryList = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors', 'ceu'] as const;

        categoryList.forEach(category => {
          const allMembersHaveCategory = nonExcludedMembers.every(member => {
            const score = sessionScores.find(s => s.userId === member.id);
            return score && score.metrics[category] > 0;
          });

          if (allMembersHaveCategory && settings.bonusValues) {
            bonusPoints += settings.bonusValues[category];
          }
        });
      }

      // Custom team bonuses from session
      const customBonuses = session.teamCustomBonuses?.filter(b => b.teamId === teamId) || [];
      bonusPoints += customBonuses.reduce((sum, b) => sum + b.points, 0);

      return bonusPoints;
    };

    // First pass: calculate weekly totals (with bonuses) and determine winners
    allScores.forEach((sessionScores, sessionId) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const weeklyTeamPoints = new Map<string, number>();

      // Calculate member points for each team
      sessionScores.forEach((score) => {
        if (score.teamId) {
          const current = weeklyTeamPoints.get(score.teamId) || 0;
          weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
        }
      });

      // Add team bonuses to weekly totals
      weeklyTeamPoints.forEach((memberPoints, teamId) => {
        const bonusPoints = calculateTeamBonuses(teamId, sessionScores, session);
        weeklyTeamPoints.set(teamId, memberPoints + bonusPoints);
      });

      // Find weekly winner (based on total including bonuses)
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
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const weeklyTeamPoints = new Map<string, number>();

      // Calculate member points for each team
      sessionScores.forEach((score) => {
        if (score.teamId) {
          const current = weeklyTeamPoints.get(score.teamId) || 0;
          weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
        }
      });

      weeklyTeamPoints.forEach((memberPoints, teamId) => {
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

        // Add bonuses to get total weekly points
        const bonusPoints = calculateTeamBonuses(teamId, sessionScores, session);
        const weeklyTotal = memberPoints + bonusPoints;

        teamTotal.totalPoints += weeklyTotal;
        teamTotal.weekCount += 1;
        teamTotal.bestWeek = Math.max(teamTotal.bestWeek, weeklyTotal);

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
  }, [allScores, sessions, users, settings]);

  // Calculate weekly breakdown for charts
  const weeklyData = useMemo(() => {
    if (!settings || !users || sessions.length === 0) return [];

    const weeksData: Array<{
      weekNumber: number;
      weekName: string;
      totalTeamPoints: number;
      [key: string]: number | string;
    }> = [];

    // Sort sessions by week number
    const sortedSessions = [...sessions]
      .filter(s => s.status !== 'draft' && !s.isArchived)
      .sort((a, b) => a.weekNumber - b.weekNumber);

    sortedSessions.forEach((session) => {
      if (!session.id) return;

      const sessionScores = allScores.get(session.id) || [];
      const weekData: any = {
        weekNumber: session.weekNumber,
        weekName: `Week ${session.weekNumber}`,
        totalTeamPoints: 0,
      };

      // Calculate team points for this week
      const weeklyTeamPoints = new Map<string, number>();

      sessionScores.forEach((score) => {
        if (score.teamId) {
          const current = weeklyTeamPoints.get(score.teamId) || 0;
          weeklyTeamPoints.set(score.teamId, current + score.totalPoints);
        }
      });

      // Add team bonuses
      weeklyTeamPoints.forEach((memberPoints, teamId) => {
        let bonusPoints = 0;

        // Determine ALL team members who SHOULD be on this team
        const teamMemberIds = new Set<string>();

        // Add users who have scores for this team (historical members)
        const teamScores = sessionScores.filter(s => s.teamId === teamId);
        teamScores.forEach(score => {
          teamMemberIds.add(score.userId);
        });

        // ALWAYS include current team members
        users.forEach(u => {
          if (u.teamId === teamId && u.isActive &&
              (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin')) {
            teamMemberIds.add(u.id!);
          }
        });

        const allTeamMembers = users.filter(u => teamMemberIds.has(u.id!));

        // Filter out excluded users from bonus calculations
        const excludedUserIds = session.excludedUserIds || [];
        const nonExcludedMembers = allTeamMembers.filter(m => !excludedUserIds.includes(m.id!));

        if (teamScores.length === nonExcludedMembers.length && nonExcludedMembers.length > 0) {
          const categoryList = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors', 'ceu'] as const;
          categoryList.forEach(category => {
            const allMembersHaveCategory = nonExcludedMembers.every(member => {
              const score = sessionScores.find(s => s.userId === member.id);
              return score && score.metrics[category] > 0;
            });
            if (allMembersHaveCategory && settings.bonusValues) {
              bonusPoints += settings.bonusValues[category];
            }
          });
        }

        const customBonuses = session.teamCustomBonuses?.filter(b => b.teamId === teamId) || [];
        bonusPoints += customBonuses.reduce((sum, b) => sum + b.points, 0);

        const totalPoints = memberPoints + bonusPoints;
        weeklyTeamPoints.set(teamId, totalPoints);
      });

      // Sum all team points for combined total
      let totalCombinedPoints = 0;
      weeklyTeamPoints.forEach((points) => {
        totalCombinedPoints += points;
      });

      weekData.totalTeamPoints = totalCombinedPoints;

      // Add individual user points
      sessionScores.forEach((score) => {
        weekData[score.userId] = score.totalPoints;
      });

      weeksData.push(weekData);
    });

    return weeksData;
  }, [allScores, sessions, users, settings]);

  return {
    userTotals,
    teamTotals,
    loading,
    weekCount: allScores.size,
    weeklyData,
  };
}