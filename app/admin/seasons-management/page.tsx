'use client';

import { useState } from 'react';
import { useSeasons, useActiveSeason } from '@/lib/firebase/hooks';
import { seasonService } from '@/lib/firebase/services/seasonService';
import { Season, PointValues, BonusValues } from '@/lib/types';
import { Calendar, CheckCircle, XCircle, Plus, PlayCircle, StopCircle, Eye, TrendingUp, Users, Award, Trash2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function SeasonsManagementPage() {
  const { seasons, loading } = useSeasons();
  const { season: activeSeason } = useActiveSeason();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);

  // Form state for new season
  const [newSeason, setNewSeason] = useState({
    name: '',
    startDate: '',
    endDate: '',
    weekCount: 12,
    pointValues: {
      attendance: 10,
      one21s: 15,
      referrals: 25,
      tyfcb: 20,
      visitors: 15,
      ceu: 10,
    } as PointValues,
    bonusValues: {
      attendance: 50,
      one21s: 50,
      referrals: 100,
      tyfcb: 75,
      visitors: 50,
      ceu: 50,
    } as BonusValues,
  });

  const handleCloseCurrentSeason = async () => {
    if (!activeSeason?.id) {
      toast.error('No active season to close');
      return;
    }

    // Check if all sessions are closed
    const allClosed = await seasonService.areAllSessionsClosed(activeSeason.id);
    if (!allClosed) {
      toast.error('Cannot close season: some sessions are still open');
      return;
    }

    if (!confirm(`Are you sure you want to close the season "${activeSeason.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setClosing(true);
      await seasonService.close(activeSeason.id);
      toast.success('Season closed successfully!');
    } catch (error) {
      console.error('Error closing season:', error);
      toast.error('Failed to close season');
    } finally {
      setClosing(false);
    }
  };

  const handleCreateSeason = async () => {
    if (!newSeason.name || !newSeason.startDate || !newSeason.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newSeason.weekCount < 1) {
      toast.error('Week count must be at least 1');
      return;
    }

    try {
      setCreating(true);

      const season: Omit<Season, 'id'> = {
        name: newSeason.name,
        startDate: Timestamp.fromDate(new Date(newSeason.startDate)),
        endDate: Timestamp.fromDate(new Date(newSeason.endDate)),
        weekCount: newSeason.weekCount,
        currentWeek: 1,
        isActive: true,
        pointValues: newSeason.pointValues,
        bonusValues: newSeason.bonusValues,
        createdAt: Timestamp.now(),
      };

      const newSeasonId = await seasonService.create(season);

      // If there was a previous active season, update teams to new season
      if (activeSeason?.id) {
        toast.success('Updating teams for new season...');
        await seasonService.duplicateTeamsForNewSeason(activeSeason.id, newSeasonId);
        await seasonService.unassignAllUsersFromTeams();
        toast.success('Teams updated! Users have been unassigned. Go to Teams page to assign team leaders, then start the draft.');
      }

      toast.success(`Season "${newSeason.name}" created successfully! Redirecting to draft setup...`);
      setShowCreateModal(false);

      // Redirect to draft setup after a brief delay
      setTimeout(() => {
        window.location.href = '/admin/draft-setup';
      }, 1500);
      setNewSeason({
        name: '',
        startDate: '',
        endDate: '',
        weekCount: 12,
        pointValues: newSeason.pointValues,
        bonusValues: newSeason.bonusValues,
      });
    } catch (error) {
      console.error('Error creating season:', error);
      toast.error('Failed to create season');
    } finally {
      setCreating(false);
    }
  };

  const handleViewSeason = (seasonId: string) => {
    // TODO: Implement season viewing/switching
    toast('Season viewing will be implemented in the next phase', {
      icon: 'ℹ️',
    });
  };

  const handleReactivateSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to reactivate this season? The current active season will be closed.')) {
      return;
    }

    try {
      await seasonService.activate(seasonId);
      toast.success('Season reactivated successfully!');
    } catch (error) {
      console.error('Error reactivating season:', error);
      toast.error('Failed to reactivate season');
    }
  };

  const handleDeleteSeason = async (seasonId: string, seasonName: string) => {
    const season = seasons.find(s => s.id === seasonId);

    if (season?.isActive) {
      toast.error('Cannot delete the active season. Please close it first.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${seasonName}"? This action cannot be undone and will permanently remove all associated data.`)) {
      return;
    }

    try {
      await seasonService.delete(seasonId);
      toast.success('Season deleted successfully!');
    } catch (error) {
      console.error('Error deleting season:', error);
      toast.error('Failed to delete season');
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Season Management</h1>
            <p className="text-gray-600 mt-1">Manage competition seasons and lifecycle</p>
          </div>

          <div className="flex items-center gap-4">
            {activeSeason ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Current Season</p>
                  <p className="font-semibold text-gray-900">{activeSeason.name}</p>
                </div>
                <button
                  onClick={handleCloseCurrentSeason}
                  disabled={closing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <StopCircle size={20} />
                  {closing ? 'Closing...' : 'Close Season'}
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">No active season</div>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={20} />
              Create New Season
            </button>
          </div>
        </div>
      </div>

      {/* Seasons List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">All Seasons</h2>

        {seasons.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No seasons found. Create your first season to get started!</p>
          </div>
        ) : (
          seasons.map((season) => (
            <div
              key={season.id}
              className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                season.isActive ? 'border-green-500' : 'border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{season.name}</h3>
                    {season.isActive && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <PlayCircle size={16} />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-gray-600">
                        {season.startDate ? new Date(season.startDate.seconds * 1000).toLocaleDateString() : 'N/A'} - {' '}
                        {season.endDate ? new Date(season.endDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-gray-400" />
                      <span className="text-gray-600">{season.weekCount || 0} weeks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-400" />
                      <span className="text-gray-600">Week {season.currentWeek || 1} of {season.weekCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award size={16} className="text-gray-400" />
                      <span className="text-gray-600">
                        {season.isActive ? 'Active Season' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Point Values Preview */}
                  {season.pointValues && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Point Values:</p>
                      <div className="flex gap-3 text-xs text-gray-600">
                        <span>Attendance: {season.pointValues?.attendance || 0}</span>
                        <span>1-2-1s: {season.pointValues?.one21s || 0}</span>
                        <span>Referrals: {season.pointValues?.referrals || 0}</span>
                        <span>TYFCB: {season.pointValues?.tyfcb || 0}</span>
                        <span>Visitors: {season.pointValues?.visitors || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-6">
                  <button
                    onClick={() => handleViewSeason(season.id!)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Eye size={16} />
                    View Details
                  </button>

                  {!season.isActive && (
                    <>
                      <button
                        onClick={() => handleReactivateSeason(season.id!)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                      >
                        <PlayCircle size={16} />
                        Reactivate
                      </button>
                      <button
                        onClick={() => handleDeleteSeason(season.id!, season.name)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Season Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create New Season</h2>

            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Season Name *
                </label>
                <input
                  type="text"
                  value={newSeason.name}
                  onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
                  placeholder="e.g., Spring 2025, Q1 Competition"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={newSeason.startDate}
                    onChange={(e) => setNewSeason({ ...newSeason, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={newSeason.endDate}
                    onChange={(e) => setNewSeason({ ...newSeason, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Weeks *
                </label>
                <input
                  type="number"
                  value={newSeason.weekCount}
                  onChange={(e) => setNewSeason({ ...newSeason, weekCount: parseInt(e.target.value) || 1 })}
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Point Values */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Individual Point Values</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(newSeason.pointValues).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {key === 'one21s' ? '1-2-1s' : key === 'tyfcb' ? 'TYFCB' : key === 'ceu' ? 'CEU' : key}
                      </label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          setNewSeason({
                            ...newSeason,
                            pointValues: {
                              ...newSeason.pointValues,
                              [key]: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bonus Values */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Team "All In" Bonus Values</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(newSeason.bonusValues).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                        {key === 'one21s' ? '1-2-1s' : key === 'tyfcb' ? 'TYFCB' : key === 'ceu' ? 'CEU' : key}
                      </label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) =>
                          setNewSeason({
                            ...newSeason,
                            bonusValues: {
                              ...newSeason.bonusValues,
                              [key]: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {activeSeason && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Creating a new season will:
                    <ul className="list-disc ml-5 mt-2">
                      <li>Close the current season "{activeSeason.name}"</li>
                      <li>Duplicate teams (keeping names/colors)</li>
                      <li>Unassign all users from teams</li>
                      <li>Allow you to assign team leaders and draft members</li>
                    </ul>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateSeason}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Season'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
