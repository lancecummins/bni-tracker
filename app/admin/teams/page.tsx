'use client';

import { useState, DragEvent } from 'react';
import { useStaticTeams, useStaticUsers, clearStaticDataCache } from '@/lib/firebase/hooks/useStaticData';
import { teamService, userService } from '@/lib/firebase/services';
import { Team, User } from '@/lib/types';
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
  GripVertical
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';

export default function TeamsPage() {
  const { teams, loading: teamsLoading } = useStaticTeams();
  const { users, loading: usersLoading } = useStaticUsers();
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamEdits, setTeamEdits] = useState<Record<string, Partial<Team>>>({});
  const [showUserAssignment, setShowUserAssignment] = useState<string | null>(null);
  const [draggedUser, setDraggedUser] = useState<User | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<string | null>(null);

  const loading = teamsLoading || usersLoading;

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
        color: team.color,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Teams Management</h1>
            <p className="text-gray-600 mt-1">Manage teams and member assignments</p>
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
                    <div>
                      <h2 className="text-xl font-bold">{team.name}</h2>
                      <p className="text-white/80 text-sm">
                        {teamMembers.length} members | {team.totalPoints || 0} points
                      </p>
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
                            showUserAssignment === team.id ? null : team.id
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
                    <p className="font-semibold">{team.weeklyWins || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Points</p>
                    <p className="font-semibold">{team.totalPoints || 0}</p>
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