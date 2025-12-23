'use client';

import { useState, useEffect } from 'react';
import {
  useStaticActiveSession,
  useStaticUsers,
  useStaticTeams,
  useStaticSessionScores,
  clearStaticDataCache
} from '@/lib/firebase/hooks/useStaticData';
import { scoreService } from '@/lib/firebase/services';
import { useAuth } from '@/lib/firebase/hooks/useAuth';
import { Score, User, Team } from '@/lib/types';
import { CheckCircle, XCircle, Send, AlertCircle, Users, Clock } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

export default function AdminReviewPage() {
  const { user: currentUser } = useAuth();
  const { session: activeSession } = useStaticActiveSession();
  const { users } = useStaticUsers();
  const { teams } = useStaticTeams();
  const { scores, loading: scoresLoading } = useStaticSessionScores(activeSession?.id || null);

  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Group scores by team and track submission status
  const getTeamSubmissions = () => {
    const teamSubmissions: Record<string, {
      team: Team;
      teamLeader: User | null;
      members: User[];
      draftScores: Score[];
      publishedScores: Score[];
      isComplete: boolean;
      lastUpdated?: Date;
    }> = {};

    teams.forEach(team => {
      const teamLeader = users.find(u => u.id === team.teamLeaderId) || null;
      const teamMembers = users.filter(u => u.teamId === team.id && (u.role === 'member' || u.role === 'team-leader') && u.isActive);
      const teamDraftScores = scores.filter(s => s.teamId === team.id && s.isDraft);
      const teamPublishedScores = scores.filter(s => s.teamId === team.id && !s.isDraft);

      const lastUpdated = teamDraftScores.length > 0
        ? Math.max(...teamDraftScores.map(s => s.updatedAt.toMillis()))
        : undefined;

      teamSubmissions[team.id!] = {
        team,
        teamLeader,
        members: teamMembers,
        draftScores: teamDraftScores,
        publishedScores: teamPublishedScores,
        isComplete: teamMembers.length > 0 && teamDraftScores.length === teamMembers.length,
        lastUpdated: lastUpdated ? new Date(lastUpdated) : undefined,
      };
    });

    return teamSubmissions;
  };

  const teamSubmissions = getTeamSubmissions();

  // Count total draft scores across all teams
  const totalDraftScores = Object.values(teamSubmissions).reduce(
    (sum, submission) => sum + submission.draftScores.length, 0
  );

  const totalExpectedScores = Object.values(teamSubmissions).reduce(
    (sum, submission) => sum + submission.members.length, 0
  );

  const handlePublishAll = async () => {
    if (!activeSession || !currentUser) return;

    setPublishing(true);
    setMessage(null);

    try {
      // Get all draft scores
      const draftScores = scores.filter(s => s.isDraft);

      if (draftScores.length === 0) {
        setMessage({ type: 'error', text: 'No draft scores to publish.' });
        return;
      }

      // Update all draft scores to published
      const promises = draftScores.map(async (score) => {
        const updatedScore: Score = {
          ...score,
          isDraft: false,
          publishedBy: currentUser.uid,
          publishedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        return scoreService.update(score.id!, updatedScore);
      });

      await Promise.all(promises);

      setMessage({
        type: 'success',
        text: `Successfully published ${draftScores.length} scores! The live displays have been updated.`
      });
    } catch (error) {
      console.error('Error publishing scores:', error);
      setMessage({ type: 'error', text: 'Failed to publish scores. Please try again.' });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishTeam = async (teamId: string) => {
    if (!activeSession || !currentUser) return;

    setPublishing(true);
    setMessage(null);

    try {
      // Get draft scores for this team
      const teamDraftScores = scores.filter(s => s.teamId === teamId && s.isDraft);

      if (teamDraftScores.length === 0) {
        setMessage({ type: 'error', text: 'No draft scores to publish for this team.' });
        return;
      }

      // Update team's draft scores to published
      const promises = teamDraftScores.map(async (score) => {
        const updatedScore: Score = {
          ...score,
          isDraft: false,
          publishedBy: currentUser.uid,
          publishedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        return scoreService.update(score.id!, updatedScore);
      });

      await Promise.all(promises);

      setMessage({
        type: 'success',
        text: `Successfully published scores for ${teamSubmissions[teamId].team.name}!`
      });
    } catch (error) {
      console.error('Error publishing team scores:', error);
      setMessage({ type: 'error', text: 'Failed to publish team scores. Please try again.' });
    } finally {
      setPublishing(false);
    }
  };

  if (!activeSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold">No Active Session</h2>
          <p className="text-gray-600 mt-2">Start a scoring session to review team submissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review & Publish Scores</h1>
              <p className="mt-1 text-sm text-gray-600">
                Week {activeSession.weekNumber} • {activeSession.date.toDate().toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={handlePublishAll}
              disabled={publishing || totalDraftScores === 0}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
              {publishing ? 'Publishing...' : `Publish All (${totalDraftScores} scores)`}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Draft Scores Submitted</span>
              <span>{totalDraftScores} / {totalExpectedScores}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(totalDraftScores / totalExpectedScores) * 100}%` }}
              />
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              {message.text}
            </div>
          )}
        </div>

        {/* Team Submissions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(teamSubmissions).map(([teamId, submission]) => (
            <div
              key={teamId}
              className={`bg-white rounded-lg shadow-sm p-6 border-2 ${
                submission.isComplete && submission.draftScores.length > 0
                  ? 'border-green-200'
                  : submission.draftScores.length > 0
                  ? 'border-yellow-200'
                  : 'border-gray-200'
              }`}
            >
              {/* Team Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: submission.team.color }}
                  />
                  <h3 className="text-lg font-semibold">{submission.team.name}</h3>
                </div>
                {submission.isComplete && submission.draftScores.length > 0 ? (
                  <CheckCircle className="text-green-500" size={24} />
                ) : submission.draftScores.length > 0 ? (
                  <Clock className="text-yellow-500" size={24} />
                ) : (
                  <XCircle className="text-gray-400" size={24} />
                )}
              </div>

              {/* Team Leader Info */}
              <div className="text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span>
                    Team Leader: {submission.teamLeader
                      ? `${submission.teamLeader.firstName} ${submission.teamLeader.lastName}`
                      : 'Not assigned'}
                  </span>
                </div>
              </div>

              {/* Submission Status */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Members:</span>
                  <span className="font-medium">{submission.members.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Draft Scores:</span>
                  <span className={`font-medium ${
                    submission.draftScores.length === submission.members.length
                      ? 'text-green-600'
                      : submission.draftScores.length > 0
                      ? 'text-yellow-600'
                      : 'text-gray-400'
                  }`}>
                    {submission.draftScores.length} / {submission.members.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Published:</span>
                  <span className="font-medium text-blue-600">
                    {submission.publishedScores.length}
                  </span>
                </div>
                {submission.lastUpdated && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-500">
                      {submission.lastUpdated.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Publish Button */}
              {submission.draftScores.length > 0 && (
                <button
                  onClick={() => handlePublishTeam(teamId)}
                  disabled={publishing}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  Publish Team Scores
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Member Details (Optional - for reviewing individual scores) */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Draft Score Details</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Team</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Member</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Att</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">1-2-1</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Ref</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">TYFCB</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Vis</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">CEU</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Total</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {scores
                  .filter(score => score.isDraft)
                  .map(score => {
                    const user = users.find(u => u.id === score.userId);
                    const team = teams.find(t => t.id === score.teamId);
                    return (
                      <tr key={score.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span
                            className="font-medium"
                            style={{ color: team?.color }}
                          >
                            {team?.name}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {user ? `${user.firstName} ${user.lastName}` : 'Unknown'}
                        </td>
                        <td className="px-4 py-2 text-center">{score.metrics.attendance}</td>
                        <td className="px-4 py-2 text-center">{score.metrics.one21s}</td>
                        <td className="px-4 py-2 text-center">{score.metrics.referrals}</td>
                        <td className="px-4 py-2 text-center">{score.metrics.tyfcb}</td>
                        <td className="px-4 py-2 text-center">{score.metrics.visitors}</td>
                        <td className="px-4 py-2 text-center">{score.metrics.ceu}</td>
                        <td className="px-4 py-2 text-center font-semibold">{score.totalPoints}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Draft
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}