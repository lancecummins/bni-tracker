'use client';

import { useState } from 'react';
import { useStaticUsers, useStaticTeams, clearStaticDataCache } from '@/lib/firebase/hooks/useStaticData';
import { userService, scoreService } from '@/lib/firebase/services';
import { User, UserRole, AwardedCustomBonus } from '@/lib/types';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useActiveSession } from '@/lib/firebase/hooks/useSessions';
import { useSettings } from '@/lib/firebase/hooks/useSettings';
import toast from 'react-hot-toast';
import {
  UserPlus,
  Edit2,
  Save,
  X,
  Mail,
  Shield,
  Users as UsersIcon,
  UserCheck,
  UserX,
  Search,
  Upload,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';

export default function UsersPage() {
  const { users, loading: usersLoading } = useStaticUsers();
  const { teams, loading: teamsLoading } = useStaticTeams();
  const { session: activeSession } = useActiveSession();
  const { settings } = useSettings();
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userEdits, setUserEdits] = useState<Record<string, Partial<User>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    firstName: '',
    lastName: '',
    email: '',
    avatarUrl: '',
    role: 'member',
    isActive: true,
  });
  const [showAddPointsModal, setShowAddPointsModal] = useState(false);
  const [selectedUserForPoints, setSelectedUserForPoints] = useState<User | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState({ points: 0, note: '' });

  const loading = usersLoading || teamsLoading;

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user.id!);
    setUserEdits({
      ...userEdits,
      [user.id!]: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isActive: user.isActive,
        teamId: user.teamId,
      },
    });
  };

  const handleSaveUser = async (userId: string) => {
    const edits = userEdits[userId];
    if (!edits) return;

    // Check if team is being changed while a session is active
    if (activeSession && 'teamId' in edits) {
      const user = users.find(u => u.id === userId);
      if (user && user.teamId !== edits.teamId) {
        const confirmed = window.confirm(
          `WARNING: There is currently an active session (${activeSession.name || `Week ${activeSession.weekNumber}`}).\n\n` +
          `Changing this user's team assignment will NOT affect their scores or team assignment for the current active session. ` +
          `Their scores will remain with their original team (${teams.find(t => t.id === user.teamId)?.name || 'their current team'}).\n\n` +
          `This change will only apply to future sessions.\n\n` +
          `Do you want to continue?`
        );

        if (!confirmed) {
          return; // User cancelled the change
        }
      }
    }

    try {
      await userService.update(userId, edits);
      clearStaticDataCache(); // Clear cache after update
      toast.success('User updated successfully');
      setEditingUser(null);
      setUserEdits((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleCancelEdit = (userId: string) => {
    setEditingUser(null);
    setUserEdits((prev) => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  };

  const handleAddUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const userToAdd: Omit<User, 'id'> = {
        ...newUser as User,
        createdAt: Timestamp.now(),
        avatarUrl: newUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.firstName}${newUser.lastName}`,
      };

      await userService.create(userToAdd);
      clearStaticDataCache(); // Clear cache after create
      toast.success('User added successfully');
      setShowAddUser(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        avatarUrl: '',
        role: 'member',
        isActive: true,
      });
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await userService.update(userId, { isActive });
      clearStaticDataCache(); // Clear cache after update
      toast.success(`User ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmMessage = `Are you sure you want to permanently delete ${user.firstName} ${user.lastName}? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await userService.delete(user.id!);
      clearStaticDataCache(); // Clear cache after delete
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleAddPoints = async () => {
    if (!selectedUserForPoints || !activeSession || !settings) {
      toast.error('Missing required data');
      return;
    }

    if (pointsToAdd.points === 0) {
      toast.error('Please enter points amount');
      return;
    }

    if (!pointsToAdd.note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    try {
      const scores = await scoreService.getBySession(activeSession.id!);
      const userScore = scores.find(s => s.userId === selectedUserForPoints.id);

      if (!userScore) {
        toast.error('No score found for this user in the active session');
        return;
      }

      const customBonus: AwardedCustomBonus = {
        bonusId: `manual-${Date.now()}`,
        bonusName: pointsToAdd.note,
        points: pointsToAdd.points,
        awardedBy: 'admin',
        awardedAt: Timestamp.now()
      };

      const updatedCustomBonuses = [...(userScore.customBonuses || []), customBonus];
      const customBonusTotal = updatedCustomBonuses.reduce((sum, b) => sum + b.points, 0);
      const metricsTotal = (
        ((userScore.metrics.attendance || 0) * (settings.pointValues.attendance || 0)) +
        ((userScore.metrics.one21s || 0) * (settings.pointValues.one21s || 0)) +
        ((userScore.metrics.referrals || 0) * (settings.pointValues.referrals || 0)) +
        ((userScore.metrics.tyfcb || 0) * (settings.pointValues.tyfcb || 0)) +
        ((userScore.metrics.visitors || 0) * (settings.pointValues.visitors || 0))
      );

      await updateDoc(doc(db, 'scores', userScore.id!), {
        customBonuses: updatedCustomBonuses,
        totalPoints: metricsTotal + customBonusTotal,
        updatedAt: Timestamp.now()
      });

      toast.success(`Added ${pointsToAdd.points} points to ${selectedUserForPoints.firstName} ${selectedUserForPoints.lastName}`);
      setShowAddPointsModal(false);
      setSelectedUserForPoints(null);
      setPointsToAdd({ points: 0, note: '' });
    } catch (error) {
      console.error('Error adding points:', error);
      toast.error('Failed to add points');
    }
  };

  const activeCount = users.filter(u => u.isActive).length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
            <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
          </div>
          <button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus size={20} />
            Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Users</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
            <UsersIcon className="text-blue-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Users</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
            <UserCheck className="text-green-600" size={32} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Admins</p>
              <p className="text-2xl font-bold">{adminCount}</p>
            </div>
            <Shield className="text-purple-600" size={32} />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Add New User</h3>

          {/* Avatar Preview */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <Avatar
                src={newUser.avatarUrl}
                fallbackSeed={`${newUser.firstName}${newUser.lastName}`}
                size="xl"
                className="border-2 border-gray-300"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Avatar Preview</p>
              <p className="text-xs text-gray-500">
                {newUser.avatarUrl ? 'Using custom URL' : 'Auto-generated avatar'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Tip: You can use any image URL or leave empty for auto-generated avatar
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name *"
              value={newUser.firstName}
              onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Last Name *"
              value={newUser.lastName}
              onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="email"
              placeholder="Email *"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">Member</option>
              <option value="team-leader">Team Leader</option>
              <option value="admin">Admin</option>
            </select>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar URL (optional)
              </label>
              <input
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={newUser.avatarUrl}
                onChange={(e) => setNewUser({ ...newUser, avatarUrl: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a direct link to an image file (jpg, png, etc.) or leave empty for auto-generated avatar
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <UserPlus size={18} />
              Add User
            </button>
            <button
              onClick={() => {
                setShowAddUser(false);
                setNewUser({
                  firstName: '',
                  lastName: '',
                  email: '',
                  avatarUrl: '',
                  role: 'member',
                  isActive: true,
                });
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center gap-2"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Points Modal */}
      {showAddPointsModal && selectedUserForPoints && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Add Points to {selectedUserForPoints.firstName} {selectedUserForPoints.lastName}
          </h3>

          {!activeSession && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ No active session found. Please create or open a session first.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points *
              </label>
              <input
                type="number"
                placeholder="Enter points (can be negative)"
                value={pointsToAdd.points === 0 ? '' : pointsToAdd.points}
                onChange={(e) => setPointsToAdd({ ...pointsToAdd, points: Number(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!activeSession}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note/Reason *
              </label>
              <textarea
                placeholder="E.g., 'Extra visitor credit', 'Manual adjustment', etc."
                value={pointsToAdd.note}
                onChange={(e) => setPointsToAdd({ ...pointsToAdd, note: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={!activeSession}
              />
              <p className="text-xs text-gray-500 mt-1">
                This note will be visible in the user's score details
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleAddPoints}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!activeSession}
            >
              <PlusCircle size={18} />
              Add Points
            </button>
            <button
              onClick={() => {
                setShowAddPointsModal(false);
                setSelectedUserForPoints(null);
                setPointsToAdd({ points: 0, note: '' });
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex items-center gap-2"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Team</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const isEditing = editingUser === user.id;
              const edits = userEdits[user.id!] || {};
              const userTeam = teams.find(t => t.id === user.teamId);

              return (
                <tr key={user.id} className={isEditing ? "bg-blue-50" : "hover:bg-gray-50"}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="relative group mr-3">
                        <Avatar
                          src={edits.avatarUrl !== undefined ? edits.avatarUrl : user.avatarUrl}
                          fallbackSeed={`${edits.firstName || user.firstName}${edits.lastName || user.lastName}`}
                          size="md"
                        />
                        {isEditing && (
                          <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-1">
                            <Upload size={12} />
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="First Name"
                              value={edits.firstName !== undefined ? edits.firstName : user.firstName}
                              onChange={(e) =>
                                setUserEdits({
                                  ...userEdits,
                                  [user.id!]: { ...edits, firstName: e.target.value },
                                })
                              }
                              className="px-2 py-1 border rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Last Name"
                              value={edits.lastName !== undefined ? edits.lastName : user.lastName}
                              onChange={(e) =>
                                setUserEdits({
                                  ...userEdits,
                                  [user.id!]: { ...edits, lastName: e.target.value },
                                })
                              }
                              className="px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <input
                            type="url"
                            placeholder="Avatar URL (leave empty for auto-generated)"
                            value={edits.avatarUrl !== undefined ? edits.avatarUrl : user.avatarUrl || ''}
                            onChange={(e) =>
                              setUserEdits({
                                ...userEdits,
                                [user.id!]: { ...edits, avatarUrl: e.target.value },
                              })
                            }
                            className="px-2 py-1 border rounded text-xs w-full"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.id?.slice(-6)}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="email"
                        value={edits.email || user.email}
                        onChange={(e) =>
                          setUserEdits({
                            ...userEdits,
                            [user.id!]: { ...edits, email: e.target.value },
                          })
                        }
                        className="px-2 py-1 border rounded w-full"
                      />
                    ) : (
                      <div className="flex items-center text-sm text-gray-900">
                        <Mail size={16} className="mr-2 text-gray-400" />
                        {user.email}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={edits.teamId || user.teamId || ''}
                        onChange={(e) =>
                          setUserEdits({
                            ...userEdits,
                            [user.id!]: { ...edits, teamId: e.target.value || null },
                          })
                        }
                        className="px-2 py-1 border rounded"
                      >
                        <option value="">No Team</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        userTeam
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {userTeam?.name || 'Unassigned'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={edits.role || user.role}
                        onChange={(e) =>
                          setUserEdits({
                            ...userEdits,
                            [user.id!]: { ...edits, role: e.target.value as UserRole },
                          })
                        }
                        className="px-2 py-1 border rounded"
                      >
                        <option value="member">Member</option>
                        <option value="team-leader">Team Leader</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'team-leader'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'team-leader' ? 'Team Leader' : user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user.id!, !user.isActive)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                        user.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {user.isActive ? (
                        <>
                          <UserCheck size={14} />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX size={14} />
                          Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveUser(user.id!)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => handleCancelEdit(user.id!)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit user"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserForPoints(user);
                            setShowAddPointsModal(true);
                          }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Add points"
                        >
                          <PlusCircle size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete user"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}