'use client';

import { useState, useEffect, useMemo, useRef, KeyboardEvent } from 'react';
import {
  useStaticActiveSession,
  useStaticUsers,
  useStaticSessionScores,
  useStaticTeams,
  clearStaticDataCache
} from '@/lib/firebase/hooks/useStaticData';
import { scoreService } from '@/lib/firebase/services';
import { Score, ScoreMetrics, User, PointValues } from '@/lib/types';
import toast from 'react-hot-toast';
import {
  Save,
  AlertCircle,
  Search,
  Users as UsersIcon,
  Zap,
} from 'lucide-react';

// Default point values - in production, these would come from the active season
const DEFAULT_POINT_VALUES: PointValues = {
  attendance: 10,
  one21s: 15,
  referrals: 25,
  tyfcb: 20,
  visitors: 15,
};

const METRIC_FIELDS: (keyof ScoreMetrics)[] = [
  'attendance',
  'one21s',
  'referrals',
  'tyfcb',
  'visitors',
];

export default function ScoringPage() {
  const { session: activeSession, loading: sessionLoading } = useStaticActiveSession();
  const { users, loading: usersLoading } = useStaticUsers();
  const { scores, loading: scoresLoading } = useStaticSessionScores(activeSession?.id || null);
  const { teams, loading: teamsLoading } = useStaticTeams();

  const [searchQuery, setSearchQuery] = useState('');
  const [scoreEdits, setScoreEdits] = useState<Record<string, ScoreMetrics>>({});
  const [savingScores, setSavingScores] = useState<Record<string, boolean>>({});

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loading = sessionLoading || usersLoading || scoresLoading || teamsLoading;

  // Initialize score edits from existing scores
  useEffect(() => {
    if (scores.length > 0) {
      const edits: Record<string, ScoreMetrics> = {};
      scores.forEach((score) => {
        edits[score.userId] = { ...score.metrics };
      });
      setScoreEdits(edits);
    }
  }, [scores]);

  // Filter active members and team leaders
  const activeMembers = useMemo(() => {
    return users.filter((u) => u.isActive && (u.role === 'member' || u.role === 'team-leader' || u.role === 'admin'));
  }, [users]);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery) return activeMembers;

    const query = searchQuery.toLowerCase();
    return activeMembers.filter(
      (user) =>
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [activeMembers, searchQuery]);

  // Global keyboard shortcut for save all - must be after filteredMembers is defined
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + S to save all scores
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveAllScores();
        toast.success('Saving all scores... (Cmd+Shift+S)');
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [filteredMembers, activeSession]);

  // Group members by team
  const membersByTeam = useMemo(() => {
    const grouped: Record<string, User[]> = {};

    // Create a map of teamId to teamName
    const teamMap = new Map<string, string>();
    teams.forEach(team => {
      if (team.id) {
        teamMap.set(team.id, team.name);
      }
    });

    filteredMembers.forEach((member) => {
      const teamName = member.teamId && teamMap.has(member.teamId)
        ? teamMap.get(member.teamId)!
        : 'No Team';

      if (!grouped[teamName]) {
        grouped[teamName] = [];
      }
      grouped[teamName].push(member);
    });

    // Sort by team name, with "No Team" last
    const sortedGrouped: Record<string, User[]> = {};
    const teamNames = Object.keys(grouped).sort((a, b) => {
      if (a === 'No Team') return 1;
      if (b === 'No Team') return -1;
      return a.localeCompare(b);
    });

    teamNames.forEach(teamName => {
      sortedGrouped[teamName] = grouped[teamName];
    });

    return sortedGrouped;
  }, [filteredMembers, teams]);

  const getDefaultMetrics = (): ScoreMetrics => ({
    attendance: 0,
    one21s: 0,
    referrals: 0,
    tyfcb: 0,
    visitors: 0,
  });

  const calculatePoints = (metrics: ScoreMetrics): number => {
    return scoreService.calculateTotalPoints(metrics, DEFAULT_POINT_VALUES);
  };

  const handleMetricChange = (
    userId: string,
    metric: keyof ScoreMetrics,
    value: string,
    memberIndex: number,
    metricIndex: number
  ) => {
    const numValue = parseInt(value) || 0;
    const allMembers = Object.values(membersByTeam).flat();

    // For attendance, cap at 1
    const finalValue = metric === 'attendance' ? Math.min(1, Math.max(0, numValue)) : Math.max(0, numValue);

    setScoreEdits((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || getDefaultMetrics()),
        [metric]: finalValue,
      },
    }));

    // Auto-tab to next field if a value was entered
    if (value.length > 0 && numValue >= 0) {
      const nextInputId = getNextInputId(userId, memberIndex, metricIndex);

      // Check if we're moving to a different user (next row)
      const isMovingToNextUser = metricIndex === METRIC_FIELDS.length - 1 && memberIndex < allMembers.length - 1;

      // Auto-save removed to prevent excessive database writes

      if (nextInputId && inputRefs.current[nextInputId]) {
        setTimeout(() => {
          inputRefs.current[nextInputId]?.focus();
          inputRefs.current[nextInputId]?.select();
        }, 10);
      }
    }
  };

  const getNextInputId = (userId: string, memberIndex: number, metricIndex: number): string | null => {
    // If not last field in row, go to next field
    if (metricIndex < METRIC_FIELDS.length - 1) {
      return `${userId}-${METRIC_FIELDS[metricIndex + 1]}`;
    }

    // If last field in row, go to first field of next member
    const allMembers = Object.values(membersByTeam).flat();
    if (memberIndex < allMembers.length - 1) {
      const nextMember = allMembers[memberIndex + 1];
      return `${nextMember.id}-${METRIC_FIELDS[0]}`;
    }

    return null;
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    userId: string,
    memberIndex: number,
    metricIndex: number
  ) => {
    const allMembers = Object.values(membersByTeam).flat();
    const currentUser = filteredMembers.find(u => u.id === userId);

    // Cmd/Ctrl + S to save current user
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (currentUser) {
        saveUserScore(userId, currentUser);
        toast.success(`Saved ${currentUser.firstName}'s scores (Cmd+S)`);
      }
      return;
    }

    // Cmd/Ctrl + Enter to save current user and move to next
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (currentUser) {
        saveUserScore(userId, currentUser);
        // Move to next user's first field
        if (memberIndex < allMembers.length - 1) {
          const nextMember = allMembers[memberIndex + 1];
          const nextInputId = `${nextMember.id}-${METRIC_FIELDS[0]}`;
          setTimeout(() => {
            if (inputRefs.current[nextInputId]) {
              inputRefs.current[nextInputId]?.focus();
              inputRefs.current[nextInputId]?.select();
            }
          }, 100);
        }
      }
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        // Move to next field on Enter
        const nextInputId = getNextInputId(userId, memberIndex, metricIndex);
        if (nextInputId && inputRefs.current[nextInputId]) {
          inputRefs.current[nextInputId]?.focus();
          inputRefs.current[nextInputId]?.select();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        // Move to same field in previous row
        if (memberIndex > 0) {
          const prevMember = allMembers[memberIndex - 1];
          const prevInputId = `${prevMember.id}-${METRIC_FIELDS[metricIndex]}`;
          if (inputRefs.current[prevInputId]) {
            inputRefs.current[prevInputId]?.focus();
            inputRefs.current[prevInputId]?.select();
          }
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        // Move to same field in next row
        if (memberIndex < allMembers.length - 1) {
          const nextMember = allMembers[memberIndex + 1];
          const nextInputId = `${nextMember.id}-${METRIC_FIELDS[metricIndex]}`;
          if (inputRefs.current[nextInputId]) {
            inputRefs.current[nextInputId]?.focus();
            inputRefs.current[nextInputId]?.select();
          }
        }
        break;

      case 'Tab':
        // Let tab work naturally but select text in next field
        setTimeout(() => {
          const activeElement = document.activeElement as HTMLInputElement;
          if (activeElement && activeElement.type === 'text') {
            activeElement.select();
          }
        }, 10);
        break;
    }
  };

  const saveUserScore = async (userId: string, user: User) => {
    if (!activeSession?.id) {
      toast.error('No active session');
      return;
    }

    const metrics = scoreEdits[userId] || getDefaultMetrics();

    setSavingScores((prev) => ({ ...prev, [userId]: true }));

    try {
      const score: Omit<Score, 'id'> = {
        userId,
        sessionId: activeSession.id,
        seasonId: activeSession.seasonId,
        teamId: user.teamId || undefined,
        metrics,
        totalPoints: calculatePoints(metrics),
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      await scoreService.upsert(score);
      toast.success(`Score saved for ${user.firstName} ${user.lastName}`);
      // Clear cache after saving to ensure fresh data on next load
      clearStaticDataCache();
    } catch (error) {
      console.error('Error saving score:', error);
      toast.error('Failed to save score');
    } finally {
      setSavingScores((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const saveAllScores = async () => {
    if (!activeSession?.id) {
      toast.error('No active session');
      return;
    }

    const promises = filteredMembers.map((user) =>
      saveUserScore(user.id!, user)
    );

    try {
      await Promise.all(promises);
      toast.success('All scores saved successfully!');
    } catch (error) {
      console.error('Error saving scores:', error);
      toast.error('Some scores failed to save');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 mt-0.5" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-yellow-900">
                No Active Session
              </h2>
              <p className="text-yellow-700 mt-1">
                Please open a session from the dashboard before entering scores.
              </p>
              <a
                href="/admin/dashboard"
                className="inline-block mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate member index across all teams for navigation
  const allMembers = Object.values(membersByTeam).flat();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Scoring</h1>
            <p className="text-gray-600 mt-1">
              Week {activeSession.weekNumber} - Enter scores for all members
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveAllScores}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save size={20} />
              Save All Scores
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Quick Entry Tips */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-900 mb-2 flex items-center gap-2">
          <Zap size={18} />
          Quick Entry Mode - Keyboard Shortcuts
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-green-800">
          <div className="space-y-1">
            <div>• Enter number → auto-advance to next field</div>
            <div>• <kbd className="px-2 py-0.5 bg-green-100 rounded text-xs font-mono">Enter</kbd> or <kbd className="px-2 py-0.5 bg-green-100 rounded text-xs font-mono">Tab</kbd> skip field</div>
            <div>• <kbd className="px-2 py-0.5 bg-green-100 rounded text-xs font-mono">↑↓</kbd> move between rows</div>
          </div>
          <div className="space-y-1">
            <div>• <kbd className="px-2 py-0.5 bg-green-100 rounded text-xs font-mono">Cmd+S</kbd> save current person</div>
            <div>• <kbd className="px-2 py-0.5 bg-green-100 rounded text-xs font-mono">Cmd+Enter</kbd> save & next person</div>
            <div>• <kbd className="px-2 py-0.5 bg-green-100 rounded text-xs font-mono">Cmd+Shift+S</kbd> save all scores</div>
          </div>
        </div>
      </div>

      {/* Point Values Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Point Values</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm text-blue-800">
          <div>Attendance: {DEFAULT_POINT_VALUES.attendance}pts</div>
          <div>1-2-1s: {DEFAULT_POINT_VALUES.one21s}pts</div>
          <div>Referrals: {DEFAULT_POINT_VALUES.referrals}pts</div>
          <div>TYFCB: {DEFAULT_POINT_VALUES.tyfcb}pts</div>
          <div>Visitors: {DEFAULT_POINT_VALUES.visitors}pts</div>
        </div>
      </div>

      {/* Scoring Table by Team */}
      {Object.entries(membersByTeam).map(([teamName, members]) => (
        <div key={teamName} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <UsersIcon size={20} />
              {teamName} ({members.length} members)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-4 py-3 text-center">Attend</th>
                  <th className="px-4 py-3 text-center">1-2-1s</th>
                  <th className="px-4 py-3 text-center">Refer</th>
                  <th className="px-4 py-3 text-center">TYFCB</th>
                  <th className="px-4 py-3 text-center">Visit</th>
                  <th className="px-4 py-3 text-center">Points</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => {
                  const memberIndex = allMembers.findIndex(m => m.id === member.id);
                  const metrics = scoreEdits[member.id!] || getDefaultMetrics();
                  const totalPoints = calculatePoints(metrics);
                  const isSaving = savingScores[member.id!];

                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}${member.lastName}`}
                            alt=""
                            className="w-8 h-8 rounded-full mr-3"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      {METRIC_FIELDS.map((metric, metricIndex) => (
                        <td key={metric} className="px-4 py-4">
                          <input
                            ref={(el) => {
                              inputRefs.current[`${member.id}-${metric}`] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={metrics[metric] || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              handleMetricChange(member.id!, metric, value, memberIndex, metricIndex);
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleKeyDown(e, member.id!, memberIndex, metricIndex)}
                            className="w-14 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                            maxLength={metric === 'attendance' ? 1 : 3}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-4 text-center">
                        <span className={`text-lg font-semibold ${totalPoints > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {totalPoints}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => saveUserScore(member.id!, member)}
                          disabled={isSaving}
                          className="px-3 py-1 rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}