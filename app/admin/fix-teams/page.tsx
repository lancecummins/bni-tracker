'use client';

import { useState } from 'react';
import { useActiveSeason, useTeams } from '@/lib/firebase/hooks';
import { teamService } from '@/lib/firebase/services';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FixTeamsPage() {
  const { season: activeSeason } = useActiveSeason();
  const { teams } = useTeams();
  const [fixing, setFixing] = useState(false);

  const teamsNeedingFix = teams.filter(team => team.seasonId !== activeSeason?.id);

  const handleFixTeams = async () => {
    if (!activeSeason?.id) {
      toast.error('No active season found');
      return;
    }

    if (teamsNeedingFix.length === 0) {
      toast.success('All teams already have correct seasonId!');
      return;
    }

    if (!confirm(`Update ${teamsNeedingFix.length} teams to season "${activeSeason.name}"?`)) {
      return;
    }

    try {
      setFixing(true);

      for (const team of teamsNeedingFix) {
        if (team.id) {
          await teamService.update(team.id, {
            seasonId: activeSeason.id,
          });
        }
      }

      toast.success(`Successfully updated ${teamsNeedingFix.length} teams!`);

      // Reload page after 1 second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error fixing teams:', error);
      toast.error('Failed to update teams');
    } finally {
      setFixing(false);
    }
  };

  if (!activeSeason) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <AlertTriangle size={20} />
            <span className="font-medium">No Active Season</span>
          </div>
          <p className="text-sm text-yellow-700">
            You need to create or activate a season first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900">Fix Team Seasons</h1>
        <p className="text-gray-600 mt-1">
          Update teams to match the active season
        </p>
      </div>

      {/* Active Season Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 mb-2">
          <CheckCircle size={20} />
          <span className="font-medium">Active Season</span>
        </div>
        <p className="text-sm text-blue-700">
          <strong>{activeSeason.name}</strong> (ID: {activeSeason.id})
        </p>
      </div>

      {/* Teams Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Teams Status</h2>

        <div className="space-y-3">
          {teams.map((team) => {
            const isCorrect = team.seasonId === activeSeason.id;
            return (
              <div
                key={team.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isCorrect ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isCorrect ? (
                    <CheckCircle className="text-green-600" size={20} />
                  ) : (
                    <AlertTriangle className="text-red-600" size={20} />
                  )}
                  <div>
                    <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                      {team.name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      seasonId: {team.seasonId || 'NULL'}
                    </p>
                  </div>
                </div>
                <span className={`text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? 'Correct' : 'Needs Fix'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fix Button */}
      {teamsNeedingFix.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <p className="text-gray-700">
              <strong>{teamsNeedingFix.length}</strong> team{teamsNeedingFix.length > 1 ? 's' : ''} need
              to be updated to the active season.
            </p>
          </div>

          <button
            onClick={handleFixTeams}
            disabled={fixing}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fixing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Updating Teams...
              </>
            ) : (
              <>
                <RefreshCw size={20} />
                Fix All Teams
              </>
            )}
          </button>
        </div>
      )}

      {teamsNeedingFix.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle size={20} />
            <span className="font-medium">All teams are correctly configured!</span>
          </div>
          <p className="text-sm text-green-700 mt-2">
            All teams have the correct seasonId matching the active season.
          </p>
        </div>
      )}
    </div>
  );
}
