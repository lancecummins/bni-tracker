'use client';

import { useState, useEffect } from 'react';
import { useActiveSeason, useTeams, useUsers } from '@/lib/firebase/hooks';
import { draftService } from '@/lib/firebase/services/draftService';
import { useDraftBySeasonId } from '@/lib/firebase/hooks/useDraft';
import { Trophy, Users, PlayCircle, CheckCircle, AlertCircle, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function DraftSetupPage() {
  const { season: activeSeason } = useActiveSeason();
  const { teams } = useTeams();
  const { users } = useUsers();
  const { draft, loading: draftLoading } = useDraftBySeasonId(activeSeason?.id || null);
  const [starting, setStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState(false);

  // Filter teams for current season
  const currentSeasonTeams = teams.filter(team => team.seasonId === activeSeason?.id);

  // Get team leaders
  const teamLeaders = users.filter(user => user.role === 'team-leader' && user.isActive);

  // Validate setup
  const teamLeadersCount = teamLeaders.length;
  const teamsCount = currentSeasonTeams.length;
  const hasValidSetup = teamLeadersCount === 4 && teamsCount === 4;

  // Get each team's leader
  const teamsWithLeaders = currentSeasonTeams.map(team => {
    const leader = teamLeaders.find(tl => tl.teamId === team.id);
    return { team, leader };
  });

  const handleStartDraft = async () => {
    if (!activeSeason?.id) {
      toast.error('No active season found');
      return;
    }

    if (!hasValidSetup) {
      toast.error('You need exactly 4 teams with 4 team leaders assigned');
      return;
    }

    if (!confirm('Start the draft? Team leaders will be able to begin selecting members.')) {
      return;
    }

    try {
      setStarting(true);

      // Calculate draft order from previous season
      // Get all seasons and find the one before this one
      const allSeasons = await import('@/lib/firebase/services/seasonService').then(m => m.seasonService.getAll());
      const sortedSeasons = allSeasons.sort((a, b) =>
        b.createdAt.toMillis() - a.createdAt.toMillis()
      );

      const currentSeasonIndex = sortedSeasons.findIndex(s => s.id === activeSeason.id);
      const previousSeason = currentSeasonIndex >= 0 && currentSeasonIndex < sortedSeasons.length - 1
        ? sortedSeasons[currentSeasonIndex + 1]
        : null;

      let teamLeadersWithOrder;

      if (previousSeason) {
        // Calculate draft order based on previous season standings
        const draftOrder = await draftService.calculateDraftOrder(previousSeason.id!);

        // Map teams to their draft positions
        teamLeadersWithOrder = teamsWithLeaders.map(({ team, leader }) => {
          if (!leader) throw new Error(`Team ${team.name} has no leader assigned`);

          const draftPosition = draftOrder.findIndex(d => d.teamId === team.id) + 1;

          return {
            teamId: team.id!,
            userId: leader.id!,
            draftPosition: draftPosition || teamsWithLeaders.findIndex(t => t.team.id === team.id) + 1,
          };
        });
      } else {
        // No previous season, use arbitrary order
        toast('No previous season found. Using team order as draft order.', { icon: 'ℹ️' });
        teamLeadersWithOrder = teamsWithLeaders.map(({ team, leader }, index) => {
          if (!leader) throw new Error(`Team ${team.name} has no leader assigned`);

          return {
            teamId: team.id!,
            userId: leader.id!,
            draftPosition: index + 1,
          };
        });
      }

      // Create draft
      const draftId = await draftService.create(activeSeason.id, teamLeadersWithOrder);

      toast.success('Draft started! Team leaders can now begin picking members.');
    } catch (error) {
      console.error('Error starting draft:', error);
      toast.error('Failed to start draft. See console for details.');
    } finally {
      setStarting(false);
    }
  };

  const handleFinalizeDraft = async () => {
    if (!draft?.id) {
      toast.error('No active draft found');
      return;
    }

    if (!confirm('Finalize the draft and assign all picked members to their teams? This will update user team assignments.')) {
      return;
    }

    try {
      setFinalizing(true);
      await draftService.finalize(draft.id);
      toast.success('Draft finalized! All members have been assigned to their teams.');
    } catch (error) {
      console.error('Error finalizing draft:', error);
      toast.error('Failed to finalize draft. See console for details.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleMoveDraftPosition = async (currentPosition: number, direction: 'up' | 'down') => {
    if (!draft?.id) return;

    const newPosition = direction === 'up' ? currentPosition - 1 : currentPosition + 1;

    // Can't move beyond bounds
    if (newPosition < 1 || newPosition > draft.teamLeaders.length) {
      return;
    }

    try {
      setUpdatingOrder(true);

      // Create new team leaders array with swapped positions
      const updatedTeamLeaders = draft.teamLeaders.map(tl => {
        if (tl.draftPosition === currentPosition) {
          return { ...tl, draftPosition: newPosition };
        } else if (tl.draftPosition === newPosition) {
          return { ...tl, draftPosition: currentPosition };
        }
        return tl;
      });

      await draftService.updateDraftOrder(draft.id, updatedTeamLeaders);
      toast.success('Draft order updated!');
    } catch (error) {
      console.error('Error updating draft order:', error);
      toast.error('Failed to update draft order');
    } finally {
      setUpdatingOrder(false);
    }
  };

  if (!activeSeason) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <AlertCircle size={20} />
            <span className="font-medium">No Active Season</span>
          </div>
          <p className="text-sm text-yellow-700">
            You need to create a season before starting a draft.{' '}
            <Link href="/admin/seasons-management" className="underline font-semibold">
              Go to Seasons
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Draft Setup</h1>
            <p className="text-gray-600 mt-1">
              Set up and manage the member draft for {activeSeason.name}
            </p>
          </div>

          {draft ? (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                draft.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                draft.status === 'completed' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {draft.status === 'in_progress' ? 'Draft In Progress' :
                 draft.status === 'completed' ? 'Draft Completed' :
                 'Setup'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Setup Validation */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>

        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-3 rounded-lg ${
            teamsCount === 4 ? 'bg-green-50' : 'bg-red-50'
          }`}>
            {teamsCount === 4 ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <AlertCircle className="text-red-600" size={20} />
            )}
            <div className="flex-1">
              <span className={teamsCount === 4 ? 'text-green-800' : 'text-red-800'}>
                {teamsCount === 4 ? '✓ ' : '✗ '}
                {teamsCount} of 4 teams created
              </span>
              {teamsCount !== 4 && teams.length === 4 && (
                <div className="text-sm text-red-700 mt-1">
                  Teams may be assigned to the wrong season.{' '}
                  <Link href="/admin/fix-teams" className="underline font-semibold">
                    Fix team assignments
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-lg ${
            teamLeadersCount === 4 ? 'bg-green-50' : 'bg-red-50'
          }`}>
            {teamLeadersCount === 4 ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <AlertCircle className="text-red-600" size={20} />
            )}
            <span className={teamLeadersCount === 4 ? 'text-green-800' : 'text-red-800'}>
              {teamLeadersCount === 4 ? '✓ ' : '✗ '}
              {teamLeadersCount} of 4 team leaders assigned
            </span>
          </div>

          {!hasValidSetup && (
            <div className="text-sm text-gray-600 mt-2">
              <p>To start a draft, you need:</p>
              <ul className="list-disc ml-5 mt-1">
                <li>Exactly 4 teams for this season</li>
                <li>Exactly 4 users with "team-leader" role</li>
                <li>Each team leader assigned to a team</li>
              </ul>
              <p className="mt-2">
                Go to <Link href="/admin/teams" className="text-blue-600 underline">Teams page</Link> to assign team leaders.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Teams & Leaders */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Teams & Leaders</h2>

        <div className="grid grid-cols-2 gap-4">
          {teamsWithLeaders.map(({ team, leader }, index) => (
            <div key={team.id} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: team.color }}
                >
                  {team.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  {draft && (
                    <p className="text-xs text-gray-500">
                      Draft Position: {draft.teamLeaders.find(tl => tl.teamId === team.id)?.draftPosition || index + 1}
                    </p>
                  )}
                </div>
              </div>
              {leader ? (
                <div className="text-sm text-gray-600 mt-2">
                  <strong>Team Leader:</strong> {leader.firstName} {leader.lastName}
                </div>
              ) : (
                <div className="text-sm text-red-600 mt-2">
                  ⚠️ No team leader assigned
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Draft Links (if draft exists) */}
      {draft && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Draft Order</h2>

          <p className="text-sm text-gray-600 mb-4">
            Use the arrows to reorder teams. Share these links with each team leader so they can participate in the draft:
          </p>

          <div className="space-y-2">
            {draft.teamLeaders.sort((a, b) => a.draftPosition - b.draftPosition).map((teamLeader) => {
              const team = currentSeasonTeams.find(t => t.id === teamLeader.teamId);
              const leader = users.find(u => u.id === teamLeader.userId);
              const draftUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/draft/${activeSeason.id}/${teamLeader.userId}`;
              const isFirst = teamLeader.draftPosition === 1;
              const isLast = teamLeader.draftPosition === draft.teamLeaders.length;

              return (
                <div key={teamLeader.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {/* Reorder Controls */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleMoveDraftPosition(teamLeader.draftPosition, 'up')}
                        disabled={isFirst || updatingOrder}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMoveDraftPosition(teamLeader.draftPosition, 'down')}
                        disabled={isLast || updatingOrder}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    <div className="text-lg font-bold text-gray-500">
                      #{teamLeader.draftPosition}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {leader?.firstName} {leader?.lastName}
                      </div>
                      <div className="text-sm text-gray-600">{team?.name}</div>
                    </div>
                  </div>
                  <a
                    href={draftUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <ExternalLink size={16} />
                    Open Draft
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Draft Progress (if draft exists and in progress) */}
      {draft && draft.status === 'in_progress' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Draft Progress</h2>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Picks:</span>
              <span className="font-semibold">{draft.picks.length}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Round:</span>
              <span className="font-semibold">
                {Math.floor(draft.currentPickNumber / 4) + 1}
              </span>
            </div>

            {draft.currentPickNumber > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Picks:</h3>
                <div className="space-y-1">
                  {draft.picks.slice(-5).reverse().map((pick, index) => {
                    const user = users.find(u => u.id === pick.userId);
                    const team = currentSeasonTeams.find(t => t.id === pick.teamId);

                    return (
                      <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">R{pick.round}</span>
                        <span>{user?.firstName} {user?.lastName}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold" style={{ color: team?.color }}>
                          {team?.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        {!draft ? (
          <button
            onClick={handleStartDraft}
            disabled={!hasValidSetup || starting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Starting Draft...
              </>
            ) : (
              <>
                <PlayCircle size={20} />
                Start Draft
              </>
            )}
          </button>
        ) : draft.status === 'in_progress' ? (
          <button
            onClick={handleFinalizeDraft}
            disabled={finalizing}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {finalizing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Finalize Draft & Assign Members
              </>
            )}
          </button>
        ) : (
          <div className="text-center p-4 bg-green-50 text-green-800 rounded-lg">
            Draft completed and finalized!
          </div>
        )}
      </div>
    </div>
  );
}
