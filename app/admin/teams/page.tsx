'use client';

import { useState, DragEvent, useEffect } from 'react';
import { useStaticTeams, useStaticUsers, clearStaticDataCache } from '@/lib/firebase/hooks/useStaticData';
import { useActiveSeason } from '@/lib/firebase/hooks';
import { teamService, userService, scoreService, settingsService } from '@/lib/firebase/services';
import { Team, User, Session, Score, Settings } from '@/lib/types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import {
  Users as UsersIcon,
  Trophy,
  Edit2,
  Save,
  X,
  UserPlus,
  UserMinus,
  Palette,
  Crown,
  GripVertical,
  Image as ImageIcon,
  AlertTriangle,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';

interface TeamStats {
  weeklyWins: number;
  totalPoints: number;
}

export default function TeamsPage() {
  const { teams, loading: teamsLoading } = useStaticTeams();
  const { users, loading: usersLoading } = useStaticUsers();
  const { season: activeSeason } = useActiveSeason();
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamEdits, setTeamEdits] = useState<Record<string, Partial<Team>>>({});
  const [showUserAssignment, setShowUserAssignment] = useState<string | null>(null);
  const [draggedUser, setDraggedUser] = useState<User | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<string | null>(null);
  const [editingLogoUrl, setEditingLogoUrl] = useState<string | null>(null);
  const [teamStats, setTeamStats] = useState<Map<string, TeamStats>>(new Map());
  const [statsLoading, setStatsLoading] = useState(true);

  const loading = teamsLoading || usersLoading || statsLoading;

  // Calculate team stats using the same logic as /display/season
  useEffect(() => {
    const calculateTeamStats = async () => {
      if (teamsLoading || usersLoading) return;

      setStatsLoading(true);
      try {
        // Get all sessions, settings
        const [allSessionsSnapshot, settings] = await Promise.all([
          getDocs(collection(db, 'sessions')),
          settingsService.get()
        ]);

        const allSessions = allSessionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Session));

        // Filter to non-archived closed sessions (same as season page)
        const closedSessions = allSessions.filter(s => s.status === 'closed' && !s.isArchived);

        // Load scores for all closed sessions
        const sessionScoresMap = new Map<string, Score[]>();
        for (const session of closedSessions) {
          if (session.id) {
            const scores = await scoreService.getBySession(session.id);
            sessionScoresMap.set(session.id, scores);
          }
        }

        // Calculate weekly winners and total points (EXACT same logic as season page)
        const weeklyWinsMap = new Map<string, number>();
        const totalPointsMap = new Map<string, number>();

        closedSessions.forEach(session => {
          if (!session.id) return;

          const sessionScores = sessionScoresMap.get(session.id) || [];
          const weeklyTeamPoints = new Map<string, number>();

          // Calculate member points for each team
          sessionScores.forEach(score => {
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

            // "All In" bonuses
            if (teamScores.length === nonExcludedMembers.length && nonExcludedMembers.length > 0) {
              const categoryList = ['attendance', 'one21s', 'referrals', 'tyfcb', 'visitors'] as const;
              categoryList.forEach(category => {
                const allMembersHaveCategory = nonExcludedMembers.every(member => {
                  const score = sessionScores.find(s => s.userId === member.id);
                  return score && score.metrics[category] > 0;
                });
                if (allMembersHaveCategory && settings?.bonusValues) {
                  bonusPoints += settings.bonusValues[category];
                }
              });
            }

            // Custom team bonuses
            const customBonuses = session.teamCustomBonuses?.filter(b => b.teamId === teamId) || [];
            bonusPoints += customBonuses.reduce((sum, b) => sum + b.points, 0);

            const totalPoints = memberPoints + bonusPoints;
            weeklyTeamPoints.set(teamId, totalPoints);

            // Add to season totals
            totalPointsMap.set(teamId, (totalPointsMap.get(teamId) || 0) + totalPoints);
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
            weeklyWinsMap.set(winningTeamId, (weeklyWinsMap.get(winningTeamId) || 0) + 1);
          }
        });

        // Build stats map
        const statsMap = new Map<string, TeamStats>();
        teams.forEach(team => {
          if (team.id) {
            statsMap.set(team.id, {
              weeklyWins: weeklyWinsMap.get(team.id) || 0,
              totalPoints: totalPointsMap.get(team.id) || 0
            });
          }
        });

        setTeamStats(statsMap);
      } catch (error) {
        console.error('Error calculating team stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    calculateTeamStats();
  }, [teams, users, teamsLoading, usersLoading]);

  // Include all active users who can be part of teams (members, team leaders, and admins)
  const activeMembers = users.filter(u => u.isActive);
  const teamLeaders = users.filter(u => u.isActive && u.role === 'team-leader');
  const admins = users.filter(u => u.isActive && u.role === 'admin');
  const regularMembers = users.filter(u => u.isActive && u.role === 'member');

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team.id!);
    setTeamEdits({
      ...teamEdits,
      [team.id!]: {
        name: team.name,
        slug: team.slug || '',
        color: team.color,
        logoUrl: team.logoUrl || '',
      },
    });
  };

  const handleSaveTeam = async (teamId: string) => {
    const edits = teamEdits[teamId];
    if (!edits) return;

    try {
      await teamService.update(teamId, edits);
      clearStaticDataCache(); // Clear cache after update
      toast.success('Team updated successfully');
      setEditingTeam(null);
      setTeamEdits((prev) => {
        const updated = { ...prev };
        delete updated[teamId];
        return updated;
      });
    } catch (error) {
      console.error('Error updating team:', error);
      toast.error('Failed to update team');
    }
  };

  const handleCancelEdit = (teamId: string) => {
    setEditingTeam(null);
    setTeamEdits((prev) => {
      const updated = { ...prev };
      delete updated[teamId];
      return updated;
    });
  };


  const handleAssignUser = async (userId: string, fromTeamId: string | null, toTeamId: string) => {
    try {
      // Remove from current team if exists
      if (fromTeamId && fromTeamId !== toTeamId) {
        await teamService.removeMember(fromTeamId, userId);
      }

      // Add to new team
      if (toTeamId !== fromTeamId) {
        await teamService.addMember(toTeamId, userId);
        await userService.update(userId, { teamId: toTeamId });
      }

      clearStaticDataCache(); // Clear cache after update
      toast.success('User assigned successfully');
    } catch (error) {
      console.error('Error assigning user:', error);
      toast.error('Failed to assign user');
    }
  };

  const handleRemoveUser = async (userId: string, teamId: string) => {
    try {
      await teamService.removeMember(teamId, userId);
      await userService.update(userId, { teamId: null });
      clearStaticDataCache(); // Clear cache after update
      toast.success('User removed from team');
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('Failed to remove user');
    }
  };

  const getUsersForTeam = (teamId: string) => {
    return activeMembers.filter(user => user.teamId === teamId);
  };

  const getUnassignedUsers = () => {
    return activeMembers.filter(user => !user.teamId);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLElement>, user: User) => {
    setDraggedUser(user);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedUser(null);
    setDragOverTeam(null);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (teamId: string) => {
    setDragOverTeam(teamId);
  };

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    // Only clear if we're leaving the team container entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverTeam(null);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLElement>, teamId: string) => {
    e.preventDefault();
    setDragOverTeam(null);

    if (!draggedUser) return;

    try {
      await handleAssignUser(draggedUser.id!, draggedUser.teamId || null, teamId);
    } catch (error) {
      console.error('Error assigning user via drag and drop:', error);
    }

    setDraggedUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const unassignedUsers = getUnassignedUsers();
  const isNewSeasonSetup = unassignedUsers.length > activeMembers.length * 0.5; // More than 50% unassigned

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Teams Management</h1>
            <p className="text-gray-600 mt-1">Manage teams and member assignments</p>
            {activeSeason && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <TrendingUp size={14} />
                Season: {activeSeason.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Trophy size={20} />
              <span>{teams.length} Teams</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <UsersIcon size={20} />
              <span>{regularMembers.length} Members</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600">
              <Crown size={20} />
              <span>{teamLeaders.length} Team Leaders</span>
            </div>
            {admins.length > 0 && (
              <div className="flex items-center gap-2 text-purple-600">
                <Crown size={20} />
                <span>{admins.length} Admin{admins.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Season Setup Banner */}
      {isNewSeasonSetup && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <TrendingUp size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">New Season Setup Mode</h2>
              <p className="text-blue-100 mb-4">
                You have {unassignedUsers.length} unassigned members ready for the new season draft. Follow these steps:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">1</div>
                    <h3 className="font-semibold">Assign Team Leaders</h3>
                  </div>
                  <p className="text-sm text-blue-100">
                    Drag team leaders (blue badges) to their respective teams first
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">2</div>
                    <h3 className="font-semibold">Draft Members</h3>
                  </div>
                  <p className="text-sm text-blue-100">
                    Use drag-and-drop to assign members to teams for the new season
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">3</div>
                    <h3 className="font-semibold">Start Competing</h3>
                  </div>
                  <p className="text-sm text-blue-100">
                    Once all members are assigned, you're ready to create sessions!
                  </p>
                </div>
              </div>
              {teamLeaders.filter(tl => !tl.teamId).length > 0 && (
                <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={20} />
                  <p className="text-sm">
                    <strong>{teamLeaders.filter(tl => !tl.teamId).length} team leader(s)</strong> still need to be assigned to teams
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unassigned Users Alert */}
      {unassignedUsers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-2">
            Unassigned Members ({unassignedUsers.length})
          </h3>
          <p className="text-xs text-gray-600 mb-3">Drag members to teams to assign them</p>
          <div className="flex flex-wrap gap-2">
            {unassignedUsers.map(user => (
              <div
                key={user.id}
                draggable
                onDragStart={(e) => handleDragStart(e, user)}
                onDragEnd={handleDragEnd}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm cursor-move transition-transform hover:scale-105 ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-800 font-medium hover:bg-purple-200'
                    : user.role === 'team-leader'
                    ? 'bg-blue-100 text-blue-800 font-medium hover:bg-blue-200'
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                } ${draggedUser?.id === user.id ? 'opacity-50' : ''}`}
              >
                <GripVertical size={12} className="opacity-40" />
                {(user.role === 'team-leader' || user.role === 'admin') && <Crown size={12} />}
                {user.firstName} {user.lastName}
                {user.role === 'admin' && ' (Admin)'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map((team) => {
          const teamMembers = getUsersForTeam(team.id!);
          const isEditing = editingTeam === team.id;
          const edits = teamEdits[team.id!] || {};

          return (
            <div
              key={team.id}
              className={`bg-white rounded-lg shadow overflow-hidden transition-all ${
                dragOverTeam === team.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
              }`}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(team.id!)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, team.id!)}
            >
              {/* Team Header */}
              <div
                className="p-4 text-white"
                style={{ backgroundColor: isEditing ? edits.color || team.color : team.color }}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={edits.name || team.name}
                      onChange={(e) =>
                        setTeamEdits({
                          ...teamEdits,
                          [team.id!]: { ...edits, name: e.target.value },
                        })
                      }
                      placeholder="Team Name"
                      className="w-full px-3 py-2 rounded text-gray-900"
                    />
                    <input
                      type="text"
                      value={edits.slug || team.slug || ''}
                      onChange={(e) =>
                        setTeamEdits({
                          ...teamEdits,
                          [team.id!]: { ...edits, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') },
                        })
                      }
                      placeholder="URL slug (e.g., team-alpha)"
                      className="w-full px-3 py-2 rounded text-gray-900"
                    />
                    <input
                      type="text"
                      value={edits.logoUrl || ''}
                      onChange={(e) =>
                        setTeamEdits({
                          ...teamEdits,
                          [team.id!]: { ...edits, logoUrl: e.target.value },
                        })
                      }
                      placeholder="Logo URL (e.g., /team-logos/alpha.png)"
                      className="w-full px-3 py-2 rounded text-gray-900"
                    />
                    <div className="flex items-center gap-2">
                      <Palette size={20} />
                      <input
                        type="color"
                        value={edits.color || team.color}
                        onChange={(e) =>
                          setTeamEdits({
                            ...teamEdits,
                            [team.id!]: { ...edits, color: e.target.value },
                          })
                        }
                        className="h-8 w-20 rounded cursor-pointer"
                      />
                      <button
                        onClick={() => handleSaveTeam(team.id!)}
                        className="ml-auto px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => handleCancelEdit(team.id!)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {team.logoUrl ? (
                        <img
                          src={team.logoUrl}
                          alt={`${team.name} logo`}
                          className="w-16 h-16 rounded-lg object-cover bg-white/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center">
                          <ImageIcon size={32} className="text-white/40" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-xl font-bold">{team.name}</h2>
                        <p className="text-white/80 text-sm">
                          {teamMembers.length} members | {teamStats.get(team.id!)?.totalPoints || 0} points
                        </p>
                        {team.slug && (
                          <p className="text-white/60 text-xs font-mono">
                            /{team.slug}/scoring
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTeam(team)}
                        className="p-2 bg-white/20 rounded hover:bg-white/30 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setShowUserAssignment(
                            showUserAssignment === team.id ? null : (team.id || null)
                          )
                        }
                        className="p-2 bg-white/20 rounded hover:bg-white/30 transition-colors"
                      >
                        <UserPlus size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* User Assignment Dropdown */}
              {showUserAssignment === team.id && (
                <div className="p-4 bg-gray-50 border-b">
                  <select
                    onChange={(e) => {
                      const userId = e.target.value;
                      if (userId) {
                        const user = activeMembers.find(u => u.id === userId);
                        if (user) {
                          handleAssignUser(userId, user.teamId || null, team.id!);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    defaultValue=""
                  >
                    <option value="">Add member to team...</option>
                    {activeMembers
                      .filter(u => u.teamId !== team.id)
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                          {user.teamId ? ' (from another team)' : ' (unassigned)'}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Team Members */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3 text-gray-700">
                  <UsersIcon size={18} />
                  <span className="font-medium">Team Members</span>
                </div>

                {teamMembers.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No members assigned</p>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, member)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-2 bg-gray-50 rounded cursor-move hover:bg-gray-100 transition-colors ${
                          draggedUser?.id === member.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical size={14} className="opacity-40 flex-shrink-0" />
                          <Avatar
                            src={member.avatarUrl}
                            fallbackSeed={`${member.firstName}${member.lastName}`}
                            size="sm"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {member.firstName} {member.lastName}
                              </p>
                              {member.role === 'admin' && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                  <Crown size={10} />
                                  <span className="text-xs font-medium">Admin</span>
                                </div>
                              )}
                              {member.role === 'team-leader' && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                  <Crown size={10} />
                                  <span className="text-xs font-medium">Team Leader</span>
                                </div>
                              )}
                              {team.teamLeaderId === member.id && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                  <Crown size={10} />
                                  <span className="text-xs font-medium">Captain</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{member.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveUser(member.id!, team.id!)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                          title="Remove from team"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Stats */}
              <div className="p-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Weekly Wins</p>
                    <p className="font-semibold">{teamStats.get(team.id!)?.weeklyWins || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Points</p>
                    <p className="font-semibold">{teamStats.get(team.id!)?.totalPoints || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}